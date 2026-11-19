'use strict';
// CI-only disposable PostgreSQL. Never accepts production credentials.
const assert=require('node:assert/strict');
const {Client}=require('pg');
const {fork}=require('node:child_process');
const {createFancyDistributionStore}=require('../src/services/FancyDistributionStoreV1');
const {createCheckpointWorkflow}=require('../src/services/FancyInstagramCheckpointPreviewV1');
const CI_URL='postgresql://fancy_test:fancy_test_only@localhost:5432/fancy_ci';
async function worker(){
 if(process.env.FANCY_TEST_DB!=='yes'||process.env.DATABASE_URL!==CI_URL||!/^fancy_ig_ci_\d+_\d+$/.test(process.env.FANCY_TEST_SCHEMA||''))throw Error('Invalid CI environment');
 const c=new Client({connectionString:CI_URL});await c.connect();await c.query('SET search_path TO '+process.env.FANCY_TEST_SCHEMA);
 process.send({ready:true});
 process.on('message',async m=>{if(m!=='start')return;try{const result=await createFancyDistributionStore(c).reserve('instagram:ci:process');process.send({claimed:!!result});}catch(_){process.send({failed:true});}finally{await c.end();process.disconnect();}});
}
function childMessage(child){return new Promise((resolve,reject)=>{child.once('message',resolve);child.once('error',reject);});}
async function main(){
 if(process.env.FANCY_TEST_DB!=='yes'||process.env.DATABASE_URL!==CI_URL)
  throw Error('Only the disposable CI database is permitted');
 const clients=[new Client({connectionString:CI_URL}),new Client({connectionString:CI_URL}),new Client({connectionString:CI_URL})];
 const schema='fancy_ig_ci_'+process.pid+'_'+Date.now();
 try{
  await Promise.all(clients.map(c=>c.connect()));
  await clients[0].query('CREATE SCHEMA '+schema);
  await Promise.all(clients.map(c=>c.query('SET search_path TO '+schema)));
  const stores=clients.map(createFancyDistributionStore);await stores[0].migrate();
  const job={idempotencyKey:'instagram:ci:1',platform:'instagram',url:'https://example.test/',message:'CI',imageUrl:'https://example.test/ci.jpg',status:'pending_review'};
  await stores[0].enqueue(job);await stores[0].approve(job.idempotencyKey);
  let creates=0,publishes=0;
  const adapter={async create(){creates++;return {ok:true,creationId:'42'};},async waitReady(){return true;},async publish(){publishes++;return {ok:true,mediaId:'99'};}};
  const flows=stores.slice(1).map(store=>createCheckpointWorkflow({store,adapter}));
  const results=await Promise.all(flows.map(flow=>flow.send(job.idempotencyKey,{explicitAuthorization:true})));
  assert.equal(results.filter(x=>x.sent).length,1);assert.equal(creates,1);assert.equal(publishes,1);
  const state=await stores[0].get(job.idempotencyKey);assert.equal(state.state,'published');assert.equal(state.instagram_creation_id,'42');assert.equal(state.external_post_id,'99');
  const interrupted={...job,idempotencyKey:'instagram:ci:interrupted'};
  await stores[0].enqueue(interrupted);await stores[0].approve(interrupted.idempotencyKey);
  assert.ok(await stores[1].reserve(interrupted.idempotencyKey));
  assert.equal((await flows[1].send(interrupted.idempotencyKey,{explicitAuthorization:true})).sent,false);
  assert.equal((await stores[0].get(interrupted.idempotencyKey)).state,'sending');
  const processJob={...job,idempotencyKey:'instagram:ci:process'};
  await stores[0].enqueue(processJob);await stores[0].approve(processJob.idempotencyKey);
  const workers=[0,1].map(()=>fork(__filename,['worker'],{env:{...process.env,FANCY_TEST_SCHEMA:schema},stdio:['ignore','ignore','inherit','ipc']}));
  const ready=await Promise.all(workers.map(childMessage));assert.ok(ready.every(x=>x.ready));
  const responses=workers.map(childMessage);workers.forEach(child=>child.send('start'));
  const claims=await Promise.all(responses);assert.equal(claims.filter(x=>x.claimed).length,1);assert.ok(claims.every(x=>!x.failed));
  assert.equal((await stores[0].get(processJob.idempotencyKey)).state,'sending');
  console.log('PostgreSQL real aislado: reservas simultÃ¡neas e interrupciÃ³n verificadas');
 }finally{
  try{await clients[0].query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');}catch(_){}
  await Promise.all(clients.map(c=>c.end().catch(()=>{})));
 }
}
(process.argv[2]==='worker'?worker():main()).catch(e=>{console.error(e);process.exitCode=1});

