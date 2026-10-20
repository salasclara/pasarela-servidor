'use strict';
// Fancy Web HTML publisher adapter (isolated; not imported by server.js).
// Credentials are supplied only by a server-side caller. Safe by default: dryRun=true.
// For new articles only; never overwrite existing hand-edited pages.
const crypto = require('node:crypto');
const { normalizeDraft, buildArticleUrl } = require('./FancyWebPublisherV1');
const esc = value => String(value).replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function renderArticle(article) {
  const a = normalizeDraft(article);
  if (a.category !== 'HOME') throw new Error('Pilot renderer supports HOME only');
  const url = buildArticleUrl(a);
  const content = a.sections.map(s=>'<section><h2>'+esc(s.heading)+'</h2><p>'+esc(s.body)+'</p></section>').join('');
  const html = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<meta name="robots" content="noindex,nofollow"><link rel="canonical" href="'+url+'">'+
    '<meta name="description" content="'+esc(a.summary)+'"><title>'+esc(a.title)+' | Fancy By Roxette</title>'+
    '<link rel="stylesheet" href="../../styles.css"></head><body>'+
    '<header class="header"><a class="brand" href="../../index.html">FANCY <small>BY ROXETTE</small></a></header>'+
    '<main class="story"><div class="label">HOME · FANCY JOURNAL</div><h1>'+esc(a.title)+'</h1>'+
    '<p class="intro">'+esc(a.summary)+'</p><p>'+esc(a.intro)+'</p>'+content+
    '<aside class="disclosure">Contenido editorial revisado. Este artículo no contiene enlaces de compra. Los productos comerciales requieren verificación y divulgación independiente.</aside>'+
    '<a class="back" href="../../index.html">← Volver a HOME</a></main>'+
    '<footer><b>FANCY BY ROXETTE</b><p><a href="../../privacidad/">Privacidad</a> · <a href="../../afiliados/">Afiliados</a> · <a href="../../contacto/">Contacto</a></p></footer></body></html>';
  return { html, path:'home/'+a.slug+'/index.html', url,
    hash:crypto.createHash('sha256').update(html).digest('hex') };
}
function createGitHubWebAdapter({token,repo='salasclara/fancy-by-roxette-web',branch='main',fetchImpl=globalThis.fetch,dryRun=true}={}){
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo)) throw new Error('Invalid repository');
  if (!/^[a-zA-Z0-9_.-]+$/.test(branch)) throw new Error('Invalid branch');
  if (!fetchImpl || typeof fetchImpl !== 'function') throw new TypeError('fetch required');
  let expected = null;
  async function publish(article,target){
    if (!article || article.status !== 'approved' || !article.reviewed_by || !article.approved_at ||
      article.productsVerified !== true || article.imagesRightsReviewed !== true || article.affiliateDisclosureReviewed !== true)
      throw new Error('Complete editorial and commercial approval required before writing to GitHub');
    const rendered=renderArticle(article);
    if (rendered.url!==target) throw new Error('URL mismatch');
    expected=rendered;
    if(dryRun) return {url:target,dryRun:true,path:rendered.path,hash:rendered.hash};
    if(!token) throw new Error('GitHub token required');
    const api='https://api.github.com/repos/'+repo+'/contents/'+rendered.path;
    const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'FancyWebPublisherV1'};
    // Verify authenticated access to the private destination repository before interpreting 404 as a missing file.
    const repositoryCheck=await fetchImpl('https://api.github.com/repos/'+repo,{headers});
    if(!repositoryCheck.ok) throw new Error('GitHub destination access failed: HTTP '+repositoryCheck.status+
      '. Verify fine-grained token repository selection and permissions.');
    const existing=await fetchImpl(api+'?ref='+encodeURIComponent(branch),{headers});
    if(existing.status!==404) throw new Error('Page already exists or cannot verify absence; refusing overwrite');
    const response=await fetchImpl(api,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},
      body:JSON.stringify({message:'Publish reviewed Fancy article '+article.slug,
        content:Buffer.from(rendered.html,'utf8').toString('base64'),branch})});
    if(!response.ok) {
      // GitHub explains 403 responses in its JSON "message"; never print tokens, headers or request bodies.
      let reason='No detailed response';
      try {
        const details=await response.json();
        if(typeof details.message==='string') {
          const allowed=['Resource not accessible by personal access token',
            'Resource not accessible by integration','Must have admin rights to Repository',
            'Repository access blocked','Branch protection','Protected branch',
            'You must have write access to this repository'];
          reason=allowed.find(x=>details.message.includes(x)) || 'GitHub rejected the write (message withheld)';
        }
      } catch(_error) {}
      throw new Error('GitHub file write failed: HTTP '+response.status+'; '+reason+
        '. Check token Contents write permission and branch rules.');
    }
    return {url:target,path:rendered.path,hash:rendered.hash};
  }
  async function verifyPublicUrl(url){
    if(dryRun) return false; // A simulated publish must never unlock distribution.
    if(!expected||url!==expected.url) return false;
    const response=await fetchImpl(url,{headers:{'Cache-Control':'no-cache'}});
    if(!response.ok) return false;
    const html=await response.text();
    return crypto.createHash('sha256').update(html).digest('hex')===expected.hash;
  }
  async function waitUntilPublished(url,{attempts=12,intervalMs=10000,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
    if (!Number.isInteger(attempts) || attempts < 1 || attempts > 30) throw new Error('Invalid attempts');
    if (dryRun) return false;
    for(let i=0;i<attempts;i++){
      try { if(await verifyPublicUrl(url)) return true; } catch(_error) { /* Deployment can still be pending. */ }
      if(i<attempts-1) await sleep(intervalMs);
    }
    return false;
  }
  return {publish,verifyPublicUrl,waitUntilPublished};
}
module.exports={renderArticle,createGitHubWebAdapter};
