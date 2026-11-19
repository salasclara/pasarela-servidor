'use strict';
// Restricted to the disposable GitHub Actions database.
const assert=require('node:assert/strict');
const {Client}=require('pg');
const {fork}=require('node:child_process');
const {createSlotReservationStore}=require('../src/services/FancySlotReservationPreviewV1');
const CI_URL='postgresql://fancy_test:fancy_test_only@localhost:5432/fancy_ci';
function verify(){if(process.env.FANCY_TEST_DB!=='yes'||process.env.DATABASE_URL!==CI_URL)throw Error('Disposable CI database required');}
function message(child){return new Promise((resolve,reject)=>{child.once('message',resolve);child.once('error',reject);});}
async function worker(){
 verify();if(!/^fancy_slots_ci_\d+_\d+$/.test(process.env.FANCY_TEST_SCHEMA||''))throw Error('Invalid schema');
 const db=new Client({connectionString:CI_URL});await db.connect();await db.query('SET search_path TO '+process.env.FANCY_TEST_SCHEMA);
 process.send({ready:true});process.on('message',async m=>{if(m!=='start')return;try{const r=await createSlotReservationStore(db).reserve(new Date('2026-11-18T15:05:00Z'));process.send(r);}catch(_){process.send({failed:true});}finally{await db.end();process.disconnect();}});
}
async function main(){
 verify();const db=new Client({connectionString:CI_URL});await db.connect();const schema='fancy_slots_ci_'+process.pid+'_'+Date.now();
 try{
  await db.query('CREATE SCHEMA '+schema);await db.query('SET search_path TO '+schema);
  const store=createSlotReservationStore(db);await store.migrate();
  const workers=[0,1].map(()=>fork(__filename,['worker'],{env:{...process.env,FANCY_TEST_SCHEMA:schema},stdio:['ignore','ignore','inherit','ipc']}));
  const ready=await Promise.all(workers.map(message));assert.ok(ready.every(x=>x.ready));
  const pending=workers.map(message);workers.forEach(w=>w.send('start'));const results=await Promise.all(pending);
  assert.equal(results.filter(x=>x.claimed).length,1);const winner=results.find(x=>x.claimed);
  assert.equal((await store.get(winner.key)).state,'reserved');
  // A restart cannot acquire the already reserved slot.
  assert.equal((await store.reserve(new Date('2026-11-18T15:06:00Z'))).claimed,false);
  assert.equal(await store.finish(winner.key,'00000000-0000-0000-0000-000000000000','completed'),null);
  assert.equal((await store.finish(winner.key,winner.ownerToken,'outcome_unknown')).state,'outcome_unknown');
  assert.equal((await store.reserve(new Date('2026-11-18T15:07:00Z'))).claimed,false);
  console.log('PostgreSQL real: reserva por horario y reinicios verificados');
 }finally{try{await db.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');}finally{await db.end();}}
}
(process.argv[2]==='worker'?worker():main()).catch(e=>{console.error(e);process.exitCode=1});

