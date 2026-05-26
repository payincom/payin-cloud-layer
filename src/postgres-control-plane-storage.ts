import { Pool, type PoolConfig } from 'pg';
import {
  emptyLocalControlPlaneSnapshot,
  type LocalControlPlaneSnapshot,
  type LocalControlPlaneStorage,
} from './local-control-plane-storage.js';

export interface PostgresControlPlaneStorageOptions {
  connectionString: string;
  ssl?: boolean;
  namespace?: string;
  pool?: Pool;
}

const defaultNamespace = 'railway-proof';
const tableName = 'payin_cloud_control_plane_snapshots';

export const postgresControlPlaneMigrations = [
  `create table if not exists ${tableName} (
    namespace text primary key,
    snapshot jsonb not null,
    updated_at timestamptz not null default now()
  )`,
] as const;

export class PostgresControlPlaneStorage implements LocalControlPlaneStorage {
  readonly kind = 'postgres' as const;
  readonly description: string;
  readonly ready: Promise<void>;

  private snapshot = emptyLocalControlPlaneSnapshot();
  private readonly pool: Pool;
  private readonly namespace: string;
  private pendingWrite: Promise<void> = Promise.resolve();

  constructor(options: PostgresControlPlaneStorageOptions) {
    if (!options.connectionString) {
      throw new Error('Postgres control-plane storage requires DATABASE_URL when explicitly enabled.');
    }
    this.namespace = normalizeNamespace(options.namespace);
    this.pool = options.pool ?? new Pool(poolConfig(options));
    this.description = `hosted Postgres control-plane snapshot namespace: ${this.namespace}`;
    this.ready = this.initialize();
  }

  read(): LocalControlPlaneSnapshot {
    return cloneSnapshot(this.snapshot);
  }

  write(snapshot: LocalControlPlaneSnapshot): void {
    this.snapshot = cloneSnapshot(snapshot);
    const snapshotCopy = cloneSnapshot(this.snapshot);
    this.pendingWrite = this.pendingWrite.then(() => this.writeSnapshot(snapshotCopy));
    void this.pendingWrite.catch(error => {
      console.error(JSON.stringify({
        event: 'payin.cloud.control_plane.postgres_write_failed',
        code: 'POSTGRES_WRITE_FAILED',
        message: error instanceof Error ? error.message : 'unknown error',
      }));
    });
  }

  async flush(): Promise<void> {
    await this.ready;
    await this.pendingWrite;
  }

  async close(): Promise<void> {
    await this.flush();
    await this.pool.end();
  }

  private async initialize(): Promise<void> {
    await runPostgresControlPlaneMigrations(this.pool);
    const result = await this.pool.query('select snapshot from payin_cloud_control_plane_snapshots where namespace = $1', [this.namespace]);
    if (result.rows.length > 0) {
      this.snapshot = cloneSnapshot(result.rows[0].snapshot as LocalControlPlaneSnapshot);
      return;
    }
    await this.writeSnapshot(this.snapshot);
  }

  private async writeSnapshot(snapshot: LocalControlPlaneSnapshot): Promise<void> {
    await this.pool.query(
      `insert into ${tableName} (namespace, snapshot, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (namespace) do update set snapshot = excluded.snapshot, updated_at = now()`,
      [this.namespace, JSON.stringify(snapshot)]
    );
  }
}

export async function runPostgresControlPlaneMigrations(poolOrConfig: Pool | PoolConfig): Promise<void> {
  const pool = poolOrConfig instanceof Pool ? poolOrConfig : new Pool(poolOrConfig);
  const ownsPool = !(poolOrConfig instanceof Pool);
  try {
    for (const migration of postgresControlPlaneMigrations) await pool.query(migration);
  } finally {
    if (ownsPool) await pool.end();
  }
}

export function createPostgresControlPlaneStorageFromEnv(env: NodeJS.ProcessEnv = process.env) {
  if (env.PAYIN_CLOUD_CONTROL_PLANE_STORAGE !== 'postgres') return null;
  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('PAYIN_CLOUD_CONTROL_PLANE_STORAGE=postgres requires DATABASE_URL. Secret value was not read or printed.');
  }
  return new PostgresControlPlaneStorage({
    connectionString,
    ssl: env.PAYIN_CLOUD_POSTGRES_SSL !== 'false',
    namespace: env.PAYIN_CLOUD_CONTROL_PLANE_NAMESPACE,
  });
}

function poolConfig(options: PostgresControlPlaneStorageOptions): PoolConfig {
  return {
    connectionString: options.connectionString,
    ssl: options.ssl === false ? undefined : { rejectUnauthorized: false },
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  };
}

function normalizeNamespace(value: string | undefined): string {
  const namespace = value?.trim() || defaultNamespace;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,62}$/.test(namespace)) {
    throw new Error('PAYIN_CLOUD_CONTROL_PLANE_NAMESPACE must be 2-63 URL-safe characters.');
  }
  return namespace;
}

function cloneSnapshot(snapshot: LocalControlPlaneSnapshot): LocalControlPlaneSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as LocalControlPlaneSnapshot;
}
