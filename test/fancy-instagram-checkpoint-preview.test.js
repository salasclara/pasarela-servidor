'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createCheckpointWorkflow,createMetaAdapter}=require('../src/services/FancyInstagramCheckpointPreviewV1');
function fixture({failCheckpoint=false,failPublish=false}={}){
 const log=[];let state='approved';let container=null;
 const store={async reserve(){if(state!=='approved')return null;state='sending';return {payload:{platform:'instagram',idempotencyKey:'k',imageUrl:'https://example.test/a.jpg'}};},
  async saveContainer(k,id){log.push('save');if(failCheckpoint)return null;container=id;return true;},
  async markPublished(){state='published';return true;},async markUnknown(){state='outcome_unknown';return true;}};
 const adapter={async create(){log.push('create');return {ok:true,creationId:'c1'};},async waitReady(){log.push('ready');return true;},
  async publish(){log.push('publish');if(failPublish)throw Error('timeout');return {ok:true,mediaId:'m1'};}};
 return {flow:createCheckpointWorkflow({store,adapter}),log,getState:()=>state,getContainer:()=>container};
}
async function main(){
 let f=fixture();assert.equal((await f.flow.send('k',{explicitAuthorization:true})).sent,true);
 assert.deepEqual(f.log,['create','save','ready','publish']);assert.equal(f.getContainer(),'c1');
 assert.equal((await f.flow.send('k',{explicitAuthorization:true})).sent,false);
 f=fixture({failCheckpoint:true});assert.equal((await f.flow.send('k',{explicitAuthorization:true})).reason,'outcome_unknown');
 assert.deepEqual(f.log,['create','save']);assert.equal(f.getState(),'outcome_unknown');
 f=fixture({failPublish:true});assert.equal((await f.flow.send('k',{explicitAuthorization:true})).reason,'outcome_unknown');
 assert.equal(f.getContainer(),'c1');assert.equal((await f.flow.send('k',{explicitAuthorization:true})).sent,false);
 process.env.FANCY_INSTAGRAM_USER_ID='123';process.env.FANCY_BY_TOKEN='test-token';let requests=[];
 const bytes=Buffer.from('ffd8ffe000010203','hex'),imageUrl='https://www.fancybyroxette.com/images/home/example.jpg';
 const fetchImpl=async(url,opts)=>{if(url===imageUrl)return new Response(bytes,{headers:{'content-type':'image/jpeg'}});requests.push({url,opts});return {ok:true,json:async()=>requests.length===1?{id:'42'}:requests.length===2?{status_code:'FINISHED'}:{id:'99'}};};
 const meta=createMetaAdapter({enabled:true,fetchImpl,sleep:async()=>{}});
 assert.equal((await meta.create({imageUrl,mediaReview:{sha256:crypto.createHash('sha256').update(bytes).digest('hex')},message:'texto'})).creationId,'42');
 assert.equal(await meta.waitReady('42'),true);assert.equal((await meta.publish('42')).mediaId,'99');
 assert.equal(requests.length,3);assert.equal(requests[1].opts.headers.Authorization,'Bearer test-token');
 assert.ok(!requests[1].url.includes('test-token'));
 delete process.env.FANCY_INSTAGRAM_USER_ID;delete process.env.FANCY_BY_TOKEN;
 console.log('Instagram: comprobaciones de contenedor correctas');
}
main().catch(e=>{console.error(e);process.exitCode=1});

