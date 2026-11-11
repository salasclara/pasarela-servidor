'use strict';
// Run on CI with no credentials: prepares a preview for the existing kitchen review.
// Nothing is posted to Facebook, no DB is mutated and server.js is never imported.
const {prepareFacebookJob,createFacebookLinkAdapter}=require('../src/services/FancyFacebookDistributorV1');
const article={
 status:'published',distributionApproved:true,revision:1,
 category:'HOME',slug:'ordenar-cocina-pequena',
 title:'Una cocina pequeña también puede sentirse espaciosa',
 summary:'Ideas sencillas para liberar superficies y ordenar por hábitos.',
 publishedUrl:'https://www.fancybyroxette.com/home/ordenar-cocina-pequena/'
};
async function main(){
 const job=prepareFacebookJob(article);
 const adapter=createFacebookLinkAdapter({dryRun:true});
 const result=await adapter.publish(job,{approved:true});
 if(result.posted!==false)throw Error('Dry run must not publish');
 console.log(JSON.stringify({mode:'DRY_RUN',destination:'Fancy Facebook Page',
   idempotencyKey:job.idempotencyKey,articleUrl:job.url,preview:job.message,
   posted:false,requiresPersistentReservation:true},null,2));
}
main().catch(err=>{console.error(err);process.exitCode=1});
