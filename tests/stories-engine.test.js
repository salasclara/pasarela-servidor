'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { STORIES_BRANDS, configuracionStories } = require('../src/services/StoriesBrands');
const { horaCentral, crearClaveStory, evaluarHorarioStory } = require('../src/services/StoriesScheduler');

test('las cinco marcas existen y están desactivadas por defecto', () => {
  assert.deepEqual(Object.keys(STORIES_BRANDS).sort(), ['amar_es','fancy','maravillas','pasarela','rocimar'].sort());
  for (const marca of Object.keys(STORIES_BRANDS)) {
    assert.equal(configuracionStories(marca, {}).enabled, false);
    assert.equal(configuracionStories(marca, {}).ready, false);
  }
});

test('Pasarela se prepara con token y activación explícita', () => {
  const env = { STORIES_PASARELA_ENABLED: 'true', FACEBOOK_PAGE_TOKEN: 'token-ficticio' };
  const cfg = configuracionStories('pasarela', env);
  assert.equal(cfg.ready, true);
  assert.equal(cfg.horaCentral, 18);
});

test('cambio de horario Chicago verano e invierno', () => {
  assert.deepEqual(horaCentral(new Date('2026-07-01T23:05:00Z')), { dia: '2026-07-01', hora: 18, minuto: 5 });
  assert.deepEqual(horaCentral(new Date('2026-12-01T00:05:00Z')), { dia: '2026-11-30', hora: 18, minuto: 5 });
});

test('no programa sin autorización, ni fuera de la ventana', () => {
  assert.equal(evaluarHorarioStory('pasarela', new Date('2026-07-01T23:05:00Z'), {}).razon, 'DESACTIVADO');
  const env = { STORIES_PASARELA_ENABLED: 'true', FACEBOOK_PAGE_TOKEN: 'token-ficticio' };
  assert.equal(evaluarHorarioStory('pasarela', new Date('2026-07-01T23:05:00Z'), env).ejecutar, true);
  assert.equal(evaluarHorarioStory('pasarela', new Date('2026-07-01T23:15:00Z'), env).ejecutar, false);
  assert.equal(evaluarHorarioStory('amar_es', new Date('2026-07-01T23:05:00Z'), { STORIES_AMAR_ES_ENABLED: 'true', AMAR_ES_TOKEN: 'token' }).razon, 'SIN_HORARIO');
});

test('clave estable por marca, fecha y artículo', () => {
  assert.equal(crearClaveStory('pasarela','2026-10-28','nota-123'), 'pasarela:2026-10-28:nota-123');
  assert.notEqual(crearClaveStory('pasarela','2026-10-28','nota-123'), crearClaveStory('fancy','2026-10-28','nota-123'));
  assert.throws(() => crearClaveStory('pasarela','2026-10-28',''));
});
