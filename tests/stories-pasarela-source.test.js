'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { obtenerArticuloPasarela, prepararStoryPasarela } = require('../src/services/StoriesPasarelaSource');

test('recupera un artículo ya publicado sin modificar noticias', async () => {
  const calls = [];
  const pool = { query: async (sql, args) => {
    calls.push({sql,args});
    return {rows:[{ titulo:'Moda en Dallas', slug:'moda-en-dallas', imagen:'https://example.com/cover.jpg', fuente:'Redacción', contenido:'Artículo editorial' }]};
  }};
  const a = await obtenerArticuloPasarela(pool, {slug:'moda-en-dallas'});
  assert.equal(a.idContenido, 'moda-en-dallas');
  assert.equal(a.verificado, false);
  assert.equal(a.derechosImagen, false);
  assert.match(a.url, /pasarelastudiointer.com/);
  assert.match(calls[0].sql, /WHERE slug = \$1 AND publicado = true/);
  assert.doesNotMatch(calls[0].sql, /\bfuente\b/);
  assert.match(calls[0].sql, /^SELECT/);
  assert.deepEqual(calls[0].args, ['moda-en-dallas']);
});

test('no permite un slug arbitrario o consulta de escritura', async () => {
  const pool = { query: async () => {throw new Error('no debería consultar');} };
  await assert.rejects(() => obtenerArticuloPasarela(pool, {slug:'x; DROP TABLE noticias'}));
});

test('sin artículo publicado devuelve null', async () => {
  const pool = { query: async () => ({rows:[]}) };
  assert.equal(await obtenerArticuloPasarela(pool, {slug:'inexistente'}), null);
});

test('prepara Story solamente con imagen y texto aprobados', () => {
  const articulo = { idContenido:'moda-en-dallas', titulo:'Moda en Dallas', url:'https://pasarelastudiointer.com/noticias/moda-en-dallas', imagenUrl:'https://example.com/tercero.jpg' };
  const imagenBuffer = Buffer.alloc(6000, 1);
  assert.throws(() => prepararStoryPasarela(articulo, { imagenBuffer, textoVerificado:true }), /aprobación/);
  assert.throws(() => prepararStoryPasarela(articulo, { imagenBuffer, imagenAprobada:true }), /aprobación/);
  assert.throws(() => prepararStoryPasarela(articulo, { imagenBuffer:Buffer.alloc(20), imagenAprobada:true, textoVerificado:true }), /autorizado/);
  const contenido = prepararStoryPasarela(articulo, { imagenBuffer, imagenAprobada:true, textoVerificado:true });
  assert.equal(contenido.origen, articulo.url);
  assert.equal(contenido.verificado, true);
  assert.equal(contenido.derechosImagen, true);
  assert.equal(contenido.imagenBuffer, imagenBuffer);
});
