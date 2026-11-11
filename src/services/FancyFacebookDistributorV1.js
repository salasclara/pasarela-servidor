'use strict';
// Fancy V1: prepare web-first Facebook link posts. Not imported by server.js.
// Publication must be invoked explicitly; default adapter is a dry run.
const crypto=require('node:crypto');
const EXPECTED_ORIGIN='https://www.fancybyroxette.com';
const FANCY_PAGE_ID='2645809545432358';
function prepareFacebookJob(article){
  if(!article||article.status!=='published'||article.distributionApproved!==true)
    throw Error('Published and distribution-approved article required');
  if(!Number.isSafeInteger(article.revision)||article.revision<1)throw Error('Valid revision required');
  const title=String(article.title||'').trim(), summary=String(article.summary||'').trim();
  if(!title||title.length>180||!summary||summary.length>450)throw Error('Invalid editorial copy');
  const url=new URL(article.publishedUrl);
  if(url.origin!==EXPECTED_ORIGIN||url.search||url.hash||!/^\/(home|style|beauty|tech)\/[a-z0-9-]+\/$/.test(url.pathname))
    throw Error('Unapproved article URL');
  if(article.category?.toLowerCase()!==url.pathname.split('/')[1]||article.slug!==url.pathname.split('/')[2])
    throw Error('Article URL/category mismatch');
  const message=title+'\n\n'+summary+'\n\nLee la reseña completa en Fancy By Roxette:\n'+url.href+'\n\n#FancyByRoxette #FancyHome';
  const key='fancy-v1:facebook:'+article.category+':'+article.slug+':'+article.revision;
  return {idempotencyKey:key,platform:'facebook',pageId:FANCY_PAGE_ID,url:url.href,message,status:'pending_review'};
}
function createFacebookLinkAdapter({token,fetchImpl=globalThis.fetch,dryRun=true}={}){
  if(typeof fetchImpl!=='function')throw TypeError('fetch unavailable');
  async function publish(job,{approved=false}={}){
    if(!job||job.platform!=='facebook'||job.pageId!==FANCY_PAGE_ID||job.status!=='pending_review')
      throw Error('Invalid Fancy Facebook job');
    if(!approved)throw Error('Separate social approval required');
    if(dryRun)return {dryRun:true,jobKey:job.idempotencyKey,posted:false};
    if(!token)throw Error('Fancy Page token required');
    // Only call after persistent queue has reserved the idempotency key.
    const body=new URLSearchParams({message:job.message,link:job.url,access_token:token});
    const response=await fetchImpl('https://graph.facebook.com/v19.0/'+FANCY_PAGE_ID+'/feed',
      {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
    const data=await response.json();
    if(!response.ok||!data.id)throw Error('Facebook API rejected link publication (HTTP '+response.status+')');
    return {posted:true,externalPostId:data.id,jobKey:job.idempotencyKey};
  }
  return {publish};
}
module.exports={prepareFacebookJob,createFacebookLinkAdapter};
