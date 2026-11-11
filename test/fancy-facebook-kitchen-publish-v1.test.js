'use strict';
const assert=require('node:assert/strict');
const {run,verifyPage,ARTICLE}=require('../scripts/fancy-facebook-kitchen-publish-v1');
(async()=>{
 const dry=await run({env:{},fetchImpl:()=>{throw Error('Dry-run cannot access network')},PoolImpl:class {constructor(){throw Error('Dry-run cannot access database')}}});
 assert.deepEqual(dry,{posted:false,mode:'DRY_RUN'});
 await assert.rejects(()=>run({env:{FANCY_FB_LIVE:'yes'},fetchImpl:()=>{throw Error('No network')}}),/operator approval/);
 await assert.rejects(()=>verifyPage(async()=>({ok:true,text:async()=>'<title>WRONG TITLE</title>'})),/did not match/);
 await assert.rejects(()=>verifyPage(async()=>({ok:false,status:404})),/not available/);
 let constructed=0,dbQueries=0;
 class MockPool {
  constructor(){constructed++}
  async query(sql,params=[]){
   dbQueries++;
   if(sql.includes('INSERT INTO'))return {rows:[{id:1,state:'pending_review'}]};
   if(sql.includes('SELECT idempotency_key'))return {rows:[{state:'pending_review'}]};
   throw Error('Unexpected DB call: '+sql);
  }
  async end(){}
 }
 const gated=await run({
   env:{FANCY_FB_LIVE:'yes',FANCY_FB_CONFIRM:'PUBLICAR-FANCY-COCINA-FACEBOOK-V1',DATABASE_URL:'test',FANCY_BY_TOKEN:'fake'},
   fetchImpl:async()=>({ok:true,text:async()=>'<title>'+ARTICLE.title+' | Fancy By Roxette</title>'}),
   PoolImpl:MockPool
 });
 assert.equal(gated.posted,false);
 assert.equal(gated.reason,'awaiting-approval');
 assert.equal(constructed,1);
 assert(dbQueries>0);
 console.log('Fancy manual publish gating test passed without Meta or real PostgreSQL.');
})().catch(e=>{console.error(e);process.exitCode=1});
