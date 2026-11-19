'use strict';
// Isolated slot reservation; no timer, network, migration or publication on import.
const TABLE='fancy_v1_publication_slots';
const {randomUUID}=require('node:crypto');
const DDL=`CREATE TABLE IF NOT EXISTS ${TABLE} (
 slot_key TEXT PRIMARY KEY,
 owner_token UUID NOT NULL,
 state TEXT NOT NULL CHECK (state IN ('reserved','completed','outcome_unknown')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;
function slotKey(date){
 if(!(date instanceof Date)||!Number.isFinite(date.getTime()))throw Error('Valid date required');
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const p=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 if(!['09','15','21'].includes(p.hour)||Number(p.minute)>=10)throw Error('Outside publication window');
 return 'fancy:'+p.year+'-'+p.month+'-'+p.day+':'+p.hour;
}
function createSlotReservationStore(pool){
 if(!pool||typeof pool.query!=='function')throw TypeError('PostgreSQL connection required');
 return {
  async migrate(){await pool.query(DDL);},
  async reserve(date){const key=slotKey(date),token=randomUUID();const {rows}=await pool.query(`INSERT INTO ${TABLE}(slot_key,owner_token,state) VALUES($1,$2,'reserved') ON CONFLICT(slot_key) DO NOTHING RETURNING slot_key,state`,[key,token]);return {key,claimed:rows.length===1,ownerToken:rows.length===1?token:null};},
  async finish(key,token,state){
   if(!/^fancy:\d{4}-\d{2}-\d{2}:(09|15|21)$/.test(key)||typeof token!=='string'||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(token)||!['completed','outcome_unknown'].includes(state))throw Error('Invalid slot result');
   const {rows}=await pool.query(`UPDATE ${TABLE} SET state=$3,updated_at=now() WHERE slot_key=$1 AND owner_token=$2 AND state='reserved' RETURNING slot_key,state`,[key,token,state]);return rows[0]||null;
  },
  async get(key){const {rows}=await pool.query(`SELECT slot_key,state,created_at,updated_at FROM ${TABLE} WHERE slot_key=$1`,[key]);return rows[0]||null;}
 };
}
module.exports={slotKey,createSlotReservationStore,DDL};

