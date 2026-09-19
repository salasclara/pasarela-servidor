'use strict';

/**
 * Fancy Analytics Read Summary v1
 * Read-only aggregation over observation rows.
 * No publishing, scheduler, Amazon, catalog, or learning side effects.
 */
function assertPool(pool) {
  if (!pool || typeof pool.query !== 'function') {
    throw new TypeError('Existing PASARELA_PG pool is required');
  }
}

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function createFancyAnalyticsReader(pool) {
  assertPool(pool);

  async function getSummary() {
    const [totals, families, channels, strategies] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::int AS observations,
               COUNT(*) FILTER (WHERE publication_status = 'published')::int AS published,
               COUNT(DISTINCT external_post_id) FILTER (WHERE external_post_id IS NOT NULL)::int AS unique_posts
        FROM fancy_analytics_observations
        WHERE mode = 'OBSERVATION'
      `),
      pool.query(`
        SELECT COALESCE(family, 'UNKNOWN') AS family, COUNT(*)::int AS observations
        FROM fancy_analytics_observations
        WHERE mode = 'OBSERVATION'
        GROUP BY COALESCE(family, 'UNKNOWN')
        ORDER BY observations DESC, family ASC
      `),
      pool.query(`
        SELECT COALESCE(channel, 'unknown') AS channel, COUNT(*)::int AS observations
        FROM fancy_analytics_observations
        WHERE mode = 'OBSERVATION'
        GROUP BY COALESCE(channel, 'unknown')
        ORDER BY observations DESC, channel ASC
      `),
      pool.query(`
        SELECT COALESCE(visual_strategy, 'unknown') AS visual_strategy, COUNT(*)::int AS observations
        FROM fancy_analytics_observations
        WHERE mode = 'OBSERVATION'
        GROUP BY COALESCE(visual_strategy, 'unknown')
        ORDER BY observations DESC, visual_strategy ASC
        LIMIT 12
      `)
    ]);

    const t = totals.rows[0] || {};
    return Object.freeze({
      schemaVersion: 'fancy.analytics.summary.v1',
      mode: 'OBSERVATION',
      totals: {
        observations: toInt(t.observations),
        published: toInt(t.published),
        uniquePosts: toInt(t.unique_posts)
      },
      byFamily: families.rows,
      byChannel: channels.rows,
      byVisualStrategy: strategies.rows,
      safeguards: {
        readOnly: true,
        changesEditorialDecision: false,
        changesVisualEngine: false,
        changesScheduler: false,
        publishesContent: false,
        callsAmazon: false,
        learningEnabled: false
      }
    });
  }

  return Object.freeze({ getSummary });
}

module.exports = { createFancyAnalyticsReader };
