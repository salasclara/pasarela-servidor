'use strict';

const assert = require('assert');
const {
  createObservation,
  summarizeObservation,
  normalizeFamily,
} = require('../src/services/FancyAnalyticsObservation');

assert.strictEqual(normalizeFamily('STYLE_FIND'), 'STYLE');
assert.strictEqual(normalizeFamily('beauty'), 'BEAUTY');
assert.strictEqual(normalizeFamily('GIFT_IDEA'), null);

const observation = createObservation({
  tipoEditorial: 'HOME_FIND',
  categoria: 'decoracion',
  intencion: 'descubrir_algo_util',
  strategy: 'REAL_LIFESTYLE',
  headline: 'Un detalle que transforma tu espacio',
  subtitulo: 'Ideas para un rincón con estilo',
  canal: 'facebook',
  horario: '3pm',
  estado: 'published',
});

assert.strictEqual(observation.mode, 'OBSERVATION');
assert.strictEqual(observation.editorial.family, 'HOME');
assert.strictEqual(observation.editorial.category, 'decoracion');
assert.strictEqual(observation.publication.channel, 'facebook');
assert.strictEqual(observation.safeguards.changesScheduler, false);
assert.strictEqual(observation.safeguards.publishesContent, false);
assert.strictEqual(observation.safeguards.learningEnabled, false);
assert.strictEqual(Object.isFrozen(observation), true);

const summary = summarizeObservation(observation);
assert.strictEqual(summary.family, 'HOME');
assert.strictEqual(summary.learningEnabled, false);

console.log('Fancy Analytics Observation v1 validation: OK');
