'use strict';

const { createObservation } = require('./FancyAnalyticsObservation');
const { saveFancyObservation } = require('./FancyAnalyticsPersistence');

function createFancyPublicationObserver(pool) {
  if (!pool || typeof pool.query !== 'function') throw new TypeError('Existing PASARELA_PG pool is required');

  async function observeFacebookPublication(input) {
    const observation = createObservation({
      tipoEditorial: input.tipoEditorial,
      categoria: input.category,
      intencion: input.intention,
      strategy: input.visualStrategy,
      headline: input.headline,
      subtitulo: input.microtext,
      canal: 'facebook',
      horario: input.scheduledSlot || null,
      estado: 'published',
      externalPostId: input.externalPostId || null,
      asin: input.asin || null,
      productTitle: input.productTitle || null,
      price: input.price || null,
      affiliateUrlPresent: Boolean(input.affiliateUrlPresent),
    });
    return saveFancyObservation(pool, observation);
  }

  return Object.freeze({ observeFacebookPublication });
}

module.exports = { createFancyPublicationObserver };
