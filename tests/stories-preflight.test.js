'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {diagnosticarStory}=require('../src/services/StoriesPreflight');
test('diagnóstico sin activar: no filtra token',()=>{
 const env={FACEBOOK_PAGE_TOKEN:'SECRET-NO-MOSTRAR'};
 const r=diagnosticarStory('pasarela',env,new Date('2026-10-28T23:05:00Z'));
 assert.equal(r.activada,false);
 assert.equal(r.preparadaLocalmente,false);
 assert.equal(r.metaVerificado,false);
 assert.equal(JSON.stringify(r).includes('SECRET-NO-MOSTRAR'),false);
});
test('diagnóstico local no implica permisos Meta ni scheduler activo',()=>{
 const env={STORIES_PASARELA_ENABLED:'true',FACEBOOK_PAGE_TOKEN:'SECRET-NO-MOSTRAR'};
 const r=diagnosticarStory('pasarela',env,new Date('2026-10-28T23:05:00Z'));
 assert.equal(r.preparadaLocalmente,true);
 assert.equal(r.horario,'EN_VENTANA');
 assert.equal(r.metaVerificado,false);
 assert.equal(r.publicacionAutomaticaActiva,false);
});
