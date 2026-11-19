'use strict';
// Isolated integration: no scheduler, migrations or API requests on import.
const {runWebSlot}=require('./FancyWebSlotExecutionPreviewV1');
async function runReservedWebSlot({enabled=false,explicitAuthorization=false,date=new Date(),slotStore,execute=runWebSlot,executionOptions={}}={}){
 if(enabled!==true)return {state:'disabled'};
 if(explicitAuthorization!==true)throw Error('Social authorization required');
 if(!slotStore||!['reserve','finish'].every(k=>typeof slotStore[k]==='function')||typeof execute!=='function')throw TypeError('Slot store and executor required');
 const claim=await slotStore.reserve(date);
 if(!claim.claimed)return {state:'slot_already_claimed'};
 try{
  const result=await execute({...executionOptions,enabled:true,explicitAuthorization:true});
  const finalState=result?.state==='published'||result?.state==='no_candidate'?'completed':'outcome_unknown';
  const saved=await slotStore.finish(claim.key,claim.ownerToken,finalState);
  if(!saved)throw Error('Slot result not recorded');
  return {state:result?.state||'outcome_unknown',slotState:finalState};
 }catch(_){
  await slotStore.finish(claim.key,claim.ownerToken,'outcome_unknown');
  return {state:'outcome_unknown'};
 }
}
module.exports={runReservedWebSlot};

