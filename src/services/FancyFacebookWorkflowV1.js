'use strict';
// Explicit single-job orchestration. Not imported by server.js; no cron.
const {prepareFacebookJob,createFacebookLinkAdapter}=require('./FancyFacebookDistributorV1');
function createFancyFacebookWorkflow({store,adapter}={}){
  if(!store||!['enqueue','approve','reserve','markPublished','markUnknown','get'].every(k=>typeof store[k]==='function'))
    throw TypeError('Distribution store required');
  if(!adapter||typeof adapter.publish!=='function')throw TypeError('Facebook adapter required');
  async function stage(article){
    const job=prepareFacebookJob(article);
    const result=await store.enqueue(job);
    return {...result,key:job.idempotencyKey,job};
  }
  async function approve(key){return store.approve(key);}
  async function send(job,{explicitAuthorization=false}={}){
    if(explicitAuthorization!==true)throw Error('Explicit operator authorization required');
    if(!job||typeof job.idempotencyKey!=='string')throw Error('Job required');
    const claimed=await store.reserve(job.idempotencyKey);
    if(!claimed)return {sent:false,reason:'not-approved-or-already-claimed'};
    try{
      const result=await adapter.publish(job,{approved:true});
      if(!result.posted||!result.externalPostId){
        await store.markUnknown(job.idempotencyKey,'No live external post ID; manual review required');
        return {sent:false,reason:'no-confirmed-post'};
      }
      const stored=await store.markPublished(job.idempotencyKey,result.externalPostId);
      if(!stored)throw Error('Facebook result received but persistence not confirmed');
      return {sent:true,externalPostId:result.externalPostId};
    }catch(error){
      await store.markUnknown(job.idempotencyKey,error);
      throw error;
    }
  }
  return {stage,approve,send};
}
module.exports={createFancyFacebookWorkflow};
