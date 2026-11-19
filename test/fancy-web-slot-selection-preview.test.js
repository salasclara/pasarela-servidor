'use strict';
const assert=require('node:assert/strict');
const {previewSlot}=require('../src/services/FancyWebSlotSelectionPreviewV1');
const {FEED}=require('../src/services/FancyWebSocialBridgeV1');
const url='https://www.fancybyroxette.com/home/ejemplo/';
const article={slug:'ejemplo',category:'HOME',status:'published',title:'Ejemplo',summary:'Una guÃ­a Ãºtil.',url,reviewed_by:'editora',approved_at:'2026-11-12',revision:1,distributionApproved:true};
const html='<title>Ejemplo | Fancy By Roxette</title><link rel="canonical" href="'+url+'">';
const fetcher=(e=article,h=html)=>async u=>u===FEED?{ok:true,json:async()=>({schema_version:1,category:'HOME',articles:[e]})}:{ok:true,text:async()=>h};
const store=(fb,ig)=>({get:async k=>k.includes(':facebook:')?fb:ig});
async function main(){
 const fb={platform:'facebook',state:'approved'},ig={platform:'instagram',state:'approved'};
 assert.equal((await previewSlot({fetchImpl:fetcher(),store:store(fb,ig)})).available,true);
 for(const state of ['pending_review','sending','published','outcome_unknown','failed']){
  assert.equal((await previewSlot({fetchImpl:fetcher(),store:store(fb,{...ig,state})})).available,false);
  assert.equal((await previewSlot({fetchImpl:fetcher(),store:store({...fb,state},ig)})).available,false);
 }
 assert.equal((await previewSlot({fetchImpl:fetcher({...article,distributionApproved:false}),store:store(fb,ig)})).available,false);
 assert.equal((await previewSlot({fetchImpl:fetcher(),store:store(fb,null)})).available,false);
 await assert.rejects(previewSlot({fetchImpl:fetcher(article,'bad'),store:store(fb,ig)}),/not verified/);
 console.log('SelecciÃ³n web: ambas redes y pÃ¡gina revisadas');
}
main().catch(e=>{console.error(e);process.exitCode=1});

