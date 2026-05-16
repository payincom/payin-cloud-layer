import { describe, expect, it } from 'vitest';
import {
  SqlQueryRecorder,
  applyCloudLayerSchema,
  getCloudLayerMinimalSchemaSql,
} from '../../src/index.js';

describe('SQL migration runner contract', () => {
  it('applies safe schema statements sequentially through the query executor', async () => {
    const db = new SqlQueryRecorder([]);

    await applyCloudLayerSchema(db, getCloudLayerMinimalSchemaSql());

    expect(db.queries.length).toBeGreaterThan(1);
    expect(db.queries[0].text).toContain('CREATE TABLE IF NOT EXISTS organizations');
    expect(db.queries.some((query) => query.text.includes('CREATE TABLE IF NOT EXISTS webhook_endpoints'))).toBe(true);
    expect(db.queries.at(-1)?.text).toContain('CREATE TABLE IF NOT EXISTS audit_events');
    expect(db.queries.every((query) => query.values.length === 0)).toBe(true);
  });

  it('rejects unsafe schema before executing any statement', async () => {
    const db = new SqlQueryRecorder([]);

    await expect(applyCloudLayerSchema(db, 'CREATE TABLE ok (id text); DROP TABLE users;')).rejects.toThrow(
      'Schema SQL contains forbidden statement: DROP'
    );
    expect(db.queries).toEqual([]);
  });
});
