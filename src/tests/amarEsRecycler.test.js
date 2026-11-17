'use strict';
const assert = require('node:assert/strict');
const { createAmarEsRecycler } = require('../services/AmarEsRecycler');

async function run() {
  let published = false;
  const pool = {
    query: async () => ({ rows: [] }),
    connect: async () => ({
      query: async (sql) => sql.includes('SELECT source_post_id') ? { rows: [] } : { rows: [] },
      release() {}
    })
  };
  const recycler = createAmarEsRecycler(pool, async () => {
    published = true;
    throw Error('Unexpected network request');
  });
  const result = await recycler.publishReused({ id: 'test', token: 'test' });
  assert.equal(result.published, false);
  assert.equal(result.reason, 'no_eligible_posts');
  assert.equal(published, false);
  console.log('Amar Es recycler: empty library does not publish or call Facebook');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
