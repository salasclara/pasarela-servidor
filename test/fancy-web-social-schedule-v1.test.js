'use strict';
const assert=require('node:assert/strict');
const {centralParts,shouldRun,scheduledCycle,startScheduler,CONFIRM}=require('../src/services/FancyWebSocialScheduleV1');
const t=(s)=>new Date(s);
async function main(){
  // Dallas DST: always use IANA timezone, not approximated month offsets.
  assert.deepEqual(centralParts(t('2026-11-12T16:15:00Z')),
    {day:'2026-11-12',hour:10,minute:15});
  assert.equal(centralParts(t('2026-07-12T15:15:00Z')).hour,10);
  assert.equal(shouldRun(t('2026-11-12T16:15:00Z'),null),true);
  assert.equal(shouldRun(t('2026-11-12T16:15:00Z'),'2026-11-12'),false);
  assert.equal(shouldRun(t('2026-11-12T16:20:00Z'),null),false);
  let called=0,callback=null;
  const env={FANCY_WEB_SOCIAL_SCHEDULER_ENABLED:'yes'};
  const logger={info:()=>{},error:e=>{throw new Error(e)}};
  const s=startScheduler({env,now:()=>t('2026-11-12T16:15:00Z'),
    schedule:cb=>{callback=cb;return 123;},
    cycle:async()=>{called++;return {processed:0}},logger});
  assert.equal(s.enabled,true);
  await s.tick();await s.tick();
  assert.equal(called,1,'same day does not repeat');
  assert.equal(typeof callback,'function');
  assert.equal(startScheduler({env:{}}).enabled,false);
  assert.deepEqual(await scheduledCycle({env:{}}),{skipped:'disabled'});
  await assert.rejects(scheduledCycle({env:{...env,FANCY_WEB_SOCIAL_SEND_ENABLED:'yes'}}),/confirmation/);
  await assert.rejects(scheduledCycle({env:{...env,DATABASE_URL:'fake'}}),/page token missing/);
  let opened=0,closed=0,bridgeCalls=0,sendArg=null;
  class MockPool{
    constructor(){opened++;}
    async query(){return {rows:[]};}
    async end(){closed++;}
  }
  const tokenCheck=async()=>({pageMatches:true});
  const bridge=async opts=>{bridgeCalls++;sendArg=opts.autoSend;return {mode:'LIVE_STAGE',processed:0};};
  const stageEnv={...env,DATABASE_URL:'fake',FANCY_BY_TOKEN:'fake'};
  await scheduledCycle({env:stageEnv,PoolClass:MockPool,tokenCheck,bridge});
  assert.equal(sendArg,false);assert.equal(bridgeCalls,1);
  assert.equal(opened,1);assert.equal(closed,1);
  await assert.rejects(scheduledCycle({env:stageEnv,PoolClass:MockPool,
    tokenCheck:async()=>({pageMatches:false}),bridge}),/identity mismatch/);
  assert.equal(opened,1,'mismatched tokens never connect to DB');
  await scheduledCycle({env:{...stageEnv,FANCY_WEB_SOCIAL_SEND_ENABLED:'yes',
    FANCY_BRIDGE_CONFIRM:CONFIRM},PoolClass:MockPool,tokenCheck,bridge});
  assert.equal(sendArg,true);
  console.log('Fancy disabled-by-default Dallas-time scheduler gates passed');
}
main().catch(e=>{console.error(e);process.exitCode=1});