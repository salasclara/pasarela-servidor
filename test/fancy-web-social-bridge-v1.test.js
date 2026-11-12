'use strict';
const assert=require('node:assert/strict');
const {eligible,runBridge,FEED}=require('../src/services/FancyWebSocialBridgeV1');
const URL='https://www.fancybyroxette.com/home/orden-sin-desorden/';
const good={slug:'orden-sin-desorden',category:'HOME',status:'published',
  title:'Orden sin desorden',summary:'Una prueba de integración editorial.',
  url:URL,reviewed_by:'editor',approved_at:'2026-11-12T16:00:00Z',
  revision:1,distributionApproved:true};
const feed=(articles)=>({schema_version:1,category:'HOME',articles});
const html='<html><head><link rel="canonical" href="'+URL+'"><title>Orden sin desorden | Fancy By Roxette</title></head></html>';
function mockedFetch(articles,markup=html) {
  return async (url)=>{
    if(url===FEED)return {ok:true,json:async()=>feed(articles)};
    if(url===URL)return {ok:true,text:async()=>markup};
    throw Error('Unexpected URL '+url);
  };
}
function fakeStore(){
  const jobs=new Map();
  return {
    jobs,
    async enqueue(j){if(jobs.has(j.idempotencyKey))return {inserted:false};
      jobs.set(j.idempotencyKey,{state:'pending_review',payload:j});return {inserted:true};},
    async get(k){return jobs.get(k)||null;},
    async approve(k){const v=jobs.get(k);if(v.state==='pending_review')v.state='approved';return v;},
    async reserve(k){const v=jobs.get(k);if(v.state!=='approved')return null;v.state='sending';return v;},
    async markPublished(k,id){const v=jobs.get(k);v.state='published';v.external_post_id=id;return v;},
    async markUnknown(k){const v=jobs.get(k);v.state='outcome_unknown';return v;}
  };
}
async function main(){
  assert.equal(eligible(good),true);
  assert.equal(eligible({...good,distributionApproved:false}),false);
  assert.equal(eligible({...good,reviewed_by:null}),false);
  assert.equal(eligible({...good,url:'https://other.example/home/orden-sin-desorden/'}),false);
  assert.equal(eligible({...good,status:'draft'}),false);
  assert.equal(eligible({...good,revision:0}),false);
  const store=fakeStore();let sends=0;
  const adapter={async publish(){sends++;return {posted:true,externalPostId:'page_1'};}};
  const dry=await runBridge({fetchImpl:mockedFetch([good]),dryRun:true});
  assert.equal(dry.mode,'DRY_RUN');assert.equal(dry.results[0].wouldPost,false);
  assert.equal(store.jobs.size,0);
  const staged=await runBridge({fetchImpl:mockedFetch([good,{...good,slug:'unreviewed',distributionApproved:false}]),
    store,adapter,dryRun:false,autoSend:false});
  assert.equal(staged.mode,'LIVE_STAGE');assert.equal(staged.results[0].state,'pending_review');assert.equal(sends,0);
  const sent=await runBridge({fetchImpl:mockedFetch([good]),store,adapter,dryRun:false,autoSend:true});
  assert.equal(sent.results[0].state,'published');assert.equal(sends,1);
  const rerun=await runBridge({fetchImpl:mockedFetch([good]),store,adapter,dryRun:false,autoSend:true});
  assert.equal(rerun.results[0].posted,false);assert.equal(sends,1);
  const blocked=fakeStore();
  blocked.jobs.set('fancy-v1:facebook:HOME:orden-sin-desorden:1',{state:'outcome_unknown'});
  const bad=await runBridge({fetchImpl:mockedFetch([good]),store:blocked,adapter,dryRun:false,autoSend:true});
  assert.equal(bad.results[0].state,'outcome_unknown');assert.equal(sends,1);
  await assert.rejects(runBridge({fetchImpl:mockedFetch([good],'<title>Wrong</title>'),dryRun:true}),/not verified/);
  await assert.rejects(runBridge({fetchImpl:mockedFetch([good]),dryRun:true,autoSend:true}),/dry run/);
  console.log('Fancy V1 web-social bridge offline checks passed');
}
main().catch(e=>{console.error(e);process.exitCode=1});