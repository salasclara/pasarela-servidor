'use strict';
const assert = require('assert');
const { createFancyAnalyticsReader } = require('../src/services/FancyAnalyticsReader');

(async () => {
  const calls = [];
  const pool = { query: async (sql) => {
    calls.push(sql);
    if (/COUNT\(DISTINCT external_post_id\)/.test(sql)) return { rows: [{ observations: 4, published: 3, unique_posts: 3 }] };
    if (/COALESCE\(family/.test(sql)) return { rows: [{ family: 'STYLE', observations: 2 }, { family: 'HOME', observations: 2 }] };
    if (/COALESCE\(channel/.test(sql)) return { rows: [{ channel: 'facebook', observations: 4 }] };
    if (/COALESCE\(visual_strategy/.test(sql)) return { rows: [{ visual_strategy: 'NO_MODEL', observations: 3 }] };
    throw new Error('Unexpected query');
  }};
  const summary = await createFancyAnalyticsReader(pool).getSummary();
  assert.strictEqual(summary.mode, 'OBSERVATION');
  assert.strictEqual(summary.totals.observations, 4);
  assert.strictEqual(summary.totals.published, 3);
  assert.strictEqual(summary.totals.uniquePosts, 3);
  assert.strictEqual(summary.byFamily[0].family, 'STYLE');
  assert.strictEqual(summary.safeguards.readOnly, true);
  assert.strictEqual(summary.safeguards.learningEnabled, false);
  assert.strictEqual(calls.length, 4);
  assert(calls.every(sql => /^\s*SELECT/i.test(sql)));
  console.log('Fancy Analytics Reader validation: OK');
})().catch(e => { console.error(e); process.exit(1); });
