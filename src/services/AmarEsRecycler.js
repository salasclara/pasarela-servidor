'use strict';

// Amar Es: reuse existing Facebook photo posts without calling any AI API.
// Requires a Page token with read and publish permissions and a persistent pg pool.
function createAmarEsRecycler(pool, fetchImpl = global.fetch) {
  const tableReady = pool.query(`
    CREATE TABLE IF NOT EXISTS amar_es_reuse (
      source_post_id TEXT PRIMARY KEY,
      message TEXT NOT NULL,
      image_url TEXT NOT NULL,
      original_date TIMESTAMPTZ,
      last_reused_at TIMESTAMPTZ,
      reused_count INTEGER NOT NULL DEFAULT 0,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  async function graph(path, token, options = {}) {
    const url = new URL('https://graph.facebook.com/v19.0/' + path);
    if (!options.method) {
      url.searchParams.set('access_token', token);
      for (const [key, value] of Object.entries(options.params || {})) url.searchParams.set(key, value);
    }
    const response = await fetchImpl(url.toString(), options.method ? {
      method: options.method,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...options.body, access_token: token }).toString()
    } : undefined);
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error?.message || 'Facebook HTTP ' + response.status);
    return data;
  }

  async function importRecent(page) {
    await tableReady;
    // Read a bounded number of the page's recent photo posts. Do not import videos.
    let after;
    let imported = 0;
    for (let batch = 0; batch < 5; batch++) {
      const params = { fields: 'id,message,full_picture,created_time,attachments{media_type}', limit: '100' };
      if (after) params.after = after;
      const result = await graph(page.id + '/posts', page.token, { params });
      for (const post of result.data || []) {
        const mediaType = post.attachments?.data?.[0]?.media_type;
        if (!post.full_picture || !post.message || mediaType !== 'photo') continue;
        // Do not immediately recycle recent originals or posts made by this recycler.
        if (!post.created_time || Date.now() - new Date(post.created_time).getTime() < 90 * 86400000) continue;
        await pool.query(`
          INSERT INTO amar_es_reuse (source_post_id,message,image_url,original_date)
          VALUES ($1,$2,$3,$4)
          ON CONFLICT (source_post_id) DO NOTHING
        `, [post.id, post.message, post.full_picture, post.created_time || null]);
        imported++;
      }
      after = result.paging?.cursors?.after;
      if (!result.paging?.next || !after) break;
    }
    return imported;
  }

  async function publishReused(page) {
    await tableReady;
    // The selected item is reserved transactionally so concurrent invocations
    // cannot choose the same item. The reservation is reverted on publish failure.
    const client = await pool.connect();
    let selected;
    try {
      await client.query('BEGIN');
      const selection = await client.query(`
        SELECT source_post_id,message,image_url FROM amar_es_reuse
        WHERE (last_reused_at IS NULL OR last_reused_at < NOW() - INTERVAL '90 days')
          AND (original_date IS NULL OR original_date < NOW() - INTERVAL '90 days')
          AND NOT EXISTS (
            SELECT 1 FROM amar_es_reuse
            WHERE last_reused_at >= (NOW() AT TIME ZONE 'America/Chicago')::date AT TIME ZONE 'America/Chicago'
          )
        ORDER BY last_reused_at ASC NULLS FIRST, original_date DESC NULLS LAST
        LIMIT 1 FOR UPDATE SKIP LOCKED
      `);
      selected = selection.rows[0];
      if (!selected) { await client.query('ROLLBACK'); return { published: false, reason: 'no_eligible_posts' }; }
      await client.query(`
        UPDATE amar_es_reuse SET last_reused_at=NOW(), reused_count=reused_count+1
        WHERE source_post_id=$1
      `, [selected.source_post_id]);
      // Publish inside the transaction to ensure failed attempts do not consume the post.
      // The DB row lock also protects against simultaneous schedulers.
      const result = await graph(page.id + '/photos', page.token, {
        method: 'POST',
        body: { url: selected.image_url, caption: selected.message, published: 'true' }
      });
      await client.query('COMMIT');
      return { published: true, id: result.id, source_post_id: selected.source_post_id };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw error;
    } finally {
      client.release();
    }
  }

  return { importRecent, publishReused, ready: tableReady };
}
module.exports = { createAmarEsRecycler };
