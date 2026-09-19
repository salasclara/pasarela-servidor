'use strict';

/**
 * Read-only publication history for Fancy Analytics.
 * Defaults to 30 days and caps results to 100 rows.
 */
function assertPool(pool) {
  if (!pool || typeof pool.query !== 'function') throw new TypeError('Existing PASARELA_PG pool is required');
}
function clampDays(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : 30;
}
function clampLimit(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : 50;
}
function createFancyAnalyticsHistoryReader(pool) {
  assertPool(pool);
  async function getHistory(options = {}) {
    const days = clampDays(options.days);
    const limit = clampLimit(options.limit);
    const result = await pool.query(`
      SELECT id, observed_at, family, tipo_editorial, category, intention,
             visual_strategy, headline, microtext, channel, scheduled_slot,
             publication_status, external_post_id, asin, product_title, price,
             affiliate_url_present, clicks, orders, shipped_items, revenue, commission
      FROM fancy_analytics_observations
      WHERE mode = 'OBSERVATION'
        AND observed_at >= NOW() - ($1::int * INTERVAL '1 day')
      ORDER BY observed_at DESC, id DESC
      LIMIT $2
    `, [days, limit]);
    return Object.freeze({
      schemaVersion: 'fancy.analytics.history.v1',
      mode: 'OBSERVATION',
      days,
      count: result.rows.length,
      items: result.rows,
      safeguards: Object.freeze({
        readOnly: true,
        changesEditorialDecision: false,
        changesVisualEngine: false,
        changesScheduler: false,
        publishesContent: false,
        callsAmazon: false,
        learningEnabled: false
      })
    });
  }
  return Object.freeze({ getHistory });
}
module.exports = { createFancyAnalyticsHistoryReader };
