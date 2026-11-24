'use strict';
// Isolated opt-in router. No timer, migration or network operations on import.
const {slotKey,createSlotReservationStore}=require('./FancySlotReservationPreviewV1');
const {createFancyDistributionStore}=require('./FancyDistributionStoreV1');
const {createFacebookLinkAdapter}=require('./FancyFacebookDistributorV1');
const {createMetaAdapter}=require('./FancyInstagramCheckpointPreviewV1');
const {runReservedWebSlot}=require('./FancyReservedWebSlotPreviewV1');
const CONFIRM='PUBLICAR-RESEÃ‘AS-WEB-APROBADAS';
async function routeFancySlot({env=process.env,pool,date=new Date(),scheduledHour,fetchImpl=globalThis.fetch,run=runReservedWebSlot}={}){
 if(env.FANCY_WEB_FIRST_MODE!=='yes')return {state:'disabled'};
 // When opted in, failures always skip Fancy. Never call the legacy publisher.
 if(env.FANCY_WEB_FIRST_CONFIRM!==CONFIRM||!env.FANCY_BY_TOKEN)return {state:'configuration_incomplete'};
 if(!pool||typeof pool.query!=='function'||typeof run!=='function')return {state:'configuration_incomplete'};
 let key;try{key=slotKey(date);}catch(_){return {state:'outside_window'};}
 if(![9,15,21].includes(scheduledHour)||Number(key.slice(-2))!==scheduledHour)return {state:'hour_mismatch'};
 const store=createFancyDistributionStore(pool);
 return run({enabled:true,explicitAuthorization:true,date,slotStore:createSlotReservationStore(pool),
  executionOptions:{fetchImpl,store,
   facebookAdapter:createFacebookLinkAdapter({token:env.FANCY_BY_TOKEN,fetchImpl,dryRun:false}),
   instagramAdapter:createMetaAdapter({enabled:true,fetchImpl})}});
}
module.exports={routeFancySlot,CONFIRM};

