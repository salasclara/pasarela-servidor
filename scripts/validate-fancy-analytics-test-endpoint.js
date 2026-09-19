'use strict';

const assert = require('assert');
const { createFancyAnalyticsTestHandler } = require('../src/services/FancyAnalyticsTestEndpoint');

function makeRes() {
  return {
    status: null, headers: {}, body: '',
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(status, headers) { this.status = status; Object.assign(this.headers, headers || {}); },
    end(body) { this.body = body || ''; },
  };
}

(async () => {
  let inserts = 0;
  const pool = {
    query: async (sql) => {
      if (/INSERT INTO fancy_analytics_observations/.test(sql)) {
        inserts += 1;
        return { rows: [{ id: 99, created_at: '2026-09-19T00:00:00.000Z' }] };
      }
      return { rows: [] };
    },
  };
  const handler = createFancyAnalyticsTestHandler(pool);

  let res = makeRes();
  assert.strictEqual(await handler({ method: 'GET', url: '/test-fancy-analytics-persistence' }, res), true);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(inserts, 0);
  assert.strictEqual(JSON.parse(res.body).writesObservation, false);

  res = makeRes();
  assert.strictEqual(await handler({ method: 'POST', url: '/test-fancy-analytics-persistence' }, res), true);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(inserts, 1);
  assert.strictEqual(JSON.parse(res.body).id, 99);

  res = makeRes();
  assert.strictEqual(await handler({ method: 'GET', url: '/other' }, res), false);

  console.log('Fancy Analytics controlled endpoint validation: OK');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
