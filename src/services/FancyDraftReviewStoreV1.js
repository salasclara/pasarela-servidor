'use strict';
// Save AI drafts to a dedicated review branch only, never main or public web.
// Requires an already-existing review branch and explicit caller approval to save.
const {normalizeDraft}=require('./FancyWebPublisherV1');
const REVIEW_BRANCH='fancy-editorial-drafts';
function createFancyDraftReviewStore({token,fetchImpl=globalThis.fetch,dryRun=true}={}){
 if(typeof fetchImpl!=='function')throw TypeError('fetch required');
 const base='https://api.github.com/repos/salasclara/pasarela-servidor';
 const headers={'Authorization':'Bearer '+(token||''),'Accept':'application/vnd.github+json',
   'X-GitHub-Api-Version':'2022-11-28','User-Agent':'FancyEditorialDraftReview'};
 async function save(proposal){
   if(proposal?.status!=='draft'||proposal.requiresEditorialReview!==true||
     proposal.distributionApproved!==false||proposal.draft?.category!=='HOME')
     throw Error('Only unapproved HOME proposals can be saved');
   const draft=normalizeDraft(proposal.draft);
   const relative='editorial-drafts/'+draft.slug+'.json';
   if(dryRun)return {saved:false,dryRun:true,path:relative,branch:REVIEW_BRANCH};
   if(!token)throw Error('GitHub review token required');
   const path=base+'/contents/'+relative;
   const branchResp=await fetchImpl(base+'/branches/'+REVIEW_BRANCH,{headers});
   if(!branchResp.ok)throw Error('Dedicated review branch not available');
   const existing=await fetchImpl(path+'?ref='+encodeURIComponent(REVIEW_BRANCH),{headers});
   if(existing.status!==404)throw Error('Draft already exists or GitHub access denied; refusing overwrite');
   const payload=JSON.stringify(proposal,null,2)+'\n';
   const result=await fetchImpl(path,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},
     body:JSON.stringify({branch:REVIEW_BRANCH,message:'Stage Fancy HOME draft for editorial review: '+draft.slug,
       content:Buffer.from(payload,'utf8').toString('base64')})});
   if(!result.ok)throw Error('Draft review branch write failed: HTTP '+result.status);
   return {saved:true,dryRun:false,path:relative,branch:REVIEW_BRANCH};
 }
 return {save};
}
module.exports={REVIEW_BRANCH,createFancyDraftReviewStore};