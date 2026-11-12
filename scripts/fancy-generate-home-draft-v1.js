'use strict';
// On-demand editorial generation ONLY: never publish article, modify public feed,
// send to Meta, or enable timers. Disabled unless operator opts in.
const {TOPICS,createAnthropicEditorialAdapter,generateHomeDraft}=require('../src/services/FancyEditorialDraftGeneratorV1');
const {createFancyDraftReviewStore}=require('../src/services/FancyDraftReviewStoreV1');
async function main(env=process.env,{fetchImpl=globalThis.fetch}={}){
 const requested=env.FANCY_EDITORIAL_TOPIC||TOPICS[0].slug;
 const topic=TOPICS.find(t=>t.slug===requested);
 if(!topic)throw Error('Unknown HOME topic: choose a reviewed topic from the topic queue');
 const shouldGenerate=env.FANCY_EDITORIAL_GENERATE==='yes';
 const shouldSave=env.FANCY_EDITORIAL_SAVE_REVIEW==='yes';
 if(shouldSave&&!shouldGenerate)throw Error('Cannot save without generating draft');
 const publicUrl='https://www.fancybyroxette.com';
 // Fetch current public editorial feed to avoid reusing listed slugs.
 const response=await fetchImpl(publicUrl+'/editorial-feed.json',{redirect:'error',
   signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Cannot verify existing Fancy editorial feed');
 const data=await response.json();
 if(data?.schema_version!==1||!Array.isArray(data.articles))throw Error('Unexpected editorial feed schema');
 const current=data.articles.map(x=>x.slug);
 if(current.includes(topic.slug))throw Error('Topic already listed on Fancy website');
 const existing=await fetchImpl(publicUrl+'/home/'+topic.slug+'/',{method:'HEAD',redirect:'error',
   signal:AbortSignal.timeout(15000)});
 if(existing.status!==404)throw Error('Cannot establish proposed URL is unused; aborting');
 if(!shouldGenerate){
   const result={mode:'PREVIEW_ONLY',topic:topic.topic,slug:topic.slug,
     generated:false,saved:false,published:false,socialPosted:false};
   console.log(JSON.stringify(result,null,2));return result;
 }
 const model=createAnthropicEditorialAdapter({apiKey:env.ANTHROPIC_API_KEY,fetchImpl});
 const proposal=await generateHomeDraft({topic,adapter:model,existingSlugs:current});
 const store=createFancyDraftReviewStore({token:env.FANCY_EDITORIAL_GITHUB_TOKEN,
   fetchImpl,dryRun:!shouldSave});
 const save=await store.save(proposal);
 const result={mode:shouldSave?'STAGED_FOR_REVIEW':'DRAFT_PREVIEW',slug:topic.slug,
   title:proposal.draft.title,summary:proposal.draft.summary,
   sections:proposal.draft.sections.length,...save,
   published:false,socialPosted:false};
 // In preview mode show full content for editorial review, never secrets.
 if(!shouldSave)result.draft=proposal.draft;
 console.log(JSON.stringify(result,null,2));return result;
}
if(require.main===module)main().catch(e=>{console.error('Fancy draft:',e.message);process.exitCode=1});
module.exports={main};