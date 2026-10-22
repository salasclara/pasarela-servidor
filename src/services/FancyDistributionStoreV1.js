'use strict';
// Persistence for Fancy V1 distribution. No schema mutation until migrate() is called.
const TABLE='fancy_v1_distribution_jobs';
const DDL=`CREATE TABLE IF NOT EXISTS ${TABLE} (
  id BIGSERIAL PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook','instagram')),
  article_url TEXT NOT NULL,
  payload JSONB NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (state IN ('pending_review','approved','sending','published','failed','outcome_unknown')),
  external_post_id TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;
function createFancyDistributionStore(pool){
  if(!pool||typeof pool.query!=='function')throw TypeError('PostgreSQL pool required');
  async function migrate(){await pool.query(DDL);}
  async function enqueue(job){
    if(!job||!job.idempotencyKey||!['facebook','instagram'].includes(job.platform)||
      !job.url||!job.message||job.status!=='pending_review')throw Error('Invalid distribution job');
    const {rows}=await pool.query(`INSERT INTO ${TABLE}(idempotency_key,platform,article_url,payload)
      VALUES($1,$2,$3,$4::jsonb)
      ON CONFLICT(idempotency_key) DO NOTHING RETURNING id,state`,
      [job.idempotencyKey,job.platform,job.url,JSON.stringify(job)]);
    return {inserted:rows.length===1,id:rows[0]?.id||null};
  }
  async function approve(key){
    const {rows}=await pool.query(`UPDATE ${TABLE} SET state='approved',updated_at=now()
      WHERE idempotency_key=$1 AND state='pending_review' RETURNING id,state`,[key]);
    return rows[0]||null;
  }
  async function reserve(key){
    // One atomic compare-and-swap: repeated workers cannot both claim the same job.
    const {rows}=await pool.query(`UPDATE ${TABLE} SET state='sending',updated_at=now()
      WHERE idempotency_key=$1 AND state='approved'
      RETURNING idempotency_key,payload`,[key]);
    return rows[0]||null;
  }
  async function markPublished(key,externalPostId){
    if(typeof externalPostId!=='string'||!externalPostId.trim())throw Error('External post ID required');
    const {rows}=await pool.query(`UPDATE ${TABLE} SET state='published',external_post_id=$2,updated_at=now()
      WHERE idempotency_key=$1 AND state='sending' RETURNING id,state`,[key,externalPostId]);
    return rows[0]||null;
  }
  async function markUnknown(key,error){
    // A network timeout after POST may still have created a post. Never auto-retry.
    const message=String(error?.message||error||'Outcome unconfirmed').slice(0,500);
    const {rows}=await pool.query(`UPDATE ${TABLE} SET state='outcome_unknown',last_error=$2,updated_at=now()
      WHERE idempotency_key=$1 AND state='sending' RETURNING id,state`,[key,message]);
    return rows[0]||null;
  }
  async function get(key){
    const {rows}=await pool.query(`SELECT idempotency_key,platform,article_url,state,external_post_id,last_error
      FROM ${TABLE} WHERE idempotency_key=$1`,[key]);
    return rows[0]||null;
  }
  return {migrate,enqueue,approve,reserve,markPublished,markUnknown,get};
}
module.exports={createFancyDistributionStore,DDL};
