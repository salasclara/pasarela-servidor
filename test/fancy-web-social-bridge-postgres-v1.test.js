'use strict';
// Real temporary PostgreSQL + fake public Fancy site + fake Meta adapter.
// No production credentials and no external publication.
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const {runBridge,FEED}=require('../src/services/FancyWebSocialBridgeV1');
const {createFancyDistributionStore}=require('../src/services/FancyDistributionStoreV1');
const ORIGIN='https://www.fancybyroxette.com';
const a={slug:'orden-por-zonas-piloto',category:'HOME',status:'published',
  title:'Ordenar por zonas: una rutina sencilla',
  summary:'Un ejemplo de integración que no se publica en ningún sitio.',
  url:ORIGIN+'/home/orden-por-zonas-piloto/',reviewed_by:'editor-piloto',
  approved_at:'2026-11-12T18:00:00Z',revision:1,distributionApproved:true};
const html='<html><head><link rel="canonical" href="'+a.url+'"><title>'+a.title+' | Fancy By Roxette</title></head><body></body></html>';
const fetchImpl=async url=>{
  if(url===FEED)return {ok:true,json:async()=>({schema_version:1,category:'HOME',articles:[a]})};
  if(url===a.url)return {ok:true,text:async()=>html};
  throw Error('Unexpected URL');
};
async function main(){
  if(process.env.FANCY_TEST_DB!=='yes'||!process.env.DATABASE_URL)
    throw Error('Requires disposable FANCY_TEST_DB=yes and DATABASE_URL');
  const pool=new Pool({connectionString:process.env.DATABASE_URL,max:2});
  const client=await pool.connect();
  const schema='fancy_bridge_ci_'+Date.now().toString(36);
  try{
    await client.query('BEGIN');
    await client.query('CREATE SCHEMA '+schema);
    await client.query('SET LOCAL search_path TO '+schema);
    const store=createFancyDistributionStore(client);
    await store.migrate();
    let sends=0;
    const adapter={publish:async job=>{
      assert.equal(job.url,a.url);
      sends++;
      return {posted:true,externalPostId:'fake-page-id-'+sends};
    }};
    const staged=await runBridge({fetchImpl,store,adapter,dryRun:false,autoSend:false});
    assert.equal(staged.results[0].state,'pending_review');
    assert.equal(sends,0);
    const published=await runBridge({fetchImpl,store,adapter,dryRun:false,autoSend:true});
    assert.equal(published.results[0].state,'published');
    assert.equal(sends,1);
    const repeated=await runBridge({fetchImpl,store,adapter,dryRun:false,autoSend:true});
    assert.equal(repeated.results[0].posted,false);
    assert.equal(repeated.results[0].state,'published');
    assert.equal(sends,1);
    const rows=await client.query('SELECT state,external_post_id FROM fancy_v1_distribution_jobs');
    assert.equal(rows.rowCount,1);
    assert.equal(rows.rows[0].external_post_id,'fake-page-id-1');
    await client.query('ROLLBACK');
    console.log('Fancy bridge PostgreSQL + simulated site and Meta end-to-end passed (no external writes)');
  }catch(e){
    try{await client.query('ROLLBACK')}catch(_){}
    throw e;
  }finally{client.release();await pool.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1});