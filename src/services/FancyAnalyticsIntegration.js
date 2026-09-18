'use strict';

const {
  createObservation,
  summarizeObservation,
} = require('./FancyAnalyticsObservation');

/**
 * Fancy Analytics Integration v1
 *
 * Safe bridge between the existing Fancy pipeline and Analytics Observation.
 * This module is deliberately passive:
 * - no DB writes
 * - no HTTP requests
 * - no publishing
 * - no scheduler changes
 * - no Amazon calls
 * - no learning/decision feedback
 *
 * The caller may provide an optional sink function. Until a persistent store
 * is approved, the default behavior only returns the normalized observation.
 */
async function observeFancyEvent(event = {}, options = {}) {
  const observation = createObservation(event);
  const summary = summarizeObservation(observation);

  if (typeof options.sink === 'function') {
    await options.sink(observation);
  }

  return Object.freeze({
    ok: true,
    observed: true,
    observation,
    summary,
    safeguards: Object.freeze({
      persistentWriteByDefault: false,
      publishesContent: false,
      changesScheduler: false,
      callsAmazon: false,
      learningEnabled: false,
    }),
  });
}

module.exports = {
  observeFancyEvent,
};
