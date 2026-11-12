'use strict';
// Fancy V1: after the HTML is verified on Vercel, list the review on HOME.
// This module never publishes anything by itself and never touches Railway scheduler.
const {normalizeDraft,buildArticleUrl}=require('./FancyWebPublisherV1');
const FEED_PATH='editorial-feed.json';
function createFancyFeedUpdater({token,repo='salasclara/fancy-by-roxette-web',branch='main',fetchImpl=globalThis.fetch,dryRun=true}={}){
 if(typeof fetchImpl!=='function')throw new TypeError('fetch required');
 if(!/^[\w.-]+\/[\w.-]+$/.test(repo)||!/^[\w.-]+$/.test(branch))throw new Error('Invalid destination');
 const api='https://api.github.com/repos/'+repo+'/contents/'+FEED_PATH;
 const headers={Authorization:'Bearer '+(token||''),Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'FancyFeedPublisherV1'};
 async function addPublished(article,{verified=false}={}){
   if(article?.status!=='published'||verified!==true||article.publishedUrl!==buildArticleUrl(article)||
      !article.reviewed_by||!article.approved_at)throw new Error('Verified published editorial approval required');
   const a=normalizeDraft(article);
   if(a.category!=='HOME')throw new Error('HOME pilot only');
   if(dryRun)return {dryRun:true,added:false,slug:a.slug};
   if(!token)throw new Error('Destination token required');
   const response=await fetchImpl(api+'?ref='+encodeURIComponent(branch),{headers});
   if(!response.ok)throw new Error('Editorial feed read failed: HTTP '+response.status);
   const file=await response.json();
   if(!file.sha||!file.content)throw new Error('Missing feed revision');
   let feed;
   try{feed=JSON.parse(Buffer.from(file.content.replace(/\s/g,''),'base64').toString('utf8'))}catch(_){throw new Error('Invalid existing editorial feed')}
   if(feed.schema_version!==1||feed.category!=='HOME'||!Array.isArray(feed.articles))throw new Error('Unsupported editorial feed schema');
   const existing=feed.articles.find(x=>x.slug===a.slug);
   if(existing){
     if(existing.status==='published'&&existing.title===a.title)return {added:false,alreadyListed:true,slug:a.slug};
     throw new Error('Article slug already exists in editorial feed; manual review required');
   }
   const socialApproved=article.distributionApproved===true;
   if(socialApproved&&(!Number.isSafeInteger(article.revision)||article.revision<1))
     throw new Error('Social approval requires positive revision');
   const entry={...a,status:'published',url:article.publishedUrl,reviewed_by:article.reviewed_by,approved_at:article.approved_at,
     revision:socialApproved?article.revision:null,distributionApproved:socialApproved};
   const next={...feed,articles:[entry,...feed.articles]};
   const saved=await fetchImpl(api,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},
     body:JSON.stringify({message:'List reviewed Fancy HOME article '+a.slug,branch,sha:file.sha,
       content:Buffer.from(JSON.stringify(next,null,2)+'\n','utf8').toString('base64')})});
   if(!saved.ok)throw new Error('Editorial feed update failed: HTTP '+saved.status);
   return {added:true,slug:a.slug};
 }
 return {addPublished};
}
module.exports={createFancyFeedUpdater};
