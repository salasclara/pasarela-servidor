'use strict';
const assert=require('node:assert/strict');
const {createFancyFacebookWorkflow}=require('../src/services/FancyFacebookWorkflowV1');
const article={status:'published',distributionApproved:true,revision:1,category:'HOME',slug:'ordenar-cocina-pequena',title:'Una cocina pequeña también puede sentirse espaciosa',summary:'Ideas sencillas para liberar superficies.',publishedUrl:'https://www.fancybyroxette.com/home/ordenar-cocina-pequena/'};
(async()=>{
 let status='absent',posts=0;const store={
  async enqueue(){if(status!=='absent')return {inserted:false};status='pending_review';return {inserted:true}},
  async approve(){if(status!=='pending_review')return null;status='approved';return {state:status}},
  async reserve(){if(status!=='approved')return null;status='sending';return {id:1}},
  async markPublished(_key,id){if(status!=='sending')return null;status='published';return {state:status,external_post_id:id}},
  async markUnknown(){status='outcome_unknown';return {state:status}},
  async get(){return {state:status}}
 };
 const adapter={async publish(){posts++;return {posted:true,externalPostId:'2645809545432358_42'}}};
 const workflow=createFancyFacebookWorkflow({store,adapter});
 const {job}=await workflow.stage(article);
 await assert.rejects(()=>workflow.send(job),/authorization/);
 assert.equal(posts,0);
 await workflow.approve(job.idempotencyKey);
 assert.deepEqual(await workflow.send(job,{explicitAuthorization:true}),{sent:true,externalPostId:'2645809545432358_42'});
 assert.equal((await workflow.send(job,{explicitAuthorization:true})).sent,false);
 assert.equal(posts,1);
 console.log('Fancy workflow sends one authorized job in offline tests; no Meta call.');
})().catch(e=>{console.error(e);process.exitCode=1});
