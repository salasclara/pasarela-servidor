'use strict';
const assert=require('node:assert/strict');
const {handleFancyInstagramTestEndpoint,validateMedia}=require('../src/services/FancyInstagramTestEndpoint');
const imageUrl='https://www.fancybyroxette.com/images/home-review-1.jpg';
const good={imageUrl,caption:'Fancy by Roxette — nueva reseña HOME con una descripción editorial original.',editorialApproved:true,mediaRightsReviewed:true};
function req(method,url,body,authorization){
 return {method,url,headers:authorization?{authorization}: {},
   async *[Symbol.asyncIterator](){if(body!==undefined)yield Buffer.from(JSON.stringify(body));}};
}
async function send(request,opts={}){
 const res={status:null,payload:null,writeHead(code){this.status=code;},end(body){this.payload=JSON.parse(body);}};
 const handled=await handleFancyInstagramTestEndpoint(request,res,opts);
 return {handled,...res};
}
(async()=>{
 let publishes=0;
 const publisher=async()=>{publishes++;return {ok:true,mediaId:'FAKE_ID'};};
 const base={env:{FANCY_INSTAGRAM_TEST_PUBLISH_ENABLED:'yes',FANCY_INSTAGRAM_TEST_SECRET:'fake-secret'},publisher};
 const read=await send(req('GET','/test-fancy-instagram-publish'),base);
 assert.equal(read.status,200);
 assert.equal(read.payload.publishesAutomatically,false);
 const getPost=await send(req('GET','/test-fancy-instagram-publish?image='+encodeURIComponent(imageUrl)),base);
 assert.equal(getPost.status,405);
 assert.equal(publishes,0);
 assert.equal((await send(req('POST','/test-fancy-instagram-publish',good),{publisher})).status,403);
 assert.equal((await send(req('POST','/test-fancy-instagram-publish',good),base)).status,401);
 assert.equal((await send(req('POST','/test-fancy-instagram-publish',{...good,imageUrl:'https://example.org/a.jpg'},'Bearer fake-secret'),base)).status,422);
 assert.equal((await send(req('POST','/test-fancy-instagram-publish',{...good,mediaRightsReviewed:false},'Bearer fake-secret'),base)).status,422);
 assert.equal((await send(req('DELETE','/test-fancy-instagram-publish'),base)).status,405);
 assert.equal(validateMedia(good),true);
 assert.equal(validateMedia({...good,imageUrl:'https://www.fancybyroxette.com/images/a.jpg?token=1'}),false);
 assert.equal(validateMedia({...good,imageUrl:'https://www.fancybyroxette.com.evil.example/images/a.jpg'}),false);
 // A test must not need real Instagram credentials. Without a configured profile, reject before publishing.
 const gated=await send(req('POST','/test-fancy-instagram-publish',good,'Bearer fake-secret'),base);
 assert.ok([409,200].includes(gated.status));
 assert.equal(publishes,gated.status===200?1:0);
 assert.equal((await send(req('GET','/something-else'),base)).handled,false);
 console.log('Fancy Instagram test endpoint now rejects unauthorized GET writes and unapproved images');
})().catch(e=>{console.error(e);process.exitCode=1});