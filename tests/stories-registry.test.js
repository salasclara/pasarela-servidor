'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reservarStory, marcarPublicada, marcarIncierta, consultarStory } = require('../src/services/StoriesRegistry');

test('reserva única: un segundo intento no publica de nuevo', async () => {
  const queries = [];
  const pool = { query: async (sql, args) => {
    queries.push({ sql, args });
    return { rowCount: queries.length === 1 ? 1 : 0 };
  }};
  const params = { clave:'pasarela:2026-10-28:abc', marca:'pasarela', contenidoId:'abc', fechaCentral:'2026-10-28' };
  assert.equal(await reservarStory(pool, params), true);
  assert.equal(await reservarStory(pool, params), false);
  assert.match(queries[0].sql, /ON CONFLICT \(clave\) DO NOTHING/);
});

test('resultado incierto queda bloqueado para revisión manual', async () => {
  const calls = [];
  const pool = { query: async (sql, args) => { calls.push({sql,args}); return {rowCount:1}; } };
  await marcarIncierta(pool,'clave','timeout Meta');
  assert.match(calls[0].sql, /estado='uncertain'/);
  assert.equal(calls[0].args[1], 'timeout Meta');
});

test('publicación confirmada guarda ID de Story', async () => {
  const calls = [];
  const pool = { query: async (sql,args) => {calls.push({sql,args}); return {rowCount:1};} };
  await marcarPublicada(pool,'clave','fb123');
  assert.equal(calls[0].args[1], 'fb123');
  assert.match(calls[0].sql, /estado='published'/);
  assert.rejects(() => marcarPublicada(pool,'clave',null));
});

test('consulta no encuentra historia inexistente', async () => {
  const pool = { query: async () => ({rows:[]}) };
  assert.equal(await consultarStory(pool,'sin-resultado'),null);
});
