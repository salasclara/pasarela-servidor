'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { procesarStoryAprobada } = require('../src/services/StoriesPipeline');

test('sin aprobación no escribe en PostgreSQL ni publica', async () => {
  let queries = 0, publications = 0;
  const pool = { query: async () => { queries++; return {rowCount:1}; } };
  const r = await procesarStoryAprobada({
    pool, marca:'pasarela', idContenido:'abc',
    contenido:{titulo:'Moda',verificado:false,derechosImagen:true},
    env:{STORIES_PASARELA_ENABLED:'true',FACEBOOK_PAGE_TOKEN:'token-ficticio'},
    publicar:true, publicarFn:async () => {publications++;return {storyId:'123'};}
  });
  assert.equal(r.razon,'SIN_APROBACION_EDITORIAL');
  assert.equal(queries,0);
  assert.equal(publications,0);
});

test('sin token no reserva ni publica', async () => {
  let queries=0;
  const pool={query:async()=>{queries++;return {rowCount:1};}};
  const r=await procesarStoryAprobada({
    pool,marca:'pasarela',idContenido:'abc',
    contenido:{titulo:'Moda',verificado:true,derechosImagen:true},
    env:{STORIES_PASARELA_ENABLED:'true'},publicar:true
  });
  assert.equal(r.razon,'CREDENCIALES_INCOMPLETAS');
  assert.equal(queries,0);
});

test('imagen inválida no reserva', async () => {
  let queries=0;
  const pool={query:async()=>{queries++;return {rowCount:1};}};
  await assert.rejects(() => procesarStoryAprobada({
    pool,marca:'pasarela',idContenido:'abc',
    contenido:{titulo:'Moda',imagenBuffer:Buffer.alloc(10),origen:'editorial',verificado:true,derechosImagen:true},
    env:{STORIES_PASARELA_ENABLED:'true',FACEBOOK_PAGE_TOKEN:'token-ficticio'},publicar:true
  }), /Imagen inválida/);
  assert.equal(queries,0);
});
