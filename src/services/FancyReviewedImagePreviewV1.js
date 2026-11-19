'use strict';
const crypto=require('node:crypto');
const MAX_BYTES=10*1024*1024;
// Fail closed: only reviewed exact bytes, bounded download, no redirects.
async function verifyReviewedImage({url,sha256,fetchImpl=globalThis.fetch}={}){
 let u;try{u=new URL(url);}catch(_){throw Error('Invalid image URL');}
 if(u.origin!=='https://www.fancybyroxette.com'||u.username||u.password||u.search||u.hash||
    !/^\/(home|media|images)\/[a-zA-Z0-9/_-]+\.(png|jpe?g)$/i.test(u.pathname))throw Error('Image must be hosted on Fancy');
 if(typeof sha256!=='string'||!/^[a-f0-9]{64}$/.test(sha256)||typeof fetchImpl!=='function')throw Error('Reviewed image digest required');
 const r=await fetchImpl(u.href,{method:'GET',redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!r.ok||!r.body||typeof r.body.getReader!=='function')throw Error('Image unavailable');
 const mime=(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 if(!['image/jpeg','image/png'].includes(mime))throw Error('Invalid image content type');
 if((/\.png$/i.test(u.pathname))!==(mime==='image/png'))throw Error('Image type does not match extension');
 const len=r.headers.get('content-length');if(len&&(!/^\d+$/.test(len)||Number(len)>MAX_BYTES))throw Error('Image too large');
 const reader=r.body.getReader(),hash=crypto.createHash('sha256');let size=0,first=Buffer.alloc(0);
 try{while(true){const {done,value}=await reader.read();if(done)break;const chunk=Buffer.from(value);size+=chunk.length;if(size>MAX_BYTES){await reader.cancel();throw Error('Image too large');}if(first.length<8)first=Buffer.concat([first,chunk]).subarray(0,8);hash.update(chunk);}}
 finally{reader.releaseLock();}
 const valid=mime==='image/png'?first.equals(Buffer.from('89504e470d0a1a0a','hex')):first.length>=3&&first[0]===255&&first[1]===216&&first[2]===255;
 if(!valid||hash.digest('hex')!==sha256)throw Error('Image does not match reviewed content');
 return {sha256,mime,size};
}
module.exports={verifyReviewedImage,MAX_BYTES};

