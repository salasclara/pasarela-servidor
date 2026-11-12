'use strict';
// Isolated web-first scheduler: disabled unless a separate Railway variable enables it.
// This module does not start a timer on import and does not modify existing schedules.
const {runBridge}=require('./FancyWebSocialBridgeV1');
const {checkPageToken}=require('../../scripts/fancy-facebook-token-check-v1');
const {createFancyDistributionStore}=require('./FancyDistributionStoreV1');
const {createFacebookLinkAdapter}=require('./FancyFacebookDistributorV1');
const {Pool}=require('pg');
const CONFIRM='PUBLICAR-ARTICULOS-APROBADOS-FANCY-V1';
function centralParts(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour12:false,
    year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(date);
  const d=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return {day:d.year+'-'+d.month+'-'+d.day,hour:Number(d.hour)%24,minute:Number(d.minute)};
}
function shouldRun(now,lastDay){
  const p=centralParts(now);
  return p.hour===10&&p.minute>=15&&p.minute<20&&p.day!==lastDay;
}
async function scheduledCycle({env=process.env,fetchImpl=globalThis.fetch,PoolClass=Pool,
  tokenCheck=checkPageToken,bridge=runBridge}={}) {
  if(env.FANCY_WEB_SOCIAL_SCHEDULER_ENABLED!=='yes')return {skipped:'disabled'};
  const send=env.FANCY_WEB_SOCIAL_SEND_ENABLED==='yes';
  if(send&&env.FANCY_BRIDGE_CONFIRM!==CONFIRM)
    throw new Error('Social sending is locked: explicit confirmation missing');
  if(!env.DATABASE_URL)throw new Error('DATABASE_URL missing');
  if(!env.FANCY_BY_TOKEN)throw new Error('Fancy page token missing');
  // Do not stage or send anything if token belongs to a user/other page.
  const identity=await tokenCheck({token:env.FANCY_BY_TOKEN,fetchImpl});
  if(!identity.pageMatches)throw new Error('Fancy page token identity mismatch');
  const pool=new PoolClass({connectionString:env.DATABASE_URL,max:2});
  try{
    return await bridge({fetchImpl,store:createFancyDistributionStore(pool),
      adapter:createFacebookLinkAdapter({token:env.FANCY_BY_TOKEN,dryRun:false,fetchImpl}),
      dryRun:false,autoSend:send,limit:5});
  }finally{await pool.end();}
}
function startScheduler({env=process.env,now=()=>new Date(),schedule=setInterval,
  cycle=scheduledCycle,logger=console}={}){
  if(env.FANCY_WEB_SOCIAL_SCHEDULER_ENABLED!=='yes')
    return {enabled:false,stop:()=>{}};
  let lastDay=null,running=false;
  const tick=async()=>{
    const t=now(),day=centralParts(t).day;
    if(running||!shouldRun(t,lastDay))return;
    lastDay=day;running=true;
    try{const result=await cycle({env});logger.info('[Fancy Web-Social] cycle',JSON.stringify(result));}
    catch(e){logger.error('[Fancy Web-Social] cycle failed:',e.message);}
    finally{running=false;}
  };
  const interval=schedule(()=>{void tick()},60*1000);
  return {enabled:true,tick,stop:()=>clearInterval(interval)};
}
module.exports={centralParts,shouldRun,scheduledCycle,startScheduler,CONFIRM};