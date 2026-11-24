'use strict';
// Explicit staging only; never approves, schedules or sends.
const {eligible,verifyArticle}=require('./FancyWebSocialBridgeV1');
const {prepareFacebookJob}=require('./FancyFacebookDistributorV1');
const {verifyReviewedImage}=require('./FancyReviewedImagePreviewV1');
async function stageReviewedWebArticle({entry,media,store,fetchImpl=globalThis.fetch}={}){
 if(!eligible(entry))throw Error('Published and social-approved article required');
 if(!store||typeof store.enqueue!=='function'||typeof fetchImpl!=='function')throw TypeError('Store and fetch required');
 if(!media||media.editorialApproved!==true||media.rightsReviewed!==true||
    typeof media.reviewedBy!=='string'||!media.reviewedBy.trim()||
    typeof media.reviewedAt!=='string'||!Number.isFinite(Date.parse(media.reviewedAt)))throw Error('Image review required');
 let u;try{u=new URL(media.url);}catch(_){throw Error('Invalid image URL');}
 if(u.origin!=='https://www.fancybyroxette.com'||u.username||u.password||u.search||u.hash||
    !/^\/(home|media|images)\/[a-zA-Z0-9/_-]+\.(png|jpe?g)$/i.test(u.pathname))throw Error('Image must be hosted on Fancy');
 const fb=prepareFacebookJob({status:'published',distributionApproved:true,revision:entry.revision,
  category:entry.category,slug:entry.slug,title:entry.title,summary:entry.summary,publishedUrl:entry.url});
 await verifyArticle(fetchImpl,entry);
 const checked=await verifyReviewedImage({url:u.href,sha256:media.sha256,fetchImpl});
 const ig={...fb,idempotencyKey:fb.idempotencyKey.replace(':facebook:',':instagram:'),platform:'instagram',
  imageUrl:u.href,mediaReview:{reviewedBy:media.reviewedBy.trim(),reviewedAt:media.reviewedAt,sha256:checked.sha256}};
 // Two independent jobs. If either write fails, both remain unsent and can be
 // staged again safely; uniqueness prevents overwriting the existing payload.
 const facebook=await store.enqueue(fb);const instagram=await store.enqueue(ig);
 return {facebook,instagram,facebookKey:fb.idempotencyKey,instagramKey:ig.idempotencyKey};
}
module.exports={stageReviewedWebArticle};

