'use strict';

function createFancyAnalyticsDashboardHandler() {
  return async function handleFancyAnalyticsDashboard(req, res) {
    if (req.method !== 'GET') {
      res.writeHead(405, {'Content-Type':'text/plain; charset=utf-8','Allow':'GET'});
      res.end('Method Not Allowed');
      return true;
    }
    const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fancy Analytics</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f7f3f5;color:#272127;font-family:Arial,sans-serif}.wrap{max-width:1050px;margin:auto;padding:28px 18px}
h1{margin:0;color:#e90070;font-size:34px}.sub{color:#777;margin:6px 0 24px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px}
.card,.panel{background:#fff;border-radius:16px;padding:20px;box-shadow:0 4px 18px #0000000c}.n{font-size:32px;font-weight:700}.label{font-size:13px;color:#777;margin-top:5px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.panel h2{font-size:17px;margin:0 0 15px}.row{display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:10px 0}.row:last-child{border:0}
.badge{background:#fff0f6;color:#c6005d;padding:4px 9px;border-radius:20px;font-weight:700}.safe{margin-top:14px;font-size:12px;color:#777}
@media(max-width:650px){.grid{grid-template-columns:1fr}h1{font-size:28px}}
</style></head><body><main class="wrap"><h1>FANCY Analytics</h1><div class="sub">Observation Mode · historial inteligente de contenido</div>
<section class="cards"><div class="card"><div class="n" id="obs">—</div><div class="label">Observaciones</div></div><div class="card"><div class="n" id="pub">—</div><div class="label">Publicaciones reales</div></div><div class="card"><div class="n" id="posts">—</div><div class="label">Posts únicos</div></div></section>
<section class="grid"><div class="panel"><h2>Contenido por familia</h2><div id="families">Cargando…</div></div><div class="panel"><h2>Canales</h2><div id="channels">Cargando…</div></div></section>
<section class="grid"><div class="panel"><h2>Estrategias visuales</h2><div id="strategies">Cargando…</div></div><div class="panel"><h2>Commerce</h2><div class="row"><span>Amazon Creators API</span><span class="badge">Pendiente</span></div><div class="row"><span>Ventas / comisión</span><span>—</span></div></div></section>
<div class="safe">Analytics permanece en modo lectura. No modifica publicaciones, scheduler, Visual Engine, Amazon ni decisiones editoriales.</div>
</main><script>
function rows(items,key){return items.length?items.map(x=>'<div class="row"><span>'+String(x[key]||'unknown').replace(/[<>]/g,'')+'</span><strong>'+Number(x.observations||0)+'</strong></div>').join(''):'<div class="row">Sin datos todavía</div>'}
fetch('/test-fancy-analytics-summary',{cache:'no-store'}).then(r=>r.json()).then(d=>{if(!d.ok)throw Error();obs.textContent=d.totals.observations;pub.textContent=d.totals.published;posts.textContent=d.totals.uniquePosts;families.innerHTML=rows(d.byFamily,'family');channels.innerHTML=rows(d.byChannel,'channel');strategies.innerHTML=rows(d.byVisualStrategy,'visual_strategy')}).catch(()=>{document.querySelectorAll('#families,#channels,#strategies').forEach(x=>x.textContent='Datos no disponibles')});
</script></body></html>`;
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'});
    res.end(html);
    return true;
  };
}
module.exports={createFancyAnalyticsDashboardHandler};
