'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadImage } = require('@napi-rs/canvas');
const { crearHistoriaEditorialPasarela } = require('../src/services/PasarelaStories');

test('portada editorial Scarlet Power 9:16 sin fotografía externa', async () => {
  const jpeg = await crearHistoriaEditorialPasarela({
    titulo: 'Rojo escarlata: el color que conquista el otoño',
    subtitulo: 'Una declaración de estilo',
    categoria: 'TENDENCIAS',
    tema: 'SCARLET POWER'
  });
  assert.ok(jpeg.length > 5000);
  const image = await loadImage(jpeg);
  assert.equal(image.width, 1080);
  assert.equal(image.height, 1920);
});

test('portada editorial exige titular', async () => {
  await assert.rejects(() => crearHistoriaEditorialPasarela({ titulo: '' }), /titular/);
});
