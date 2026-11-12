'use strict';
// Fancy V1 original HOME draft generation. Does not approve, deploy or distribute.
const {normalizeDraft}=require('./FancyWebPublisherV1');
const MODEL='claude-sonnet-4-6';
const TOPICS=Object.freeze([
 {slug:'ordenar-despensa-por-zonas',topic:'Cómo organizar una despensa por zonas sin gastar de más'},
 {slug:'rutina-de-orden-entrada-casa',topic:'Una rutina práctica para mantener ordenada la entrada del hogar'},
 {slug:'aprovechar-estantes-pequenos',topic:'Ideas para aprovechar estantes pequeños con lo que ya tenemos'},
 {slug:'organizar-cables-escritorio',topic:'Cómo ordenar los cables de un escritorio de casa con seguridad'}
]);
function cleanJson(text){
 let value=String(text||'').trim();
 const fence=String.fromCharCode(96).repeat(3);
 if(value.startsWith(fence)){value=value.slice(3).replace(/^json\s*/i,'').trim();if(value.endsWith(fence))value=value.slice(0,-3).trim();}
 const obj=JSON.parse(value);
 if(Array.isArray(obj)||!obj||typeof obj!=='object')throw Error('Expected editorial JSON object');
 return obj;
}
function validateProposal(raw,topic){
 const draft=normalizeDraft(raw);
 if(draft.category!=='HOME'||draft.slug!==topic.slug)throw Error('Draft category or slug does not match approved topic');
 if(draft.sections.length<3||draft.sections.length>7)throw Error('HOME draft requires 3–7 sections');
 if(draft.title.length<20||draft.summary.length<40||draft.intro.length<75)throw Error('HOME draft lacks editorial depth');
 for(const s of draft.sections)if(s.body.length<90)throw Error('HOME section too short for publication review');
 const prose=[draft.title,draft.summary,draft.intro,...draft.sections.flatMap(x=>[x.heading,x.body])].join('\n');
 if(/https?:\/\/|www\.|<[^>]+>|(?:\$|USD\s*)\d|(?:amazon|afiliad[oa]|descuento exclusivo)/i.test(prose))
   throw Error('Links, HTML, prices and affiliate claims require separate verification');
 return {...draft,productsVerified:false,imagesRightsReviewed:false,affiliateDisclosureReviewed:false};
}
function createAnthropicEditorialAdapter({apiKey,fetchImpl=globalThis.fetch,model=MODEL}={}){
 if(typeof fetchImpl!=='function')throw TypeError('Fetch required');
 return {async generate(topic){
   if(!apiKey)throw Error('ANTHROPIC_API_KEY required for editorial generation');
   const prompt=[
     'Redacta un borrador ORIGINAL de Fancy By Roxette, revista digital categoría HOME.',
     'Idioma español natural, elegante, práctico y sobrio; 3 a 5 secciones útiles.',
     'No afirmes haber probado productos, no incluyas marcas, enlaces, precios, reseñas inventadas, imágenes ni promesas de venta.',
     'No repitas afirmaciones inseguras; evita recomendaciones peligrosas. Nada de SEO forzado.',
     'Tema: '+topic.topic+'. Slug obligatorio: '+topic.slug+'.',
     'Devuelve SOLAMENTE JSON válido con campos: category ("HOME"), slug, title, summary, intro, sections (array de objetos heading,body).',
     'Title 20-150 caracteres, summary 40-240, intro al menos 75 caracteres; cada sección body al menos 90 caracteres.'
   ].join('\n');
   const response=await fetchImpl('https://api.anthropic.com/v1/messages',{
     method:'POST',redirect:'error',headers:{'content-type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
     body:JSON.stringify({model,max_tokens:2400,temperature:0.4,messages:[{role:'user',content:prompt}]}),
     signal:AbortSignal.timeout(45000)
   });
   if(!response.ok)throw Error('Editorial model request failed: HTTP '+response.status);
   const data=await response.json();
   const resultText=data?.content?.filter(x=>x.type==='text').map(x=>x.text).join('\n');
   if(!resultText)throw Error('Editorial model returned no text');
   return cleanJson(resultText);
 }};
}
async function generateHomeDraft({topic=TOPICS[0],adapter,existingSlugs=[]}={}){
 if(!topic||!TOPICS.some(x=>x.slug===topic.slug&&x.topic===topic.topic))
   throw Error('Topic must come from the approved HOME topic queue');
 if(!Array.isArray(existingSlugs)||existingSlugs.includes(topic.slug))
   throw Error('Topic already exists or existing slugs unavailable');
 if(!adapter||typeof adapter.generate!=='function')throw Error('Editorial model adapter required');
 const raw=await adapter.generate(topic);
 const draft=validateProposal(raw,topic);
 return {status:'draft',generatedBy:'AI',requiresEditorialReview:true,
   distributionApproved:false,revision:null,topic:topic.topic,draft};
}
module.exports={TOPICS,cleanJson,validateProposal,createAnthropicEditorialAdapter,generateHomeDraft};