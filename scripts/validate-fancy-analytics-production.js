'use strict';

const assert = require('assert');
const { createFancyAnalyticsProduction } = require('../src/services/FancyAnalyticsProduction');

(async () => {
  const calls = [];
  const pool = {
    query: async (sql, values) => {
      calls.push({ sql, values });
      if (/RETURNING id, created_at/.test(sql)) {
        return { rows: [{ id: 77, created_at: '2026-09-19T00:00:00.000Z' }] };
      }
      return { rows: [] };
    },
  };

  const analytics = createFancyAnalyticsProduction(pool);
  await analytics.ensureReady();
  const result = await analytics.saveControlledTest();

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.id, 77);
  assert.strictEqual(result.publishesContent, false);
  assert.strictEqual(result.schedulerConnected, false);
  assert.strictEqual(result.amazonConnected, false);
  assert.strictEqual(result.learningEnabled, false);
  assert(calls.some(c => /CREATE TABLE IF NOT EXISTS fancy_analytics_observations/.test(c.sql)));
  assert(calls.some(c => /INSERT INTO fancy_analytics_observations/.test(c.sql)));

  assert.throws(() => createFancyAnalyticsProduction(null), /PASARELA_PG pool/);

  console.log('Fancy Analytics Production Wiring v1 validation: OK');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
