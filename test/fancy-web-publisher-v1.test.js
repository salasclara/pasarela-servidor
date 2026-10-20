'use strict';
const assert = require('node:assert/strict');
const { normalizeDraft, approveDraft, buildArticleUrl, publishApprovedArticle, makeSocialJobs } = require('../src/services/FancyWebPublisherV1');
const draft = { category:'HOME', slug:'ordenar-cocina-pequena', title:'Una cocina pequeña también puede sentirse espaciosa', summary:'Organización práctica', intro:'Una guía editorial', sections:[{heading:'Mide primero',body:'Comprueba las medidas antes de comprar.'}] };
async function run(){
  assert.equal(normalizeDraft(draft).slug, draft.slug);
  assert.throws(()=>approveDraft(draft,{reviewed_by:'editor',approved_at:new Date().toISOString()}), /incomplete/);
  assert.throws(()=>normalizeDraft({...draft,slug:'../danger'}), /slug/);
  const approved = approveDraft(draft,{productsVerified:true,imagesRightsReviewed:true,affiliateDisclosureReviewed:true,reviewed_by:'editor',approved_at:new Date().toISOString()});
  const url = buildArticleUrl(approved);
  assert.equal(url,'https://www.fancybyroxette.com/home/ordenar-cocina-pequena/');
  const adapter={publish:async(_article,target)=>({url:target}),verifyPublicUrl:async()=>true};
  const published=await publishApprovedArticle(approved,adapter);
  assert.equal(published.status,'published');
  await assert.rejects(()=>publishApprovedArticle(approved,{...adapter,verifyPublicUrl:async()=>false}),/not confirmed/);
  assert.throws(()=>makeSocialJobs(published,url),/approval required/);
  const jobs=makeSocialJobs({...published,distributionApproved:true,revision:1},url,['facebook','instagram','facebook']);
  assert.equal(jobs.length,2);
  assert.equal(jobs[0].status,'pending_review');
  assert.throws(()=>makeSocialJobs({...published,distributionApproved:true,revision:1},url+'/'),/canonical/);
  process.stdout.write('FancyWebPublisherV1 tests passed (offline, no publication)\n');
}
run().catch(e=>{console.error(e);process.exitCode=1});
