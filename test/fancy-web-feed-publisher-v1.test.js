'use strict';
const assert=require('node:assert/strict');
const {createFancyFeedUpdater}=require('../src/services/FancyWebFeedPublisherV1');
const article={category:'HOME',slug:'prueba-feed-fancy-v1',title:'Prueba editorial',summary:'Prueba de índice',intro:'Contenido técnico',sections:[{heading:'Paso',body:'Descripción'}],status:'published',publishedUrl:'https://www.fancybyroxette.com/home/prueba-feed-fancy-v1/',reviewed_by:'editor',approved_at:'2026-11-11T12:00:00Z'};
(async()=>{
 const empty={schema_version:1,category:'HOME',articles:[{slug:'borrador',status:'draft'}]};
 let saved=null,requests=0;
 const fake=async(url,options={})=>{
   requests++;
   if(options.method==='PUT'){saved=JSON.parse(options.body);return {ok:true,status:200};}
   return {ok:true,status:200,json:async()=>({sha:'sha-original',content:Buffer.from(JSON.stringify(empty)).toString('base64')})};
 };
 const store=createFancyFeedUpdater({dryRun:false,token:'fake',fetchImpl:fake});
 const result=await store.addPublished(article,{verified:true});
 assert.equal(result.added,true);
 assert.equal(saved.sha,'sha-original');
 const updated=JSON.parse(Buffer.from(saved.content,'base64').toString());
 assert.equal(updated.articles.length,2);
 assert.equal(updated.articles[0].slug,article.slug);
 assert.equal(updated.articles[0].url,article.publishedUrl);
 assert.equal(updated.articles[0].distributionApproved,false);
 assert.equal(updated.articles[0].revision,null);
 assert.equal(updated.articles[1].status,'draft');
 await assert.rejects(()=>store.addPublished(article,{verified:false}),/Verified/);
 await assert.rejects(()=>store.addPublished({...article,status:'approved'},{verified:true}),/Verified/);
 const dry=createFancyFeedUpdater({dryRun:true,fetchImpl:()=>{throw Error('Should not fetch')}});
 assert.equal((await dry.addPublished(article,{verified:true})).dryRun,true);
 await store.addPublished({...article,distributionApproved:true,revision:1},{verified:true});
 const approvedFeed=JSON.parse(Buffer.from(saved.content,'base64').toString());
 assert.equal(approvedFeed.articles[0].distributionApproved,true);
 assert.equal(approvedFeed.articles[0].revision,1);
 await assert.rejects(()=>store.addPublished({...article,distributionApproved:true},{verified:true}),/revision/);
 assert.equal(requests,4);
 console.log('Fancy editorial HOME feed tests passed (mocked, no external writes).');
})().catch(e=>{console.error(e);process.exitCode=1});
