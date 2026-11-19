'use strict';
// Simulation-ready checkpoint orchestration. No scheduler or Meta calls on import.
// Adapters must independently verify container readiness before publishing.
const {createImageContainer,publishContainer,validateInstagramConfig}=require('./FancyInstagramPublisher');
const {verifyReviewedImage}=require('./FancyReviewedImagePreviewV1');
function createCheckpointWorkflow({store,adapter}={}){
 if(!store||!['reserve','saveContainer','markPublished','markUnknown'].every(k=>typeof store[k]==='function')||
    !adapter||!['create','waitReady','publish'].every(k=>typeof adapter[k]==='function'))
   throw TypeError('Store and complete Instagram adapter required');
 return {async send(key,{explicitAuthorization=false}={}){
  if(explicitAuthorization!==true)throw Error('Social authorization required');
  if(typeof key!=='string'||!key)throw Error('Job key required');
  const row=await store.reserve(key);
  if(!row)return {sent:false,reason:'not-approved-or-already-claimed'};
  try{
   const job=row.payload;
   if(!job||job.platform!=='instagram'||job.idempotencyKey!==key||!job.imageUrl)
     throw Error('Invalid queued payload');
   const created=await adapter.create(job);
   if(!created||created.ok!==true||typeof created.creationId!=='string'||!created.creationId.trim())
     throw Error('Container creation unconfirmed');
   // If persistence is uncertain, do not call publish; leave for reconciliation.
   if(!await store.saveContainer(key,created.creationId))throw Error('Container checkpoint not confirmed');
   if(await adapter.waitReady(created.creationId)!==true)throw Error('Container not confirmed ready');
   const published=await adapter.publish(created.creationId);
   if(!published||published.ok!==true||typeof published.mediaId!=='string'||!published.mediaId.trim())
     throw Error('Media publication unconfirmed');
   if(!await store.markPublished(key,published.mediaId))throw Error('Publication checkpoint not confirmed');
   return {sent:true,mediaId:published.mediaId};
  }catch(_){
   await store.markUnknown(key,'Instagram outcome requires manual reconciliation');
   return {sent:false,reason:'outcome_unknown'};
  }
 }};
}
function createMetaAdapter({enabled=false,fetchImpl=globalThis.fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms)),attempts=5}={}){
 if(typeof fetchImpl!=='function'||typeof sleep!=='function'||!Number.isInteger(attempts)||attempts<1||attempts>10)
   throw TypeError('Invalid Instagram adapter configuration');
 function check(){if(!enabled)throw Error('Instagram adapter disabled');const c=validateInstagramConfig();if(!c.ok)throw Error('Instagram config missing');return c.config;}
 return {
  async create(job){check();await verifyReviewedImage({url:job.imageUrl,sha256:job.mediaReview?.sha256,fetchImpl});return createImageContainer({imageUrl:job.imageUrl,caption:job.message,fetchImpl});},
  async waitReady(creationId){
   const c=check();if(!/^\d+$/.test(creationId))throw Error('Invalid container ID');
   for(let i=0;i<attempts;i++){
    const r=await fetchImpl('https://graph.facebook.com/'+c.graphVersion+'/'+creationId+'?fields=status_code',{
     method:'GET',headers:{Authorization:'Bearer '+process.env.FANCY_BY_TOKEN},signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw Error('Container status unavailable');
    const j=await r.json();if(j.status_code==='FINISHED')return true;
    if(['ERROR','EXPIRED'].includes(j.status_code))return false;
    if(i+1<attempts)await sleep(2000);
   }return false;
  },
  async publish(creationId){check();return publishContainer({creationId,fetchImpl});}
 };
}
module.exports={createCheckpointWorkflow,createMetaAdapter};

