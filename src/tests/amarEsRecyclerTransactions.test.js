'use strict';
const assert = require('node:assert/strict');
const { createAmarEsRecycler } = require('../services/AmarEsRecycler');

async function run() {
  const events = [];
  const source = { source_post_id: 'old-1', message: 'Reflexión de prueba', image_url: 'https://example.org/photo.jpg' };
  const client = {
    async query(sql) {
      if (sql.includes('pg_advisory_xact_lock')) { events.push('daily-lock'); return { rows: [] }; }
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') { events.push(sql); return { rows: [] }; }
      if (sql.includes('SELECT source_post_id')) return { rows: [source] };
      if (sql.includes('UPDATE amar_es_reuse')) { events.push('reserved'); return { rows: [] }; }
      return { rows: [] };
    },
    release() { events.push('released'); }
  };
  const pool = { query: async () => ({ rows: [] }), connect: async () => client };
  const page = { id: 'fake-page', token: 'fake-token' };

  const ok = createAmarEsRecycler(pool, async (url, options) => {
    assert.equal(options.method, 'POST');
    assert.ok(url.includes('/fake-page/photos'));
    assert.ok(options.body.includes('caption=Reflexi'));
    return { ok: true, json: async () => ({ id: 'new-post' }) };
  });
  const published = await ok.publishReused(page);
  assert.equal(published.published, true);
  assert.equal(published.id, 'new-post');
  assert.deepEqual(events, ['BEGIN', 'daily-lock', 'reserved', 'COMMIT', 'released']);

  events.length = 0;
  const failed = createAmarEsRecycler(pool, async () => ({
    ok: false, status: 403, json: async () => ({ error: { message: 'Permission denied' } })
  }));
  await assert.rejects(failed.publishReused(page), /Permission denied/);
  assert.deepEqual(events, ['BEGIN', 'daily-lock', 'reserved', 'ROLLBACK', 'released']);
  events.length = 0;
  const ambiguous = createAmarEsRecycler(pool, async () => { throw new Error('Socket timeout'); });
  await assert.rejects(ambiguous.publishReused(page), error => error.publishOutcomeUnknown === true);
  assert.deepEqual(events, ['BEGIN', 'daily-lock', 'reserved', 'COMMIT', 'released']);
  console.log('Amar Es recycler: success, rejection, and ambiguous timeout checks passed');
}
run().catch(err => { console.error(err); process.exitCode = 1; });
