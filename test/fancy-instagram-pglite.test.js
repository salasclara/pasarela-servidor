'use strict';
// Embedded PostgreSQL engine: no production database or network calls.
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {createFancyDistributionStore}=require('../src/services/FancyDistributionStoreV1');
const {createCheckpointWorkflow}=require('../src/services/FancyInstagramCheckpointPreviewV1');
async function main(){
 const db=new PGlite();
 try{
  const store=createFancyDistributionStore(db);await store.migrate();
  const job={idempotencyKey:'ig-test-1',platform:'instagram',url:'https://example.test/',message:'Example',imageUrl:'https://example.test/image.jpg',status:'pending_review'};
  assert.equal((await store.enqueue(job)).inserted,true);assert.equal((await store.enqueue(job)).inserted,false);
  assert.equal(await store.saveContainer(job.idempotencyKey,'container-1'),null);
  await store.approve(job.idempotencyKey);
  const events=[];const adapter={async create(){events.push('create');return {ok:true,creationId:'container-1'};},async waitReady(){events.push('ready');return true;},async publish(){events.push('publish');throw Error('simulated timeout');}};
  const flow=createCheckpointWorkflow({store,adapter});
  assert.equal((await flow.send(job.idempotencyKey,{explicitAuthorization:true})).reason,'outcome_unknown');
  const state=await store.get(job.idempotencyKey);assert.equal(state.state,'outcome_unknown');assert.equal(state.instagram_creation_id,'container-1');
  assert.equal((await flow.send(job.idempotencyKey,{explicitAuthorization:true})).sent,false);
  assert.deepEqual(events,['create','ready','publish']);
  assert.equal(await store.saveContainer(job.idempotencyKey,'container-2'),null);
  const job2={...job,idempotencyKey:'ig-concurrency-test'};
  await store.enqueue(job2);await store.approve(job2.idempotencyKey);
  let createCount=0,publishCount=0;
  const concurrentAdapter={async create(){createCount++;return {ok:true,creationId:'container-2'};},async waitReady(){return true;},async publish(){publishCount++;return {ok:true,mediaId:'media-2'};}};
  const concurrentFlow=createCheckpointWorkflow({store,adapter:concurrentAdapter});
  const outcomes=await Promise.all([concurrentFlow.send(job2.idempotencyKey,{explicitAuthorization:true}),concurrentFlow.send(job2.idempotencyKey,{explicitAuthorization:true})]);
  assert.equal(outcomes.filter(x=>x.sent===true).length,1);assert.equal(createCount,1);assert.equal(publishCount,1);
  const completed=await store.get(job2.idempotencyKey);assert.equal(completed.state,'published');assert.equal(completed.external_post_id,'media-2');
  const job3={...job,idempotencyKey:'ig-interrupted-test'};
  await store.enqueue(job3);await store.approve(job3.idempotencyKey);assert.ok(await store.reserve(job3.idempotencyKey));
  assert.equal((await concurrentFlow.send(job3.idempotencyKey,{explicitAuthorization:true})).sent,false);
  assert.equal((await store.get(job3.idempotencyKey)).state,'sending');assert.equal(publishCount,1);
  console.log('PostgreSQL aislado: contenedor y protecciÃ³n de duplicados verificados');
 }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});

