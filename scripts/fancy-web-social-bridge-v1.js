'use strict';
// Manual/on-demand bridge runner. No cron, no server.js integration.
// Dry run by default. Never logs secrets. Explicit two-stage opt-in for sending.
const {Pool}=require('pg');
const {createFancyDistributionStore}=require('../src/services/FancyDistributionStoreV1');
const {createFacebookLinkAdapter}=require('../src/services/FancyFacebookDistributorV1');
const {runBridge}=require('../src/services/FancyWebSocialBridgeV1');
async function main(env=process.env) {
  const live=env.FANCY_BRIDGE_LIVE==='yes';
  const autoSend=env.FANCY_BRIDGE_AUTO_SEND==='yes';
  if(autoSend&&(!live||env.FANCY_BRIDGE_CONFIRM!=='PUBLICAR-ARTICULOS-APROBADOS-FANCY-V1'))
    throw new Error('Sending requires live mode and explicit exact confirmation');
  if(!live) {
    const result=await runBridge({dryRun:true});
    console.log(JSON.stringify(result,null,2));
    return result;
  }
  if(!env.DATABASE_URL)throw new Error('DATABASE_URL required');
  if(!env.FANCY_BY_TOKEN)throw new Error('FANCY_BY_TOKEN required');
  const pool=new Pool({connectionString:env.DATABASE_URL,max:2});
  try {
    const result=await runBridge({
      store:createFancyDistributionStore(pool),
      adapter:createFacebookLinkAdapter({token:env.FANCY_BY_TOKEN,dryRun:false}),
      dryRun:false,autoSend
    });
    console.log(JSON.stringify(result,null,2));
    return result;
  }finally{await pool.end();}
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={main};