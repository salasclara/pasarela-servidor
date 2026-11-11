'use strict';
// Real PostgreSQL integration test. Runs only against a dedicated test database.
// The test creates an isolated schema, then removes it. No Railway credentials.
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const {createFancyDistributionStore}=require('../src/services/FancyDistributionStoreV1');
const {prepareFacebookJob}=require('../src/services/FancyFacebookDistributorV1');
const {createFancyFacebookWorkflow}=require('../src/services/FancyFacebookWorkflowV1');
(async()=>{
 if(process.env.FANCY_TEST_DB!=='yes'||!process.env.DATABASE_URL)
   throw Error('Dedicated FANCY_TEST_DB=yes and DATABASE_URL are required');
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:3});
 const schema='fancy_v1_ci_'+Date.now().toString(36);
 const client=await pool.connect();
 try{
   await client.query('BEGIN');
   await client.query('CREATE SCHEMA '+schema);
   await client.query('SET LOCAL search_path TO '+schema);
   const store=createFancyDistributionStore(client);
   await store.migrate();
   const article={status:'published',distributionApproved:true,revision:1,category:'HOME',
      slug:'ordenar-cocina-pequena',title:'Una cocina pequeña también puede sentirse espaciosa',
      summary:'Ideas para liberar superficies.',publishedUrl:'https://www.fancybyroxette.com/home/ordenar-cocina-pequena/'};
   const job=prepareFacebookJob(article);
   const attempts=await Promise.all([store.enqueue(job),store.enqueue(job)]);
   assert.equal(attempts.filter(x=>x.inserted).length,1,'Unique key must deduplicate');
   assert.equal(await store.reserve(job.idempotencyKey),null,'Approval gate');
   assert((await store.approve(job.idempotencyKey))?.id);
   const claims=await Promise.all([store.reserve(job.idempotencyKey),store.reserve(job.idempotencyKey)]);
   assert.equal(claims.filter(Boolean).length,1,'Atomic claim');
   assert.equal(claims.find(Boolean).payload.url,article.publishedUrl);
   assert((await store.markPublished(job.idempotencyKey,'fancy_page_post_123'))?.id);
   assert.equal((await store.get(job.idempotencyKey)).state,'published');
   assert.equal(await store.reserve(job.idempotencyKey),null,'Do not republish');
   // End-to-end approval and posting tests use a fake Meta adapter but real PostgreSQL state.
   const article2={...article,revision:2};
   const fakeJob=prepareFacebookJob(article2);
   let fakePosts=0;
   const workflow=createFancyFacebookWorkflow({store,adapter:{
     publish:async queued=>{
       assert.equal(queued.url,article.publishedUrl,'Only queued approved URL may be sent');
       fakePosts++;
       return {posted:true,externalPostId:'fake-meta-post-'+fakePosts};
     }
   }});
   await workflow.stage(article2);
   await assert.rejects(()=>workflow.send(fakeJob),/authorization/);
   await workflow.approve(fakeJob.idempotencyKey);
   const firstSend=await workflow.send({...fakeJob,url:'https://malicious.invalid'},{explicitAuthorization:true});
   assert.equal(firstSend.sent,true);
   assert.equal(firstSend.externalPostId,'fake-meta-post-1');
   const secondSend=await workflow.send(fakeJob,{explicitAuthorization:true});
   assert.equal(secondSend.sent,false);
   assert.equal(fakePosts,1,'No duplicate Meta calls');
   assert.equal((await store.get(fakeJob.idempotencyKey)).state,'published');
   await client.query('ROLLBACK'); // No persistent data in test DB.
   console.log('Real PostgreSQL schema, dedupe, approval and reservation test PASSED');
 }catch(error){
   try{await client.query('ROLLBACK')}catch(_){}
   throw error;
 }finally{client.release();await pool.end();}
})().catch(e=>{console.error(e);process.exitCode=1});
