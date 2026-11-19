'use strict';
const assert=require('node:assert/strict');
const {stageReviewedWebArticle}=require('../src/services/FancyWebSocialStagingPreviewV1');
const url='https://www.fancybyroxette.com/home/ejemplo/';
const entry={slug:'ejemplo',category:'HOME',status:'published',title:'Ejemplo',summary:'Una guÃ­a Ãºtil.',url,reviewed_by:'editora',approved_at:'2026-11-12',revision:1,distributionApproved:true};
const media={url:'https://www.fancybyroxette.com/images/home/ejemplo.jpg',editorialApproved:true,rightsReviewed:true,reviewedBy:'editora',reviewedAt:'2026-11-18'};
const fetchImpl=async()=>({ok:true,text:async()=>'<title>Ejemplo | Fancy By Roxette</title><link rel="canonical" href="'+url+'">'});
async function main(){
 const jobs=new Map(),store={async enqueue(j){if(jobs.has(j.idempotencyKey))return {inserted:false};jobs.set(j.idempotencyKey,j);return {inserted:true};}};
 const input={entry,media,store,fetchImpl};const r=await stageReviewedWebArticle(input);assert.equal(jobs.size,2);
 assert.equal(jobs.get(r.instagramKey).mediaReview.reviewedBy,'editora');assert.equal(jobs.get(r.instagramKey).status,'pending_review');
 assert.equal((await stageReviewedWebArticle(input)).facebook.inserted,false);assert.equal(jobs.size,2);
 await assert.rejects(stageReviewedWebArticle({...input,entry:{...entry,distributionApproved:false}}),/approved/);
 await assert.rejects(stageReviewedWebArticle({...input,media:{...media,rightsReviewed:false}}),/review/);
 await assert.rejects(stageReviewedWebArticle({...input,media:{...media,url:'https://other.example/a.jpg'}}),/hosted/);
 await assert.rejects(stageReviewedWebArticle({...input,media:{...media,url:'https://user@www.fancybyroxette.com/images/home/a.jpg'}}),/hosted/);
 await assert.rejects(stageReviewedWebArticle({...input,fetchImpl:async()=>({ok:true,text:async()=>'<title>wrong</title>'})}),/not verified/);
 console.log('PreparaciÃ³n web: revisiÃ³n y ausencia de duplicados verificadas');
}
main().catch(e=>{console.error(e);process.exitCode=1});

