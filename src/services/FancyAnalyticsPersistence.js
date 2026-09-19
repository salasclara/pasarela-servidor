'use strict';

/**
 * Fancy Analytics Persistence v1
 *
 * Isolated PostgreSQL persistence for normalized Fancy observations.
 * The caller supplies the existing pg Pool; this module never creates its own
 * connection and never touches noticias, Fancy catalog, scheduler, Amazon,
 * publishing, or learning decisions.
 */

const CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS fancy_analytics_observations (
    id BIGSERIAL PRIMARY KEY,
    schema_version VARCHAR(80) NOT NULL,
    mode VARCHAR(30) NOT NULL DEFAULT 'OBSERVATION',
    observed_at TIMESTAMPTZ NOT NULL,

    family VARCHAR(20),
    tipo_editorial VARCHAR(80),
    category TEXT,
    intention TEXT,
    visual_strategy TEXT,
    headline TEXT,
    microtext TEXT,

    channel VARCHAR(80),
    scheduled_slot VARCHAR(80),
    publication_status VARCHAR(80),
    external_post_id TEXT,

    asin VARCHAR(32),
    product_title TEXT,
    price NUMERIC(12,2),
    affiliate_url_present BOOLEAN NOT NULL DEFAULT FALSE,

    clicks INTEGER,
    orders INTEGER,
    shipped_items INTEGER,
    revenue NUMERIC(12,2),
    commission NUMERIC(12,2),

    observation_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_fancy_analytics_observed_at
    ON fancy_analytics_observations (observed_at DESC);
  CREATE INDEX IF NOT EXISTS idx_fancy_analytics_family_channel
    ON fancy_analytics_observations (family, channel);
  CREATE INDEX IF NOT EXISTS idx_fancy_analytics_asin
    ON fancy_analytics_observations (asin)
    WHERE asin IS NOT NULL;
`;

function assertPool(pool) {
  if (!pool || typeof pool.query !== 'function') {
    throw new TypeError('FancyAnalyticsPersistence requires a pg-compatible pool');
  }
}

async function ensureFancyAnalyticsTable(pool) {
  assertPool(pool);
  await pool.query(CREATE_SQL);
  return true;
}

async function saveFancyObservation(pool, observation) {
  assertPool(pool);
  if (!observation || observation.mode !== 'OBSERVATION') {
    throw new TypeError('A normalized OBSERVATION is required');
  }

  const e = observation.editorial || {};
  const p = observation.publication || {};
  const c = observation.commerce || {};
  const o = observation.outcomes || {};

  const sql = `
    INSERT INTO fancy_analytics_observations (
      schema_version, mode, observed_at,
      family, tipo_editorial, category, intention, visual_strategy, headline, microtext,
      channel, scheduled_slot, publication_status, external_post_id,
      asin, product_title, price, affiliate_url_present,
      clicks, orders, shipped_items, revenue, commission,
      observation_json
    ) VALUES (
      $1,$2,$3,
      $4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,
      $15,$16,$17,$18,
      $19,$20,$21,$22,$23,
      $24::jsonb
    )
    RETURNING id, created_at
  `;

  const values = [
    observation.schemaVersion,
    observation.mode,
    observation.observedAt,
    e.family, e.tipoEditorial, e.category, e.intention, e.visualStrategy, e.headline, e.microtext,
    p.channel, p.scheduledSlot, p.status, p.externalPostId,
    c.asin, c.productTitle, c.price, Boolean(c.affiliateUrlPresent),
    o.clicks, o.orders, o.shippedItems, o.revenue, o.commission,
    JSON.stringify(observation),
  ];

  const result = await pool.query(sql, values);
  return result.rows[0];
}

module.exports = {
  CREATE_SQL,
  ensureFancyAnalyticsTable,
  saveFancyObservation,
};
