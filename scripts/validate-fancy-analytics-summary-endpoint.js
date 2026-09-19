'use strict';
const assert = require('assert');
const { createFancyAnalyticsSummaryHandler } = require('../src/services/FancyAnalyticsSummaryEndpoint');

(async () => {
  const pool = { query: async (sql) => {
    if (/COUNT\(DISTINCT external_post_id\)/.test(sql)) return { rows: [{ observations: 2, published: 1, unique_posts: 1 }] };
    if (/COALESCE\(family/.test(sql)) return { rows: [{ family: 'HOME', observations: 1 }] };
    if (/COALESCE\(channel/.test(sql)) return { rows: [{ channel: 'facebook', observations: 1 }] };
    if (/COALESCE\(visual_strategy/.test(sql)) return { rows: [{ visual_strategy: 'NO_MODEL', observations: 1 }] };
    throw new Error('Unexpected query');
  }};
  let status, headers, body='';
  const res={writeHead:(s,h)=>{status=s;headers=h;},end:x=>{body=x||'';}};
  const handled=await createFancyAnalyticsSummaryHandler(pool)({method:'GET'},res);
  assert.strictEqual(handled,true); assert.strictEqual(status,200);
  assert.strictEqual(headers['Cache-Control'],'no-store');
  const json=JSON.parse(body);
  assert.strictEqual(json.ok,true); assert.strictEqual(json.mode,'OBSERVATION');
  assert.strictEqual(json.totals.observations,2); assert.strictEqual(json.safeguards.readOnly,true);
  console.log('Fancy Analytics Summary Endpoint validation: OK');
})().catch(e=>{console.error(e);process.exit(1);});
