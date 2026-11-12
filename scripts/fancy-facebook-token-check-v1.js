'use strict';
// Read-only Meta page-token identity probe. No credential values logged.
const PAGE_ID='2645809545432358';
async function checkPageToken({token=process.env.FANCY_BY_TOKEN,fetchImpl=globalThis.fetch}={}){
  if(!token||typeof fetchImpl!=='function')throw new Error('FANCY_BY_TOKEN required');
  const r=await fetchImpl('https://graph.facebook.com/v26.0/me?fields=id,name',{
    method:'GET',headers:{Authorization:'Bearer '+token},
    signal:AbortSignal.timeout(12000)
  });
  const d=await r.json();
  return {http:r.status,pageMatches:r.ok&&d.id===PAGE_ID,
    name:r.ok?d.name||null:null,errorCode:r.ok?null:d.error?.code||null,
    errorSubcode:r.ok?null:d.error?.error_subcode||null};
}
if(require.main===module)checkPageToken().then(r=>{
  console.log(JSON.stringify(r,null,2));
  if(!r.pageMatches)process.exitCode=1;
}).catch(e=>{console.error('Page token check failed:',e.message);process.exitCode=1});
module.exports={checkPageToken};