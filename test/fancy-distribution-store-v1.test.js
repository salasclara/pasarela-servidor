'use strict';
const assert=require('node:assert/strict');
const {createFancyDistributionStore,DDL}=require('../src/services/FancyDistributionStoreV1');
const {prepareFacebookJob}=require('../src/services/FancyFacebookDistributorV1');
const article={status:'published',distributionApproved:true,revision:1,category:'HOME',slug:'ordenar-cocina-pequena',title:'Una cocina pequeña también puede sentirse espaciosa',summary:'Ideas sencillas para liberar superficies.',publishedUrl:'https://www.fancybyroxette.com/home/ordenar-cocina-pequena/'};
(async()=>{
 const state=new Map();
 const pool={async query(sql,params=[]){
   if(sql===DDL)return {rows:[]};
   const key=params[0];
   if(sql.includes('INSERT INTO')){
     if(state.has(key))return {rows:[]};
     state.set(key,{id:1,idempotency_key:key,platform:params[1],article_url:params[2],state:'pending_review'});
     return {rows:[{id:1,state:'pending_review'}]};
   }
   const row=state.get(key);if(!row)return {rows:[]};
   if(sql.includes("SET state='approved'")){if(row.state!=='pending_review')return {rows:[]};row.state='approved';return {rows:[{id:row.id,state:row.state}]};}
   if(sql.includes("SET state='sending'")){if(row.state!=='approved')return {rows:[]};row.state='sending';return {rows:[{idempotency_key:key,payload:{}}]};}
   if(sql.includes("SET state='published'")){if(row.state!=='sending')return {rows:[]};row.state='published';row.external_post_id=params[1];return {rows:[{id:row.id,state:row.state}]};}
   if(sql.includes("SET state='outcome_unknown'")){if(row.state!=='sending')return {rows:[]};row.state='outcome_unknown';row.last_error=params[1];return {rows:[{id:row.id,state:row.state}]};}
   if(sql.includes('SELECT idempotency_key'))return {rows:[row]};
   throw Error('Unexpected test query: '+sql);
 }};
 const store=createFancyDistributionStore(pool);
 await store.migrate();
 const job=prepareFacebookJob(article);
 assert.equal((await store.enqueue(job)).inserted,true);
 assert.equal((await store.enqueue(job)).inserted,false);
 assert.equal((await store.reserve(job.idempotencyKey)),null);
 assert.equal((await store.approve(job.idempotencyKey)).state,'approved');
 assert(await store.reserve(job.idempotencyKey));
 assert.equal(await store.reserve(job.idempotencyKey),null);
 assert.equal((await store.markPublished(job.idempotencyKey,'2645809545432358_abc')).state,'published');
 assert.equal(await store.reserve(job.idempotencyKey),null);
 assert.equal((await store.get(job.idempotencyKey)).external_post_id,'2645809545432358_abc');
 const second=prepareFacebookJob({...article,revision:2});
 await store.enqueue(second);await store.approve(second.idempotencyKey);await store.reserve(second.idempotencyKey);
 assert.equal((await store.markUnknown(second.idempotencyKey,new Error('timeout'))).state,'outcome_unknown');
 assert.equal(await store.reserve(second.idempotencyKey),null);
 assert(DDL.includes('UNIQUE'));
 console.log('Fancy distribution store offline state-machine tests passed; no database touched.');
})().catch(e=>{console.error(e);process.exitCode=1});
