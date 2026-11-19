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
  console.log('PostgreSQL aislado: contenedor y protecciÃ³n de duplicados verificados');
 }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});

