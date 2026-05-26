#!/usr/bin/env node
import { Pool } from 'pg';
import { runPostgresControlPlaneMigrations } from '../dist/postgres-control-plane-storage.js';

const command = process.argv[2] ?? 'migrate';
if (!['migrate', 'check'].includes(command)) {
  console.error('Usage: node scripts/control-plane-postgres.mjs [migrate|check]');
  process.exit(2);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required for explicit hosted Postgres control-plane operations. Secret value was not read or printed.');
  process.exit(2);
}

const pool = new Pool({
  connectionString,
  ssl: process.env.PAYIN_CLOUD_POSTGRES_SSL === 'false' ? undefined : { rejectUnauthorized: false },
  max: 2,
  connectionTimeoutMillis: 10_000,
});

try {
  if (command === 'migrate') await runPostgresControlPlaneMigrations(pool);
  const result = await pool.query('select 1 as ok');
  console.log(JSON.stringify({ ok: result.rows[0]?.ok === 1, command, secretsPrinted: false }, null, 2));
} finally {
  await pool.end();
}
