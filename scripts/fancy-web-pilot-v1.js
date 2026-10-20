'use strict';
// Manual pilot only. Does not load server.js, does not post to Meta or schedule jobs.
const fs=require('node:fs');
const path=require('node:path');
const {approveDraft,buildArticleUrl}=require('../src/services/FancyWebPublisherV1');
const {createGitHubWebAdapter}=require('../src/services/FancyGitHubWebAdapterV1');
async function main(){
 const file=process.env.FANCY_EDITORIAL_FILE||'test/fixtures/fancy-v1-sample.json';
 const root=path.resolve(__dirname,'..');
 const target=path.resolve(root,file);
 if(!target.startsWith(root+path.sep))throw new Error('Editorial file must remain inside repository');
 const draft=JSON.parse(fs.readFileSync(target,'utf8'));
 const reviewer=process.env.FANCY_APPROVED_BY;
 if(!reviewer)throw new Error('FANCY_APPROVED_BY is required');
 // Approval flags must be explicitly reviewed and present in the checked-in pilot fixture.
 const approved=approveDraft(draft,{productsVerified:draft.productsVerified,
   imagesRightsReviewed:draft.imagesRightsReviewed,
   affiliateDisclosureReviewed:draft.affiliateDisclosureReviewed,
   reviewed_by:reviewer,approved_at:new Date().toISOString()});
 const url=buildArticleUrl(approved);
 const live=process.env.FANCY_ENABLE_LIVE_PUBLISH==='yes';
 const adapter=createGitHubWebAdapter({token:process.env.FANCY_WEB_GITHUB_TOKEN,dryRun:!live});
 const result=await adapter.publish(approved,url);
 if(!live){console.log(JSON.stringify({mode:'DRY_RUN',url,path:result.path,htmlSHA256:result.hash,distributed:false}));return;}
 const verified=await adapter.waitUntilPublished(url);
 if(!verified)throw new Error('Created page not yet confirmed on Vercel. Social distribution blocked.');
 console.log(JSON.stringify({mode:'LIVE',url,path:result.path,htmlSHA256:result.hash,verified:true,distributed:false}));
}
main().catch(err=>{console.error(err.message);process.exitCode=1});
