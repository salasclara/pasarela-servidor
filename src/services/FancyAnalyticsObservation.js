'use strict';

/**
 * Fancy Analytics Engine v1 — Observation Mode
 *
 * Passive analytics layer for Fancy by Roxette.
 * It normalizes editorial/publication events so they can be persisted or
 * analyzed later without changing the decision, rendering, scheduler,
 * Amazon, or publishing pipelines.
 */

const FAMILIES = new Set(['STYLE', 'BEAUTY', 'HOME', 'TECH']);

function clean(value, max = 500) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function normalizeFamily(value) {
  const raw = clean(value, 80);
  if (!raw) return null;
  const family = raw.toUpperCase().replace(/_FIND$/, '');
  return FAMILIES.has(family) ? family : null;
}

function createObservation(input = {}) {
  const now = new Date();
  return Object.freeze({
    schemaVersion: 'fancy.analytics.observation.v1',
    mode: 'OBSERVATION',
    observedAt: now.toISOString(),

    editorial: Object.freeze({
      family: normalizeFamily(input.family || input.tipoEditorial),
      tipoEditorial: clean(input.tipoEditorial, 80),
      category: clean(input.category || input.categoria || input.tema, 160),
      intention: clean(input.intention || input.intencion, 160),
      visualStrategy: clean(input.visualStrategy || input.strategy, 160),
      headline: clean(input.headline || input.titulo, 300),
      microtext: clean(input.microtext || input.subtitulo, 500),
    }),

    publication: Object.freeze({
      channel: clean(input.channel || input.canal, 80),
      scheduledSlot: clean(input.scheduledSlot || input.horario, 80),
      status: clean(input.status || input.estado, 80),
      externalPostId: clean(input.externalPostId || input.postId, 200),
    }),

    commerce: Object.freeze({
      asin: clean(input.asin, 32),
      productTitle: clean(input.productTitle, 300),
      price: Number.isFinite(Number(input.price)) ? Number(input.price) : null,
      affiliateUrlPresent: Boolean(input.affiliateUrl || input.enlaceAfiliado),
    }),

    outcomes: Object.freeze({
      clicks: null,
      orders: null,
      shippedItems: null,
      revenue: null,
      commission: null,
    }),

    safeguards: Object.freeze({
      changesEditorialDecision: false,
      changesVisualEngine: false,
      changesScheduler: false,
      publishesContent: false,
      writesAmazonCatalog: false,
      learningEnabled: false,
    }),
  });
}

function summarizeObservation(observation) {
  const o = observation || {};
  return {
    schemaVersion: o.schemaVersion || null,
    mode: o.mode || 'OBSERVATION',
    family: o.editorial?.family || null,
    category: o.editorial?.category || null,
    channel: o.publication?.channel || null,
    status: o.publication?.status || null,
    hasProduct: Boolean(o.commerce?.asin || o.commerce?.productTitle),
    learningEnabled: false,
  };
}

module.exports = {
  createObservation,
  summarizeObservation,
  normalizeFamily,
};
