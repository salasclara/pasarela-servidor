'use strict';

const { ensureFancyAnalyticsTable, saveFancyObservation } = require('./FancyAnalyticsPersistence');
const { createObservation } = require('./FancyAnalyticsObservation');

/**
 * Production wiring boundary for Fancy Analytics.
 * Receives the EXISTING pg Pool from server.js; never creates another Pool.
 * Safe until explicitly called by server.js.
 */
function createFancyAnalyticsProduction(pool) {
  if (!pool || typeof pool.query !== 'function') {
    throw new TypeError('Existing PASARELA_PG pool is required');
  }

  let readyPromise = null;

  function ensureReady() {
    if (!readyPromise) {
      readyPromise = ensureFancyAnalyticsTable(pool)
        .then(() => {
          console.log('[Fancy Analytics] Tabla verificada OK');
          return true;
        })
        .catch((error) => {
          readyPromise = null;
          console.error('[Fancy Analytics] Error verificando tabla:', error.message);
          throw error;
        });
    }
    return readyPromise;
  }

  async function saveControlledTest() {
    await ensureReady();
    const observation = createObservation({
      tipoEditorial: 'STYLE_FIND',
      categoria: 'analytics-controlled-test',
      intencion: 'validate_persistence',
      strategy: 'NO_VISUAL',
      headline: 'Fancy Analytics controlled test',
      subtitulo: 'No publication side effects',
      canal: 'internal_test',
      horario: 'manual',
      estado: 'test',
    });
    const saved = await saveFancyObservation(pool, observation);
    return {
      ok: true,
      id: saved.id,
      createdAt: saved.created_at,
      controlledTest: true,
      publishesContent: false,
      schedulerConnected: false,
      amazonConnected: false,
      learningEnabled: false,
    };
  }

  return Object.freeze({
    ensureReady,
    saveControlledTest,
  });
}

module.exports = { createFancyAnalyticsProduction };
