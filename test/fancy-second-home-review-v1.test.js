'use strict';
// Second HOME article review: strict offline checks; never writes GitHub, DB or Meta.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {approveDraft,buildArticleUrl,publishApprovedArticle}=require('../src/services/FancyWebPublisherV1');
const {renderArticle,createGitHubWebAdapter}=require('../src/services/FancyGitHubWebAdapterV1');
const {prepareFacebookJob}=require('../src/services/FancyFacebookDistributorV1');
(async()=>{
 const draft=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/fancy-home-cajones-review-v1.json'),'utf8'));
 const approved=approveDraft(draft,{productsVerified:draft.productsVerified,
   imagesRightsReviewed:draft.imagesRightsReviewed,
   affiliateDisclosureReviewed:draft.affiliateDisclosureReviewed,
   reviewed_by:'ci-fixture-review',approved_at:'2026-11-12T20:00:00Z'});
 const url='https://www.fancybyroxette.com/home/organizar-cajones-cocina-sin-comprar/';
 assert.equal(buildArticleUrl(approved),url);
 const rendered=renderArticle(approved);
 assert.equal(rendered.url,url);
 assert.equal(rendered.path,'home/organizar-cajones-cocina-sin-comprar/index.html');
 assert.match(rendered.html,/Cómo organizar los cajones de la cocina sin comprar nada primero/);
 assert.match(rendered.html,/rel="canonical"/);
 assert.match(rendered.html,/name="robots" content="index,follow"/);
 assert.ok(rendered.html.includes('Este artículo no contiene enlaces de compra'));
 assert.ok(!rendered.html.includes('amazon.com'));
 let calls=0;
 const noNetwork=()=>{calls++;throw new Error('No network permitted');};
 const adapter=createGitHubWebAdapter({fetchImpl:noNetwork,dryRun:true});
 const fake=await adapter.publish(approved,url);
 assert.equal(fake.dryRun,true);
 assert.equal(fake.hash,rendered.hash);
 assert.equal(calls,0);
 assert.equal(await adapter.verifyPublicUrl(url),false);
 await assert.rejects(publishApprovedArticle(approved,adapter),/not confirmed publicly/);
 await assert.rejects(Promise.resolve().then(()=>prepareFacebookJob({...approved,status:'published',
   publishedUrl:url,revision:1,distributionApproved:false})),/distribution-approved/);
 console.log('Second Fancy HOME article validated and rendered offline, no web or social publishing');
})().catch(e=>{console.error(e);process.exitCode=1});