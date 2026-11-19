'use strict';
// Read-only preview; no reservations, no fallback and no scheduler.
const {eligible,readFeed,verifyArticle}=require('./FancyWebSocialBridgeV1');
const {prepareFacebookJob}=require('./FancyFacebookDistributorV1');
async function previewSlot({fetchImpl=globalThis.fetch,store}={}){
 if(typeof fetchImpl!=='function'||!store||typeof store.get!=='function')throw TypeError('Fetch and store required');
 for(const e of await readFeed(fetchImpl)){
  if(!eligible(e))continue;
  const fb=prepareFacebookJob({status:'published',distributionApproved:true,revision:e.revision,
   category:e.category,slug:e.slug,title:e.title,summary:e.summary,publishedUrl:e.url});
  const igKey=fb.idempotencyKey.replace(':facebook:',':instagram:');
  const [facebook,instagram]=await Promise.all([store.get(fb.idempotencyKey),store.get(igKey)]);
  if(!facebook||facebook.platform!=='facebook'||facebook.state!=='approved'||
     !instagram||instagram.platform!=='instagram'||instagram.state!=='approved')continue;
  await verifyArticle(fetchImpl,e);
  return {available:true,slug:e.slug,articleUrl:e.url,facebookKey:fb.idempotencyKey,instagramKey:igKey,previewOnly:true};
 }
 return {available:false,previewOnly:true};
}
module.exports={previewSlot};

