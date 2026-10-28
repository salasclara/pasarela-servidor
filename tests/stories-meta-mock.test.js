'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {publicarHistoriaFacebook}=require('../src/services/PasarelaStories');
const jpeg=Buffer.alloc(6000,0x44);
test('Meta simulado: sube foto no publicada y crea historia',async()=>{
 const calls=[];
 const fetchFn=async(url,opts)=>{
  calls.push({url,opts});
  return {ok:true,json:async()=>calls.length===1?{id:'photo123'}:{post_id:'story456'}};
 };
 const r=await publicarHistoriaFacebook({pageId:'160291140702239',pageToken:'ficticio',imageBuffer:jpeg,fetchFn});
 assert.deepEqual(r,{photoId:'photo123',storyId:'story456'});
 assert.match(calls[0].url,/\/photos$/);
 assert.equal(calls[0].opts.method,'POST');
 assert.equal(calls[0].opts.body.get('published'),'false');
 assert.match(calls[1].url,/\/photo_stories$/);
 assert.equal(new URLSearchParams(calls[1].opts.body).get('photo_id'),'photo123');
});
test('Meta simulado: error de carga no intenta publicar',async()=>{
 let calls=0;
 await assert.rejects(()=>publicarHistoriaFacebook({
  pageId:'160291140702239',pageToken:'ficticio',imageBuffer:jpeg,
  fetchFn:async()=>{calls++;return {ok:false,status:403,json:async()=>({error:{message:'Permiso insuficiente'}})}}
 }),/Permiso insuficiente/);
 assert.equal(calls,1);
});
test('Meta simulado: resultado sin post_id es error incierto',async()=>{
 let calls=0;
 await assert.rejects(()=>publicarHistoriaFacebook({
  pageId:'160291140702239',pageToken:'ficticio',imageBuffer:jpeg,
  fetchFn:async()=>{calls++;return {ok:true,json:async()=>calls===1?{id:'photo123'}:{success:true}};}
 }),/Error al publicar Historia/);
 assert.equal(calls,2);
});
test('rechaza versión Graph API manipulada antes de red',async()=>{
 await assert.rejects(()=>publicarHistoriaFacebook({pageId:'160291140702239',pageToken:'ficticio',imageBuffer:jpeg,graphVersion:'v26.0/evil'}),/Versión Graph API inválida/);
});
