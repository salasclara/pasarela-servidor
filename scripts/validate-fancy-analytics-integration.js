'use strict';

const assert = require('assert');
const { observeFancyEvent } = require('../src/services/FancyAnalyticsIntegration');

(async () => {
  let sinkCalls = 0;
  let received = null;

  const result = await observeFancyEvent({
    tipoEditorial: 'STYLE_FIND',
    categoria: 'bolsos',
    intencion: 'descubrir_algo_util',
    strategy: 'REAL_LIFESTYLE',
    headline: 'El bolso que lo cambia todo',
    subtitulo: 'Descubrimos piezas que transforman cualquier look',
    canal: 'facebook',
    horario: '3pm',
    estado: 'published',
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.observation.editorial.family, 'STYLE');
  assert.strictEqual(result.observation.publication.channel, 'facebook');
  assert.strictEqual(result.safeguards.persistentWriteByDefault, false);
  assert.strictEqual(result.safeguards.publishesContent, false);
  assert.strictEqual(result.safeguards.changesScheduler, false);
  assert.strictEqual(result.safeguards.callsAmazon, false);
  assert.strictEqual(result.safeguards.learningEnabled, false);

  await observeFancyEvent({ tipoEditorial: 'HOME_FIND' }, {
    sink: async (observation) => {
      sinkCalls += 1;
      received = observation;
    },
  });

  assert.strictEqual(sinkCalls, 1);
  assert.strictEqual(received.editorial.family, 'HOME');

  console.log('Fancy Analytics Integration v1 validation: OK');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
