'use strict';
// Isolated coordinator. Caller owns scheduling; importing this file does nothing.
const {previewSlot}=require('./FancyWebSlotSelectionPreviewV1');
const {createFancyFacebookWorkflow}=require('./FancyFacebookWorkflowV1');
const {createCheckpointWorkflow}=require('./FancyInstagramCheckpointPreviewV1');
const {verifyReviewedImage}=require('./FancyReviewedImagePreviewV1');
async function runWebSlot({enabled=false,explicitAuthorization=false,fetchImpl=globalThis.fetch,store,facebookAdapter,instagramAdapter}={}){
 if(enabled!==true)return {state:'disabled',fallbackAllowed:true};
 if(explicitAuthorization!==true)throw Error('Social authorization required');
 // Fail closed when feed or storage cannot be verified: caller must not
 // assume it is safe to publish another item in this time slot.
 let candidate;
 try{candidate=await previewSlot({fetchImpl,store});}
 catch(_){return {state:'selection_unavailable',fallbackAllowed:false};}
 // Without a durable slot claim, another process might already be sending.
 // Do not fall back to a second post even when no candidate is visible.
 if(!candidate.available)return {state:'no_candidate',fallbackAllowed:false};
 try{
  if(typeof store.getApprovedPayload!=='function')throw Error('Reviewed image unavailable');
  const payload=await store.getApprovedPayload(candidate.instagramKey);
  if(!payload||payload.idempotencyKey!==candidate.instagramKey||payload.platform!=='instagram')throw Error('Reviewed image unavailable');
  await verifyReviewedImage({url:payload.imageUrl,sha256:payload.mediaReview?.sha256,fetchImpl});
 }catch(_){return {state:'image_unverified',fallbackAllowed:false};}
 let facebook;
 try{
  const flow=createFancyFacebookWorkflow({store,adapter:facebookAdapter});
  facebook=await flow.send({idempotencyKey:candidate.facebookKey},{explicitAuthorization:true});
 }catch(_){return {state:'facebook_unconfirmed',fallbackAllowed:false};}
 if(!facebook.sent)return {state:'facebook_not_sent',fallbackAllowed:false};
 try{
  const flow=createCheckpointWorkflow({store,adapter:instagramAdapter});
  const instagram=await flow.send(candidate.instagramKey,{explicitAuthorization:true});
  if(!instagram.sent)return {state:'facebook_published_instagram_unconfirmed',fallbackAllowed:false};
  return {state:'published',fallbackAllowed:false};
 }catch(_){return {state:'facebook_published_instagram_unconfirmed',fallbackAllowed:false};}
}
module.exports={runWebSlot};

