'use strict';
const assert=require('node:assert/strict');
const {TOPICS,validateProposal,cleanJson,generateHomeDraft,createAnthropicEditorialAdapter}=require('../src/services/FancyEditorialDraftGeneratorV1');
const {createFancyDraftReviewStore,REVIEW_BRANCH}=require('../src/services/FancyDraftReviewStoreV1');
const {main}=require('../scripts/fancy-generate-home-draft-v1');
const topic=TOPICS[0];
const sample={category:'HOME',slug:topic.slug,
 title:'Organiza tu despensa por zonas sin gastar de más',
 summary:'Ideas prácticas para agrupar lo que ya tienes, aprovechar mejor la despensa y mantener un espacio fácil de revisar.',
 intro:'Una despensa ordenada no necesita comenzar con una compra. Primero observa lo que utilizas, revisa la frecuencia de uso y busca una distribución sencilla que puedas mantener.',
 sections:[
  {heading:'Empieza por observar',body:'Antes de cambiar los recipientes, reúne los productos y revisa lo que tienes. Aparta los envases deteriorados y conserva visibles los artículos que necesitas a menudo.'},
  {heading:'Ordena por frecuencia',body:'Coloca al alcance lo que utilizas cada día y deja lo ocasional en otra zona. Mantén los artículos pesados en estantes estables y evita bloquear las puertas.'},
  {heading:'Ajusta durante la semana',body:'Dedica unos minutos a comprobar qué zona se desordena con más facilidad. Cambia la ubicación de los objetos antes de decidir si necesitas comprar accesorios.'}
 ]};
async function run(){
 const valid=validateProposal(sample,topic);
 assert.equal(valid.category,'HOME');
 assert.equal(valid.productsVerified,false);
 assert.equal(valid.imagesRightsReviewed,false);
 assert.equal(cleanJson(JSON.stringify(sample)).slug,topic.slug);
 const wrapped=String.fromCharCode(96).repeat(3)+'json\n'+JSON.stringify(sample)+'\n'+String.fromCharCode(96).repeat(3);
 assert.equal(cleanJson(wrapped).slug,topic.slug);
 assert.throws(()=>validateProposal({...sample,slug:'other'},topic),/slug/);
 assert.throws(()=>validateProposal({...sample,summary:'Compra por $19.99'},topic),/depth|prices/);
 assert.throws(()=>validateProposal({...sample,intro:sample.intro+' https://malicious.invalid'},topic),/Links/);
 const proposal=await generateHomeDraft({topic,adapter:{generate:async()=>sample},existingSlugs:[]});
 assert.equal(proposal.status,'draft');
 assert.equal(proposal.distributionApproved,false);
 assert.equal(proposal.requiresEditorialReview,true);
 await assert.rejects(generateHomeDraft({topic,adapter:{generate:async()=>sample},existingSlugs:[topic.slug]}),/already exists/);
 let n=0;
 const adapter=createAnthropicEditorialAdapter({apiKey:'fake-key',fetchImpl:async(url,options)=>{
   n++;assert.equal(url,'https://api.anthropic.com/v1/messages');
   assert.equal(options.method,'POST');
   assert.equal(options.headers['x-api-key'],'fake-key');
   return {ok:true,status:200,json:async()=>({content:[{type:'text',text:JSON.stringify(sample)}]})};
 }});
 assert.equal((await generateHomeDraft({topic,adapter,existingSlugs:[]})).draft.slug,topic.slug);
 assert.equal(n,1);
 const dry=createFancyDraftReviewStore({dryRun:true,fetchImpl:()=>{throw Error('No external writes')}});
 const d=await dry.save(proposal);assert.equal(d.saved,false);assert.equal(d.branch,REVIEW_BRANCH);
 await assert.rejects(dry.save({...proposal,distributionApproved:true}),/unapproved/);
 const requests=[];
 const store=createFancyDraftReviewStore({token:'test-only',dryRun:false,fetchImpl:async(url,options={})=>{
   requests.push({url,method:options.method||'GET',payload:options.body&&JSON.parse(options.body)});
   if(url.endsWith('/branches/'+REVIEW_BRANCH))return {ok:true,status:200};
   if(url.includes('?ref='))return {ok:false,status:404};
   if(options.method==='PUT')return {ok:true,status:201};
   throw Error('Unexpected GitHub URL');
 }});
 const saved=await store.save(proposal);assert.equal(saved.saved,true);
 assert.equal(requests.length,3);
 assert.equal(requests[2].payload.branch,REVIEW_BRANCH);
 assert(!requests[2].url.includes('/fancy-by-roxette-web/'));
 const fakeFetch=async(url,options={})=>{
   if(url.endsWith('/editorial-feed.json'))return {ok:true,json:async()=>({schema_version:1,articles:[]})};
   if(options.method==='HEAD')return {status:404};
   throw Error('Unexpected network call');
 };
 const preview=await main({FANCY_EDITORIAL_TOPIC:topic.slug},{fetchImpl:fakeFetch});
 assert.equal(preview.mode,'PREVIEW_ONLY');assert.equal(preview.generated,false);
 await assert.rejects(main({FANCY_EDITORIAL_SAVE_REVIEW:'yes'},{fetchImpl:fakeFetch}),/Cannot save/);
 console.log('Fancy safe HOME editorial draft generation/review tests passed');
}
run().catch(e=>{console.error(e);process.exitCode=1});