'use strict';
// Fancy web-first bridge. No scheduler or server.js imports.
// Editorial-feed is the source; only independently reviewed, verified, expressly
// social-approved articles are eligible. Never auto-retry ambiguous Meta outcomes.
const {prepareFacebookJob,createFacebookLinkAdapter}=require('./FancyFacebookDistributorV1');
const {createFancyDistributionStore}=require('./FancyDistributionStoreV1');
const {createFancyFacebookWorkflow}=require('./FancyFacebookWorkflowV1');
const ORIGIN='https://www.fancybyroxette.com';
const FEED=ORIGIN+'/editorial-feed.json';
const PAGE='2645809545432358';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function eligible(entry) {
  if(!entry||entry.status!=='published'||entry.distributionApproved!==true||
    entry.category!=='HOME'||typeof entry.slug!=='string'||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug)||
    typeof entry.title!=='string'||!entry.title.trim()||
    typeof entry.summary!=='string'||!entry.summary.trim()||
    typeof entry.reviewed_by!=='string'||!entry.reviewed_by.trim()||
    typeof entry.approved_at!=='string'||!Number.isFinite(Date.parse(entry.approved_at))||
    !Number.isSafeInteger(entry.revision)||entry.revision<1) return false;
  return entry.url===ORIGIN+'/home/'+entry.slug+'/';
}
function asArticle(e) {
  return {status:'published',distributionApproved:true,revision:e.revision,
    category:'HOME',slug:e.slug,title:e.title,summary:e.summary,publishedUrl:e.url};
}
async function safeFetch(fetchImpl,url) {
  const r=await fetchImpl(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error('Public source unavailable: HTTP '+r.status);
  return r;
}
async function readFeed(fetchImpl) {
  const r=await safeFetch(fetchImpl,FEED);
  const f=await r.json();
  if(f?.schema_version!==1||f.category!=='HOME'||!Array.isArray(f.articles))
    throw new Error('Unrecognized Fancy editorial feed');
  return f.articles.slice(0,100);
}
async function verifyArticle(fetchImpl,entry) {
  const html=await (await safeFetch(fetchImpl,entry.url)).text();
  // Match the *actual* deployed title and canonical, not merely HTTP 200.
  if(!html.includes('<title>'+esc(entry.title)+' | Fancy By Roxette</title>')||
     !html.includes('rel="canonical" href="'+entry.url+'"'))
    throw new Error('Article title/canonical not verified: '+entry.slug);
}
async function runBridge({fetchImpl=globalThis.fetch,store=null,adapter=null,
  dryRun=true,autoSend=false,limit=5}={}) {
  if(typeof fetchImpl!=='function'||!Number.isInteger(limit)||limit<1||limit>25)
    throw new Error('Invalid bridge configuration');
  if(!dryRun&&(!store||!adapter))throw new Error('Live bridge requires PostgreSQL store and Facebook adapter');
  if(dryRun&&autoSend)throw new Error('Cannot send during dry run');
  const entries=await readFeed(fetchImpl);
  const results=[];
  for(const e of entries) {
    if(results.length>=limit)break;
    if(!eligible(e))continue;
    const job=prepareFacebookJob(asArticle(e));
    await verifyArticle(fetchImpl,e);
    if(dryRun){results.push({slug:e.slug,state:'DRY_RUN',wouldStage:true,wouldPost:false});continue;}
    const flow=createFancyFacebookWorkflow({store,adapter});
    await flow.stage(asArticle(e));
    const state=await store.get(job.idempotencyKey);
    if(state.state==='published'||state.state==='outcome_unknown'||state.state==='sending'||state.state==='failed'){
      results.push({slug:e.slug,state:state.state,posted:false});continue;
    }
    if(!autoSend){results.push({slug:e.slug,state:state.state,posted:false});continue;}
    if(state.state==='pending_review')await flow.approve(job.idempotencyKey);
    const sent=await flow.send(job,{explicitAuthorization:true});
    results.push({slug:e.slug,state:sent.sent?'published':'not_sent',posted:sent.sent===true});
  }
  return {mode:dryRun?'DRY_RUN':autoSend?'LIVE_SEND':'LIVE_STAGE',
    processed:results.length,results};
}
module.exports={FEED,eligible,readFeed,verifyArticle,runBridge};