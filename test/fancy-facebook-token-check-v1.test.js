'use strict';
const assert=require('node:assert/strict');
const {checkPageToken}=require('../scripts/fancy-facebook-token-check-v1');
(async()=>{
 let calls=0;
 const fetchImpl=async(url,options)=>{
   calls++;
   assert.match(url,/v26\.0\/me\?fields=id,name/);
   assert.equal(options.method,'GET');
   assert.equal(options.headers.Authorization,'Bearer placeholder');
   return {ok:true,status:200,json:async()=>({id:'2645809545432358',name:'Fancy by Roxette'})};
 };
 const good=await checkPageToken({token:'placeholder',fetchImpl});
 assert.equal(good.pageMatches,true);
 assert.equal(good.http,200);
 assert.equal(calls,1);
 const user=await checkPageToken({token:'placeholder',fetchImpl:async()=>({ok:true,status:200,json:async()=>({id:'1234',name:'User'})})});
 assert.equal(user.pageMatches,false);
 const denied=await checkPageToken({token:'placeholder',fetchImpl:async()=>({ok:false,status:403,json:async()=>({error:{code:200,error_subcode:33,message:'Secret message'}})})});
 assert.equal(denied.http,403);
 assert.equal(denied.errorCode,200);
 assert.equal(JSON.stringify(denied).includes('Secret message'),false);
 await assert.rejects(checkPageToken({token:'',fetchImpl}),/required/);
 console.log('Fancy page-token read-only check passed');
})().catch(e=>{console.error(e);process.exitCode=1});