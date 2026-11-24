'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {Client}=require('pg');
const {createFancyDistributionStore}=require('../src/services/FancyDistributionStoreV1');
const {prepareFacebookJob}=require('../src/services/FancyFacebookDistributorV1');
const {runWebSlot}=require('../src/services/FancyWebSlotExecutionPreviewV1');
const {FEED}=require('../src/services/FancyWebSocialBridgeV1');
const url='https://www.fancybyroxette.com/home/ejemplo/';
const entry={slug:'ejemplo',category:'HOME',status:'published',title:'Ejemplo',summary:'Una guÃ­a Ãºtil.',url,reviewed_by:'editora',approved_at:'2026-11-12',revision:1,distributionApproved:true};
const article={...entry,publishedUrl:url};
const bytes=Buffer.from('ffd8ffe000010203','hex'),imageUrl='https://www.fancybyroxette.com/images/home/ejemplo.jpg';
const fetchImpl=async u=>u===FEED?{ok:true,json:async()=>({schema_version:1,category:'HOME',articles:[entry]})}:u===imageUrl?new Response(bytes,{headers:{'content-type':'image/jpeg'}}):{ok:true,text:async()=>'<title>Ejemplo | Fancy By Roxette</title><link rel="canonical" href="'+url+'">'};
async function main(){
 const ci='postgresql://fancy_test:fancy_test_only@localhost:5432/fancy_ci';
 if(process.env.FANCY_TEST_DB!=='yes'||process.env.DATABASE_URL!==ci)throw Error('Disposable CI database required');
 const db=new Client({connectionString:ci});await db.connect();try{
  await db.query('BEGIN');await db.query('CREATE SCHEMA fancy_slot_ci');await db.query('SET LOCAL search_path TO fancy_slot_ci');
  const store=createFancyDistributionStore(db);await store.migrate();
  const fb=prepareFacebookJob(article),ig={...fb,idempotencyKey:fb.idempotencyKey.replace(':facebook:',':instagram:'),platform:'instagram',imageUrl,mediaReview:{sha256:crypto.createHash('sha256').update(bytes).digest('hex')}};
  await store.enqueue(fb);await store.enqueue(ig);await store.approve(fb.idempotencyKey);await store.approve(ig.idempotencyKey);
  let f=0,i=0;const facebookAdapter={async publish(){f++;return {posted:true,externalPostId:'fb-id'};}};
  const instagramAdapter={async create(){return {ok:true,creationId:'42'};},async waitReady(){return true;},async publish(){i++;return {ok:true,mediaId:'ig-id'};}};
  const input={fetchImpl,store,facebookAdapter,instagramAdapter};
  assert.equal((await runWebSlot(input)).state,'disabled');assert.equal(f,0);
  await assert.rejects(runWebSlot({...input,enabled:true}),/authorization/);
  assert.equal((await runWebSlot({...input,enabled:true,explicitAuthorization:true})).state,'published');
  assert.equal(f,1);assert.equal(i,1);
  const repeated=await runWebSlot({...input,enabled:true,explicitAuthorization:true});
  assert.equal(repeated.state,'no_candidate');assert.equal(repeated.fallbackAllowed,false);
  assert.equal(f,1);assert.equal(i,1);
  assert.equal((await runWebSlot({...input,enabled:true,explicitAuthorization:true,fetchImpl:async()=>{throw Error('offline');}})).fallbackAllowed,false);
  console.log('CoordinaciÃ³n web-first: prueba aislada correcta');
 }finally{try{await db.query('ROLLBACK');}finally{await db.end();}}
}
main().catch(e=>{console.error(e);process.exitCode=1});

