'use strict';
const assert = require('node:assert/strict');
const { createAmarEsRecycler } = require('../services/AmarEsRecycler');
async function main() {
  const inserted = [];
  let calls = 0;
  const pool = { query: async (sql, values) => {
    if (sql.includes('INSERT INTO amar_es_reuse')) inserted.push(values);
    return { rows: [] };
  } };
  const recycler = createAmarEsRecycler(pool, async (url, options) => {
    calls++;
    assert.equal(new URL(url).searchParams.has('access_token'), false, 'No token in query URL');
    assert.equal(options.headers.Authorization, 'Bearer example-token');
    return { ok: true, json: async () => ({
      data: [
        { id: 'old-photo', message: 'Un mensaje', full_picture: 'https://example.org/a.jpg', created_time: '2025-01-01T00:00:00Z', attachments: { data: [{ media_type: 'photo' }] } },
        { id: 'new-photo', message: 'Reciente', full_picture: 'https://example.org/b.jpg', created_time: new Date().toISOString(), attachments: { data: [{ media_type: 'photo' }] } },
        { id: 'old-video', message: 'Video', full_picture: 'https://example.org/c.jpg', created_time: '2025-01-01T00:00:00Z', attachments: { data: [{ media_type: 'video' }] } }
      ]
    }) };
  });
  const imported = await recycler.importRecent({ id: 'page', token: 'example-token' });
  assert.equal(imported, 1);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0][0], 'old-photo');
  assert.equal(calls, 1);
  console.log('Amar Es import: old photos only, bearer authentication, no Facebook writes');
}
main().catch(err => { console.error(err); process.exitCode = 1; });
