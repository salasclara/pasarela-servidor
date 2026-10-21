'use strict';

// Drop-in integration for the existing Amar Es publisher. Disabled by default.
// Returns true when weekday handling is complete, including a deliberate skip.
const { createAmarEsRecycler } = require('./AmarEsRecycler');
function createAmarEsWeekdayGate(pool, fetchImpl) {
  const recycler = createAmarEsRecycler(pool, fetchImpl);
  return async function handleAmarEsWeekday(page, now = new Date()) {
    if (page.tipo !== 'amor' || process.env.AMAR_ES_REUSE_ENABLED !== 'true') return false;
    const day = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short' }).format(now);
    if (day === 'Sat' || day === 'Sun') return false;
    await recycler.ready;
    const count = await pool.query('SELECT COUNT(*)::int AS total FROM amar_es_reuse');
    if (count.rows[0].total === 0) {
      const imported = await recycler.importRecent(page);
      console.log('[AmarEs] Historical photo posts scanned:', imported);
    }
    const result = await recycler.publishReused(page);
    console.log('[AmarEs] Weekday recycling result:', result);
    return true; // Even if empty: no fallback to paid image generation.
  };
}
module.exports = { createAmarEsWeekdayGate };
