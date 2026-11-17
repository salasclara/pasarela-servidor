'use strict';
const assert = require('node:assert/strict');
const { createAmarEsWeekdayGate } = require('../services/AmarEsWeekdayGate');
const pool = { query: async () => ({ rows: [{ total: 1 }] }), connect: async () => ({ query: async sql => sql.includes('SELECT source_post_id') ? { rows: [] } : { rows: [] }, release() {} }) };
async function main() {
  let networkCalls = 0;
  const gate = createAmarEsWeekdayGate(pool, async () => { networkCalls++; throw Error('Unexpected network'); });
  const page = { tipo: 'amor', id: 'fake', token: 'fake' };
  const old = process.env.AMAR_ES_REUSE_ENABLED;
  try {
    process.env.AMAR_ES_REUSE_ENABLED = 'true';
    assert.equal(await gate(page, new Date('2026-10-24T15:00:00Z')), false, 'Saturday should use original generator');
    assert.equal(await gate(page, new Date('2026-10-26T15:00:00Z')), true, 'Monday should use recycling path');
    assert.equal(await gate({ tipo: 'fe' }, new Date('2026-10-26T15:00:00Z')), false, 'Other pages unchanged');
    process.env.AMAR_ES_REUSE_ENABLED = 'false';
    assert.equal(await gate(page, new Date('2026-10-26T15:00:00Z')), false, 'Feature disabled by default');
    assert.equal(networkCalls, 0);
    console.log('Amar Es weekday gate: all offline checks passed');
  } finally {
    if (old === undefined) delete process.env.AMAR_ES_REUSE_ENABLED;
    else process.env.AMAR_ES_REUSE_ENABLED = old;
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
