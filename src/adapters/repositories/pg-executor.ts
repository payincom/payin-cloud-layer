import pg from 'pg';
import { assertDisposableIntegrationDatabaseUrl } from '../../integration-safety.js';
import type { SqlQueryExecutor } from './sql.js';

export interface PgExecutorOptions {
  connectionString: string;
  /** Required for tests and disposable migrations so production URLs cannot be used accidentally. */
  requireDisposable?: boolean;
}

export class PgSqlExecutor implements SqlQueryExecutor {
  private readonly pool: pg.Pool;

  constructor(options: PgExecutorOptions) {
    if (options.requireDisposable !== false) {
      assertDisposableIntegrationDatabaseUrl(options.connectionString);
    }
    this.pool = new pg.Pool({ connectionString: options.connectionString, max: 3, allowExitOnIdle: true });
  }

  async query<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<{ rows: T[] }> {
    const result = await this.pool.query(text, values);
    return { rows: result.rows as T[] };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
