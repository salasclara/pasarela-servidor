'use strict';
const assert=require('node:assert/strict');
const {routeFancySlot,CONFIRM}=require('../src/services/FancyWebFirstScheduleRouterPreviewV1');
async function main(){
 let runs=0;const pool={query:async()=>{throw Error('Unexpected query');}};
 const run=async input=>{runs++;assert.equal(input.enabled,true);return {state:'no_candidate'};};
 const base={pool,scheduledHour:9,date:new Date('2026-11-18T15:05:00Z'),run};
 assert.equal((await routeFancySlot({...base,env:{}})).state,'disabled');
 assert.equal((await routeFancySlot({...base,env:{FANCY_WEB_FIRST_MODE:'yes'}})).state,'configuration_incomplete');
 const env={FANCY_WEB_FIRST_MODE:'yes',FANCY_WEB_FIRST_CONFIRM:CONFIRM,FANCY_BY_TOKEN:'dummy'};
 assert.equal((await routeFancySlot({...base,env,scheduledHour:15})).state,'hour_mismatch');
 assert.equal((await routeFancySlot({...base,env,date:new Date('2026-11-18T15:15:00Z')})).state,'outside_window');
 assert.equal((await routeFancySlot({...base,env})).state,'no_candidate');assert.equal(runs,1);
 console.log('Router web-first: aislado y protegido por configuraciÃ³n');
}
main().catch(e=>{console.error(e);process.exitCode=1});

