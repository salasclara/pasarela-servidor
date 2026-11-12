'use strict';
// Instagram diagnostics are read-only. Experimental publishing requires opt-in,
// a separate secret, POST + reviewed media, and is OFF in production by default.
const crypto=require('node:crypto');
const {publishInstagramImage,validateInstagramConfig}=require('./FancyInstagramPublisher');
function json(res,status,payload){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(payload));}
function auth(req,expected){
 const header=String(req.headers?.authorization||'');
 if(!expected||!header.startsWith('Bearer '))return false;
 const candidate=header.slice(7);
 const a=Buffer.from(candidate,'utf8'),b=Buffer.from(expected,'utf8');
 return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
async function bodyJSON(req){
 let s='';
 for await(const chunk of req){
   s+=chunk.toString('utf8');
   if(Buffer.byteLength(s)>4096)throw new Error('Request too large');
 }
 return JSON.parse(s);
}
function validateMedia(body){
 if(!body||body.editorialApproved!==true||body.mediaRightsReviewed!==true||
    typeof body.caption!=='string'||body.caption.length<10||body.caption.length>1500)
   return false;
 try {
   const u=new URL(body.imageUrl);
   // Local hosted images only; no unreviewed remote hotlinks.
   return u.protocol==='https:'&&u.hostname==='www.fancybyroxette.com'&&
     /^\/(home|media|images)\/[a-zA-Z0-9/_-]+\.(png|jpe?g)$/i.test(u.pathname)&&
     !u.search&&!u.hash;
 }catch(_){return false;}
}
async function handleFancyInstagramTestEndpoint(req,res,{env=process.env,publisher=publishInstagramImage}={}){
 const url=new URL(req.url,'http://localhost');
 if(url.pathname!=='/test-fancy-instagram-publish')return false;
 if(req.method==='GET'){
   if(url.searchParams.has('image')||url.searchParams.has('caption')){
     json(res,405,{ok:false,error:'Publishing via GET is disabled',publishesAutomatically:false});return true;
   }
   const check=validateInstagramConfig();
   json(res,200,{ok:check.ok,stage:check.ok?'READY':'CONFIG',missing:check.missing,
     requiresImage:true,publishesAutomatically:false,schedulerConnected:false});
   return true;
 }
 if(req.method!=='POST'){json(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});return true;}
 if(env.FANCY_INSTAGRAM_TEST_PUBLISH_ENABLED!=='yes'||!env.FANCY_INSTAGRAM_TEST_SECRET){
   json(res,403,{ok:false,error:'INSTAGRAM_TEST_DISABLED'});return true;
 }
 if(!auth(req,env.FANCY_INSTAGRAM_TEST_SECRET)){
   json(res,401,{ok:false,error:'UNAUTHORIZED'});return true;
 }
 let payload;
 try {payload=await bodyJSON(req);} catch(_){
   json(res,400,{ok:false,error:'INVALID_JSON_OR_SIZE'});return true;
 }
 if(!validateMedia(payload)){
   json(res,422,{ok:false,error:'EXPLICIT_EDITORIAL_AND_MEDIA_APPROVAL_REQUIRED'});return true;
 }
 const check=validateInstagramConfig();
 if(!check.ok){json(res,409,{ok:false,stage:'CONFIG',missing:check.missing});return true;}
 try{
   const result=await publisher({imageUrl:payload.imageUrl,caption:payload.caption});
   json(res,result.ok?200:400,{...result,controlledTest:true,schedulerConnected:false});
 }catch(err){
   json(res,502,{ok:false,stage:'META',error:'Instagram publisher failed; verify outcome before retrying',
     controlledTest:true,schedulerConnected:false});
 }
 return true;
}
module.exports={handleFancyInstagramTestEndpoint,validateMedia};