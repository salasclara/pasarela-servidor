'use strict';

const assert = require('assert');
const { createObservation } = require('../src/services/FancyAnalyticsObservation');
const {
  CREATE_SQL,
  ensureFancyAnalyticsTable,
  saveFancyObservation,
} = require('../src/services/FancyAnalyticsPersistence');

(async () => {
  assert(CREATE_SQL.includes('fancy_analytics_observations'));
  assert(!CREATE_SQL.includes('ALTER TABLE noticias'));
  assert(!CREATE_SQL.includes('fancy_product_catalog'));

  const calls = [];
  const pool = {
    query: async (sql, values) => {
      calls.push({ sql, values });
      if (/RETURNING id, created_at/.test(sql)) {
        return { rows: [{ id: 1, created_at: new Date().toISOString() }] };
      }
      return { rows: [] };
    },
  };

  await ensureFancyAnalyticsTable(pool);
  assert.strictEqual(calls.length, 1);

  const observation = createObservation({
    tipoEditorial: 'STYLE_FIND',
    categoria: 'bolsos',
    canal: 'facebook',
    estado: 'published',
  });

  const saved = await saveFancyObservation(pool, observation);
  assert.strictEqual(saved.id, 1);
  assert.strictEqual(calls.length, 2);
  assert(calls[1].sql.includes('INSERT INTO fancy_analytics_observations'));
  assert.strictEqual(calls[1].values[1], 'OBSERVATION');
  assert.strictEqual(calls[1].values[3], 'STYLE');

  await assert.rejects(
    () => saveFancyObservation(pool, { mode: 'LEARNING' }),
    /normalized OBSERVATION/
  );

  console.log('Fancy Analytics Persistence v1 validation: OK');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
