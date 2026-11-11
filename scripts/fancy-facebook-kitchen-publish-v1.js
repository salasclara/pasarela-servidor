'use strict';
// Manual, explicit distribution of a single already-published Fancy HOME article.
// No cron, no server.js import, no automatic migration, no implicit Meta publishing.
const {prepareFacebookJob,createFacebookLinkAdapter}=require('../src/services/FancyFacebookDistributorV1');
const {createFancyDistributionStore}=require('../src/services/FancyDistributionStoreV1');
const {createFancyFacebookWorkflow}=require('../src/services/FancyFacebookWorkflowV1');
const ARTICLE=Object.freeze({
  status:'published',distributionApproved:true,revision:1,
  category:'HOME',slug:'ordenar-cocina-pequena',
  title:'Una cocina pequeña también puede sentirse espaciosa',
  summary:'Ideas sencillas para liberar superficies y ordenar por hábitos.',
  publishedUrl:'https://www.fancybyroxette.com/home/ordenar-cocina-pequena/'
});
const CONFIRM='PUBLICAR-FANCY-COCINA-FACEBOOK-V1';
async function verifyPage(fetchImpl=globalThis.fetch) {
  const r=await fetchImpl(ARTICLE.publishedUrl,{method:'GET'});
  if(!r.ok)throw Error('Fancy article not available: HTTP '+r.status);
  const html=await r.text();
  if(!html.includes('<title>'+ARTICLE.title+' | Fancy By Roxette</title>'))
    throw Error('Published page did not match reviewed kitchen title');
}
async function run({env=process.env,fetchImpl=globalThis.fetch,PoolImpl}={}) {
  const job=prepareFacebookJob(ARTICLE);
  const live=env.FANCY_FB_LIVE==='yes';
  if(!live) {
    console.log(JSON.stringify({mode:'DRY_RUN',jobKey:job.idempotencyKey,articleUrl:job.url,message:job.message,posted:false},null,2));
    return {posted:false,mode:'DRY_RUN'};
  }
  if(env.FANCY_FB_CONFIRM!==CONFIRM)throw Error('Exact operator approval required: '+CONFIRM);
  if(!env.DATABASE_URL)throw Error('DATABASE_URL required for durable idempotency');
  if(env.FANCY_DB_MIGRATE!=='yes'&&!env.FANCY_BY_TOKEN)throw Error('FANCY_BY_TOKEN required for Fancy Facebook Page only');
  // Verify source before any persistence or Meta request.
  await verifyPage(fetchImpl);
  const PoolClass=PoolImpl||require('pg').Pool;
  const pool=new PoolClass({connectionString:env.DATABASE_URL,max:2});
  try {
    const store=createFancyDistributionStore(pool);
    // Migration is a separate deliberate step, not automatic in a posting command.
    if(env.FANCY_DB_MIGRATE==='yes'){
      await store.migrate();
      console.log('Fancy distribution table migration completed; nothing posted.');
      return {posted:false,mode:'MIGRATION'};
    }
    const fb=createFacebookLinkAdapter({token:env.FANCY_BY_TOKEN,dryRun:false,fetchImpl});
    const flow=createFancyFacebookWorkflow({store,adapter:fb});
    const staged=await flow.stage(ARTICLE);
    const state=await store.get(job.idempotencyKey);
    if(state?.state==='published') {
      console.log(JSON.stringify({posted:false,reason:'already-published',externalPostId:state.external_post_id}));
      return {posted:false,reason:'already-published'};
    }
    if(staged.inserted)console.log('One pending-review job created. Explicit approval step required.');
    if(env.FANCY_FB_APPROVE!=='yes'){
      console.log(JSON.stringify({posted:false,status:state?.state,key:job.idempotencyKey}));
      return {posted:false,reason:'awaiting-approval'};
    }
    if(state?.state==='pending_review')await flow.approve(job.idempotencyKey);
    else if(state?.state!=='approved')throw Error('Job not safely publishable: '+state?.state);
    const result=await flow.send(job,{explicitAuthorization:true});
    console.log(JSON.stringify(result));
    return result;
  } finally {await pool.end();}
}
if(require.main===module)run().catch(err=>{console.error(err.message);process.exitCode=1});
module.exports={run,verifyPage,ARTICLE,CONFIRM};
