const http = require('http');
const https = require('https');
const { Pool } = require('pg');

try {
  const { ThinkingEngine } = require('./src/services/ThinkingEngine');
  const t = new ThinkingEngine();
  const test = t.analyze('test idea pasarela');
  console.log('[ThinkingEngine] OK — hero:', test.hero.text);
} catch(e) {
  console.error('[ThinkingEngine] FALLO AL CARGAR:', e.message);
}

const API_KEY = process.env.ANTHROPIC_API_KEY;

const pool = new Pool({
  connectionString: process.env.PASARELA_PG || 'postgresql://postgres:OdKnMEAUvdaRgvUCWeESUNbJrSIhEMeS@postgres.railway.internal:5432/railway',
  ssl: false,
});

// Migracion automatica — agrega columna imagen si no existe
pool.query("ALTER TABLE noticias ADD COLUMN IF NOT EXISTS imagen TEXT DEFAULT ''")
  .then(() => console.log('[DB] Columna imagen verificada OK'))
  .catch(e => console.error('[DB] Migracion imagen error:', e.message));

const FUENTES = [
  // Moda Internacional
  { nombre: 'Vogue México', url: 'https://www.vogue.mx/feed/rss', scope: 'Moda' },
  { nombre: 'Harper\'s Bazaar MX', url: 'https://www.harpersbazaar.com.mx/feed/', scope: 'Moda' },
  { nombre: 'Elle España', url: 'https://www.elle.com/es/rss/all.xml/', scope: 'Moda' },
  { nombre: 'InStyle España', url: 'https://www.instyle.es/rss/all.xml', scope: 'Moda' },
  { nombre: 'Trendencias', url: 'https://www.trendencias.com/feedburner.xml', scope: 'Moda' },
  { nombre: 'El País Moda', url: 'https://feeds.elpais.com/mrss-s/list/ep/site/elpais.com/section/smoda', scope: 'Moda' },
  { nombre: 'Glamour MX', url: 'https://www.glamour.mx/feed/rss', scope: 'Moda' },
  // Belleza
  { nombre: 'Marie Claire', url: 'https://www.marie-claire.es/rss/all.xml', scope: 'Belleza' },
  { nombre: 'Cosmopolitan ES', url: 'https://www.cosmopolitan.com/es/rss/all.xml/', scope: 'Belleza' },
  { nombre: 'Vanity Fair ES', url: 'https://www.revistavanityfair.es/rss/all.xml', scope: 'Belleza' },
  // Talento y Entretenimiento
  { nombre: 'People en Español', url: 'https://peopleenespanol.com/feed/', scope: 'Talento' },
  { nombre: 'Variety Latino', url: 'https://variety.com/v/latino/feed/', scope: 'Talento' },
  { nombre: 'Billboard ES', url: 'https://www.billboard.com/feed/', scope: 'Talento' },
  // Dallas / Comunidad Latina
  { nombre: 'Dallas Morning News', url: 'https://www.dallasnews.com/arc/outboundfeeds/rss/', scope: 'Dallas' },
  { nombre: 'Univision', url: 'https://www.univision.com/rss/noticias', scope: 'Dallas' },
  { nombre: 'Telemundo', url: 'https://www.telemundo.com/rss/noticias.xml', scope: 'Dallas' },
  { nombre: 'Al Día Dallas', url: 'https://aldiatx.com/feed/', scope: 'Dallas' },
  // Pasarelas y Fashion Week
  { nombre: 'Infobae Moda', url: 'https://www.infobae.com/arc/outboundfeeds/rss/category/tendencias/', scope: 'Moda' },
  { nombre: 'Vogue US ES', url: 'https://www.vogue.com/feed/rss', scope: 'Moda' },
  { nombre: 'WWD', url: 'https://wwd.com/feed/', scope: 'Moda' },
];

const CATEGORIAS_KEYWORDS = {
  'Moda': ['moda', 'fashion', 'diseño', 'ropa', 'tendencia', 'pasarela', 'coleccion', 'outfit', 'estilo', 'temporada', 'fashion week', 'diseñador', 'marca', 'lujo'],
  'Belleza': ['belleza', 'maquillaje', 'skincare', 'cabello', 'piel', 'cosmetic', 'perfume', 'tratamiento', 'labial', 'cuidado', 'rutina'],
  'Talento': ['modelo', 'modelaje', 'casting', 'agencia', 'talento', 'carrera', 'pasarela', 'editorial', 'shooting', 'fotografia', 'artista'],
  'Entretenimiento': ['cine', 'musica', 'serie', 'pelicula', 'celebridad', 'alfombra roja', 'premio', 'festival', 'concierto'],
  'Dallas': ['dallas', 'texas', 'latino', 'hispano', 'comunidad', 'dfw', 'carrollton'],
  'Lifestyle': ['viaje', 'fitness', 'bienestar', 'salud', 'nutricion', 'yoga', 'meditacion', 'hogar', 'decoracion'],
};

function detectarCategoria(titulo, descripcion) {
  const texto = (titulo + ' ' + descripcion).toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORIAS_KEYWORDS)) {
    if (keywords.some(k => texto.includes(k))) return cat;
  }
  return 'Moda';
}

function fetchUrl(urlStr) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const mod = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: { 'User-Agent': 'PasarelaStudio/1.0' },
      timeout: 8000,
    };
    const req = mod.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function parsearRSS(xml, fuente) {
  const noticias = [];
  const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
  for (const item of items.slice(0, 5)) {
    const tituloMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
    const titulo = tituloMatch ? tituloMatch[1].trim() : '';
    const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/);
    const desc = descMatch ? descMatch[1].replace(/<[^>]*>/g, '').trim() : '';
    const linkMatch = item.match(/<link>(.*?)<\/link>/) || item.match(/<link href="(.*?)"\/>/);
    const link = linkMatch ? linkMatch[1].trim() : '';
    const fechaMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
    const fecha = fechaMatch ? fechaMatch[1].trim() : '';

    let imagen = '';
    const mediaContent = item.match(/<media:content[^>]+url="([^"]+)"/);
    const mediaThumbnail = item.match(/<media:thumbnail[^>]+url="([^"]+)"/);
    const enclosure = item.match(/<enclosure[^>]+url="([^"]+)"/);
    const imgInDesc = item.match(/<img[^>]+src="([^"]+)"/);
    if (mediaContent) imagen = mediaContent[1];
    else if (mediaThumbnail) imagen = mediaThumbnail[1];
    else if (enclosure) imagen = enclosure[1];
    else if (imgInDesc) imagen = imgInDesc[1];

    const fechaNoticia = new Date(fecha);
    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (titulo && (!fecha || fechaNoticia >= hace24h)) {
      noticias.push({
        id: Math.random().toString(36).substr(2, 9),
        titulo: titulo.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#8217;/g, "'").replace(/&#8220;/g, '"').replace(/&#8221;/g, '"'),
        descripcion: desc.substring(0, 800),
        fuente: fuente.nombre,
        scope: fuente.scope,
        cat: detectarCategoria(titulo, desc),
        link,
        fecha,
        tiempo: calcularTiempo(fecha),
        imagen,
      });
    }
  }
  return noticias;
}

function calcularTiempo(fechaStr) {
  try {
    const fecha = new Date(fechaStr);
    const diff = (Date.now() - fecha.getTime()) / 1000 / 60;
    if (diff < 60) return `Hace ${Math.floor(diff)}m`;
    if (diff < 1440) return `Hace ${Math.floor(diff / 60)}h`;
    return `Hace ${Math.floor(diff / 1440)}d`;
  } catch { return 'Reciente'; }
}

function generarSlug(titulo) {
  return titulo
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 80);
}

let cacheNoticias = [];
let ultimaActualizacion = 0;

async function actualizarNoticias() {
  console.log('Actualizando noticias Pasarela Studio...');
  const todas = [];
  for (const fuente of FUENTES) {
    try {
      const xml = await fetchUrl(fuente.url);
      const noticias = parsearRSS(xml, fuente);
      todas.push(...noticias);
      console.log(`✓ ${fuente.nombre}: ${noticias.length} noticias`);
    } catch (e) {
      console.log(`✗ ${fuente.nombre}: ${e.message}`);
    }
  }
  cacheNoticias = todas;
  ultimaActualizacion = Date.now();
  console.log(`Total: ${todas.length} noticias`);
}

actualizarNoticias();
setInterval(actualizarNoticias, 30 * 60 * 1000);


const FB_PAGE_ID = process.env.FACEBOOK_PAGE_ID || '160291140702239';
// Token fallback hardcodeado — mover a env var cuando Railway resuelva el bug de inyeccion
const _t1 = 'EAAdtfhDFcGgBSWRMBSvgY2TtemBhHblRHEZBa74Q8v8r';
const _t2 = 'zBwCwBpFZCz5DQ5YZAZBQXCbw3wSZBEn7pYa8HM1XHEUL';
const _t3 = 'Uv9PowiaWJmc9bh91ws28OTOAZAnNQZARWN183ebKzgm5';
const _t4 = 'w3Y3eckyKZBOkRQhlCoO0CyAsMFvDbKhUQe6pZAiZCt2F';
const _t5 = 'x63OMQIFALkwybWoY5jdI4vrwgZD';
const FB_PAGE_TOKEN = process.env.FACEBOOK_PAGE_TOKEN || (_t1+_t2+_t3+_t4+_t5);

// ============================================================
// CONFIG MULTI-PÁGINA — agregar pages aquí cuando tengas los tokens
// Cada página tiene su propia voz, nicho y hashtags
// ============================================================
const PAGES_EXTRA = [
  // ✅ ACTIVA — Comunidad de Fe Maravillas Del Reino
  {
    id: '1402427610030236',
    token: process.env.COMUNIDAD_FE_PAGE_TOKEN || 'EAAdtfhDFcGgBSRTJ4Xi3NfoR5yg4Dv5douXqGBjxtUw3d71U88rILYEs4gokGCpRSjm9gZBZAsNff7AN8lMCUvWFdCNCPwa06QZBQKjqwmwhdGzIzGMZCyjyeXqXXhUzt2HZCyCeUZBdSavmvnHhaKre48vz3vfNjsu5IASOmEDeUZA04hO7BRqdf6SqteBaoZAa9qgADCqAndRxwMJ9dyN3CwF8kG5raLtI4SIcOwBCQFLZAJ3Wo9dlO',
    nombre: 'Comunidad de Fe Maravillas Del Reino',
    nicho: 'fe, comunidad y empoderamiento femenino cristiano',
    voice: 'Eres la voz de Maravillas Del Reino, comunidad cristiana de mujeres latinas. Voz inspiradora, cálida, llena de fe y esperanza. Escribe con amor y propósito. Español.',
    hashtags: '#MaravillaDelReino #FeCristiana #MujerDeValor #ComunidadLatina #Esperanza',
    temas: ['fe', 'familia', 'mujer', 'esperanza', 'comunidad', 'propósito', 'amor', 'inspiración', 'bendición', 'gratitud']
  },
  // ✅ ACTIVA — Fancy by Roxette
  {
    id: '2645809545432358',
    token: process.env.FANCY_PAGE_TOKEN || 'EAAMiSCsCtFEBScQVVW7xv658yOfznLtETuIxKlCwXZBZB8OZClTrNkquUdQNg6nCLFZC9z5sNetbxqKC535LUNUdjoapZCOtypzj81Pa5sddk47afuW11OBhQOOAhMcFZAAusT0czWZB3giY1LD1FPKqF9zZCRMWkmaFZAEg24avt9lbyZCOtEdjSZCqZCkISYZCypzYMZAFLGf2A8kel7JZAKzyHKkBjirM5SEf0fZCgjlap6TJnDQwdYY66jxAYtbFiQZDZD',
    nombre: 'Fancy by Roxette',
    nicho: 'moda y accesorios',
    voice: 'Eres la editora de Fancy by Roxette, boutique de moda y accesorios en Dallas. Voz chic, aspiracional y accesible. Mezcla de español e inglés de moda. Tendencias, outfits y estilo de vida.',
    hashtags: '#FancyByRoxette #ModaAccesorios #Tendencias #StyleLatina #FashionDallas #OOTD #BoutiqueDallas',
    temas: ['accesorios', 'moda', 'tendencias', 'looks', 'outfit', 'estilo', 'joyería', 'bolsos', 'belleza', 'maquillaje', 'zapatos', 'ropa']
  },
  // ✅ ACTIVA — Amar es
  {
    id: '529892146881748',
    token: process.env.AMAR_ES_PAGE_TOKEN || 'EAAMiSCsCtFEBSc2JNt0kbjNhehR3Rb4ioNZBJhpiQWo3NZBYPQyc2CzdvNO8ZA6TZAE7rlZAbiPP6daOzpcX88BvcAVh0r0ZBZApzFOBwXi8nkmZBy3j6eKgGLCdTo043v4NCBAvimC7uYbzIZCgRMlS5ihkuXmWHpFJVUTE9iZCMr3ZBZCCM38Drl2oYKSzdV5Rya8d0pYZC8vGTeov8nwAnqwlaZCZAj3ZAHNQkckwM1h4FJGkCp90erRVZApqePQZDZD',
    nombre: 'Amar es',
    nicho: 'amor, relaciones y lifestyle femenino',
    voice: 'Eres la voz de Amar es, espacio de amor, relaciones y bienestar femenino para mujeres latinas. Voz cálida, empática e inspiradora. Frases con profundidad, consejos de vida y amor propio. Español.',
    hashtags: '#AmarEs #Relaciones #AmorPropio #MujerLatina #Lifestyle #Bienestar #VidaPlena',
    temas: ['amor', 'relaciones', 'autoestima', 'bienestar', 'pareja', 'familia', 'crecimiento personal', 'mujer', 'motivación', 'inspiración', 'vida', 'felicidad']
  },
  // ⏳ PENDIENTE — Trabajando En Casa (agregar token)
  // {
  //   id: 'TRABAJANDO_EN_CASA_PAGE_ID',
  //   token: process.env.TRABAJANDO_EN_CASA_PAGE_TOKEN || '',
  //   nombre: 'Trabajando En Casa',
  //   nicho: 'emprendimiento digital y trabajo remoto',
  //   voice: 'Eres la editora de Trabajando En Casa, guía de emprendimiento digital y trabajo remoto para latinos. Voz práctica, motivadora y directa. Tips accionables, sin rodeos. Español.',
  //   hashtags: '#TrabajandoEnCasa #Emprendimiento #TrabajoRemoto #EmprendedoraLatina #NegocioDigital #IngresoExtra #LibertadFinanciera',
  //   temas: ['emprendimiento', 'trabajo remoto', 'productividad', 'negocio online', 'ingresos extra', 'freelance', 'dinero', 'marketing digital']
  // },
];

// Función genérica: publica cover editorial en cualquier página
async function publicarCoverParaPagina(pageConfig, titulo) {
  if (!pageConfig.token || !pageConfig.id) {
    console.log('[MultiPage] Token o ID faltante para:', pageConfig.nombre);
    return;
  }
  try {
    // Generar caption con la voz del nicho
    const captionPayload = JSON.stringify({
      model: 'claude-haiku-3-5', max_tokens: 120,
      system: pageConfig.voice + ' Escribe SOLO el caption: 2 líneas editoriales sobre el tema, luego 4 hashtags. Sin comillas, sin asteriscos.',
      messages: [{ role: 'user', content: 'Caption editorial para: ' + titulo }]
    });
    const caption = await new Promise((resolve, reject) => {
      const opts = { hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(captionPayload) } };
      const r = https.request(opts, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d).content?.[0]?.text || ''); } catch(e) { reject(e); } }); });
      r.on('error', reject); r.write(captionPayload); r.end();
    });
    if (!caption) return;
    // Intercambiar por page token largo
    let pageToken = pageConfig.token;
    try {
      const tr = await fetch(`https://graph.facebook.com/v19.0/${pageConfig.id}?fields=access_token&access_token=${pageConfig.token}`);
      const td = await tr.json();
      if (td.access_token) pageToken = td.access_token;
    } catch(e) {}
    // Publicar cover
    const coverBuffer = await generarCoverPasarela(titulo.substring(0, 80));
    const FormData = require('form-data');
    const form = new FormData();
    form.append('caption', caption + '\n\n' + pageConfig.hashtags);
    form.append('access_token', pageToken);
    form.append('source', coverBuffer, { filename: 'cover.jpg', contentType: 'image/jpeg' });
    await new Promise((resolve, reject) => {
      form.submit(`https://graph.facebook.com/v19.0/${pageConfig.id}/photos`, (err, res) => {
        res.resume();
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('[MultiPage] Cover publicado en:', pageConfig.nombre, '|', titulo);
  } catch(e) { console.error('[MultiPage] Error en', pageConfig.nombre, ':', e.message); }
}

function publicarEnFacebook(titulo, contenido, urlArticulo, imagen) {
  if (!FB_PAGE_TOKEN) { console.log('[Facebook] Token no configurado — saltando'); return Promise.resolve(null); }
  const resumen = contenido.replace(/[\r\n]+/g, ' ').substring(0, 220) + '...';
  const mensaje = titulo + '\n\n' + resumen + '\n\nLee el articulo completo en PASARELA →';
  const postData = new URLSearchParams({ message: mensaje, link: urlArticulo, access_token: FB_PAGE_TOKEN });
  return new Promise((resolve) => {
    const postBody = postData.toString();
    const opts = {
      hostname: 'graph.facebook.com',
      path: '/v19.0/' + FB_PAGE_ID + '/feed',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postBody) },
    };
    const r = https.request(opts, res => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(d);
          if (parsed.id) { console.log('[Facebook] Publicado OK — post ID:', parsed.id); resolve(parsed.id); }
          else { console.error('[Facebook] Error:', JSON.stringify(parsed)); resolve(null); }
        } catch(e) { console.error('[Facebook] Parse error:', e.message); resolve(null); }
      });
    });
    r.on('error', e => { console.error('[Facebook] Network error:', e.message); resolve(null); });
    r.write(postBody);
    r.end();
  });
}


// Publicar FOTO en Facebook — alta monetizacion
function publicarFotoFacebook(imageUrl, caption) {
  if (!FB_PAGE_TOKEN || !imageUrl) { console.log('[FB Foto] Token o imagen faltante'); return Promise.resolve(null); }
  const postData = new URLSearchParams({ url: imageUrl, caption: caption, access_token: FB_PAGE_TOKEN });
  return new Promise((resolve) => {
    const postBody = postData.toString();
    const opts = {
      hostname: 'graph.facebook.com',
      path: '/v19.0/' + FB_PAGE_ID + '/photos',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postBody) },
    };
    const r = https.request(opts, res => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(d);
          if (parsed.id) { console.log('[FB Foto] Publicada OK — ID:', parsed.id); resolve(parsed.id); }
          else { console.error('[FB Foto] Error:', JSON.stringify(parsed)); resolve(null); }
        } catch(e) { console.error('[FB Foto] Parse error:', e.message); resolve(null); }
      });
    });
    r.on('error', e => { console.error('[FB Foto] Network error:', e.message); resolve(null); });
    r.write(postBody);
    r.end();
  });
}

// Publicar STORY en Facebook — mayor ingreso de monetizacion
async function publicarStoryFacebook(imageUrl) {
  if (!FB_PAGE_TOKEN || !imageUrl) { console.log('[FB Story] Token o imagen faltante'); return null; }
  const photoId = await new Promise((resolve) => {
    const postData = new URLSearchParams({ url: imageUrl, published: 'false', access_token: FB_PAGE_TOKEN });
    const postBody = postData.toString();
    const opts = {
      hostname: 'graph.facebook.com',
      path: '/v19.0/' + FB_PAGE_ID + '/photos',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postBody) },
    };
    const r = https.request(opts, res => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        try { const p = JSON.parse(d); resolve(p.id || null); }
        catch(e) { resolve(null); }
      });
    });
    r.on('error', () => resolve(null));
    r.write(postBody);
    r.end();
  });
  if (!photoId) { console.error('[FB Story] No se pudo subir la foto'); return null; }
  return new Promise((resolve) => {
    const storyData = new URLSearchParams({ photo_id: photoId, access_token: FB_PAGE_TOKEN });
    const storyBody = storyData.toString();
    const opts = {
      hostname: 'graph.facebook.com',
      path: '/v19.0/' + FB_PAGE_ID + '/photo_stories',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(storyBody) },
    };
    const r = https.request(opts, res => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(d);
          if (parsed.id) { console.log('[FB Story] Publicada OK — ID:', parsed.id); resolve(parsed.id); }
          else { console.error('[FB Story] Error:', JSON.stringify(parsed)); resolve(null); }
        } catch(e) { console.error('[FB Story] Parse error:', e.message); resolve(null); }
      });
    });
    r.on('error', e => { console.error('[FB Story] Network error:', e.message); resolve(null); });
    r.write(storyBody);
    r.end();
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // GET /noticias
  if (req.method === 'GET' && req.url === '/noticias') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ noticias: cacheNoticias, actualizadas: new Date(ultimaActualizacion).toISOString() }));
    return;
  }

  // GET /blog — leer posts desde PostgreSQL
  if (req.method === 'GET' && req.url === '/blog') {
    pool.query('SELECT * FROM noticias WHERE publicado = true ORDER BY created_at DESC')
      .then(result => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.rows));
      })
      .catch(e => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      });
    return;
  }
  // GET /test-cover — publicar cover editorial manual
  if (req.method === 'GET' && req.url === '/test-cover') {
   try {
     const buffer = await generarCoverPasarela('Elegancia latina. Poder. Transformación.');
     await publicarFotoBuffer(buffer, '✨ Pasarela Studio Internacional — donde el talento se convierte en arte. Dallas, TX #PasarelaStudio #Moda #Modelaje');
     res.writeHead(200, { 'Content-Type': 'application/json' });
     res.end(JSON.stringify({ ok: true, mensaje: 'Cover publicada en Facebook' }));
   } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
   }
   return;
 }

  // POST /claude — generar relato editorial fashion
  if (req.method === 'POST' && req.url === '/claude') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let prompt = '';
      try { prompt = JSON.parse(body).prompt; }
      catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: 'JSON invalido' })); return; }

      const SISTEMA_EDITORIAL = 'Eres la editora de PASARELA\u2122, revista de moda y talento latina con 37 a\u00f1os en Dallas, Texas, fundada por Nadeska Salas.\n\nREGLAS ABSOLUTAS:\n1. Escribe SIEMPRE con voz editorial propia (\"En PASARELA creemos...\", \"Desde nuestra perspectiva...\").\n2. NUNCA menciones la fuente original. CERO referencias externas.\n3. El art\u00edculo debe sentirse 100% original, investigado y producido por PASARELA.\n4. Voz: sofisticada, empoderada, latina, editorial. M\u00e1x 2 frases en ingl\u00e9s.\n5. Estructura: apertura impactante → desarrollo con perspectiva propia → cierre inspiracional.\n6. Extensi\u00f3n: 280-420 palabras. Denso pero elegante.\n7. PROHIBIDO: citar fuentes, usar \"seg\u00fan\", \"de acuerdo con\", \"reporta\", \"informa\", \"se\u00f1ala\", \"publica\".';

      const payload = JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        system: SISTEMA_EDITORIAL,
        messages: [{ role: 'user', content: prompt }],
      });

      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(payload),
        },
      };

      const apiReq = https.request(options, apiRes => {
        let data = '';
        apiRes.on('data', chunk => { data += chunk; });
        apiRes.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) { res.writeHead(200); res.end(JSON.stringify({ error: parsed.error.message })); return; }
            const texto = parsed.content?.[0]?.text || 'Sin respuesta';
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ texto }));
          } catch(e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'MATERIALIZE_FAILED', message: e.message }));
          }
        });
      });
      apiReq.on('error', err => { res.writeHead(500); res.end(JSON.stringify({ error: err.message })); });
      apiReq.write(payload);
      apiReq.end();
    });
    return;
  }

  // POST /publicar-blog — guardar noticia en PostgreSQL
  if (req.method === 'POST' && req.url === '/publicar-blog') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { titulo, contenido, tono, imagen } = JSON.parse(body);
        if (!titulo || !contenido) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'titulo y contenido son requeridos' }));
          return;
        }
        const slug = generarSlug(titulo);
        const result = await pool.query(
          'INSERT INTO noticias (titulo, contenido, tono, slug, publicado, imagen) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
          [titulo, contenido, tono || 'editorial', slug, true, imagen || '']
        );
        const post = result.rows[0];
        const url = `https://pasarelastudiointer.com/noticias/${slug}`;
        console.log(`✓ Publicado: ${titulo} → ${url}`);
        publicarEnFacebook(titulo, contenido, url, imagen || '').catch(e => console.error('[Facebook] Error en publicar-blog:', e.message));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ url, id: post.id, slug }));
      } catch(e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // POST /titulo-editorial
  if (req.method === 'POST' && req.url === '/titulo-editorial') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let titulo = '';
      try { titulo = JSON.parse(body).titulo; }
      catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: 'JSON invalido' })); return; }

      const prompt = `Eres director de arte editorial de la revista PASARELA™, inspirada en Vogue, Harper's Bazaar y Elle.

Tu tarea: transformar este título de noticia en un titular editorial premium para portada de revista.

TÍTULO ORIGINAL: "${titulo}"

REGLAS ESTRICTAS:
1. El titular debe ser corto, viral y emocional. Máximo 8 palabras en total.
2. Dividir en TRES partes:
   - "titular": 4 a 6 palabras descriptivas en mayúsculas. Va arriba, fuente pequeña.
   - "gancho": 2 a 3 frases emocionales en minúsculas, estilo Vogue. Máximo 120 caracteres. Sofisticado, evocador, con actitud. No mencionar la fuente original.
   - "hero": 1 a 3 palabras impactantes en mayúsculas. Va abajo, fuente ENORME. El nombre de la persona, marca o concepto más poderoso.
3. El "hero" debe ser el nombre de la persona, marca o concepto más poderoso del titular.
4. Nunca uses artículos (el, la, los, las, un, una) en el hero.
5. El resultado debe verse como portada de Vogue, nunca como título de nota de blog.

Responde ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown:
{"titular": "TEXTO AQUÍ", "gancho": "texto aquí en minúsculas", "hero": "TEXTO AQUÍ"}`;

      const payload = JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      });

      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(payload),
        },
      };

      const apiReq = https.request(options, apiRes => {
        let data = '';
        apiRes.on('data', chunk => { data += chunk; });
        apiRes.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const texto = parsed.content?.[0]?.text || '{}';
            const resultado = JSON.parse(texto.trim());
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(resultado));
          } catch(e) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ titular: titulo.toUpperCase().substring(0, 40), hero: 'EXCLUSIVA' }));
          }
        });
      });
      apiReq.on('error', err => { res.writeHead(500); res.end(JSON.stringify({ error: err.message })); });
      apiReq.write(payload);
      apiReq.end();
    });
    return;
  }

  // POST /api/materialize
  if (req.method === 'POST' && req.url === '/api/materialize') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let idea = '';
      try {
        const parsed = JSON.parse(body);
        idea = (parsed.idea || '').trim();
      } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'INVALID_JSON', message: 'Body no es JSON válido' }));
        return;
      }

      if (!idea) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'IDEA_REQUIRED', message: 'El campo idea es obligatorio' }));
        return;
      }

      console.log('[materialize] iniciando request');
      const { ThinkingEngine } = require('./src/services/ThinkingEngine');
      console.log('[materialize] ThinkingEngine cargado');
      const engine = new ThinkingEngine();
      const brief = engine.analyze(idea);

      console.log('[ThinkingEngine] Brief generado:', JSON.stringify(brief));

      const systemPrompt = `Eres el motor editorial de PASARELA, revista de moda y talento latina con 37 años en Dallas, Texas.
Devuelves ÚNICAMENTE JSON puro, sin markdown, sin texto adicional.
La categoría DEBE ser exactamente una de: MODA, BELLEZA, TALENTO, EVENTOS, LIFESTYLE, EXCLUSIVAS.
Titular en MAYÚSCULAS máx 8 palabras.
Gancho: 2-3 líneas emocionales separadas por \\n, estilo fashion magazine, en minúscula.
Hero: UNA palabra en MAYÚSCULAS.
Formato exacto: {"categoria":"MODA","titular":"...","gancho":"...\\n...\\n...","hero":"..."}`;

      const userMessage = `Editorial Brief — PASARELA ThinkingEngine:
- Idea: "${brief.originalIdea}"
- Categoría: ${brief.category}
- Estilo: ${brief.editorialStyle}
- Hero: "${brief.hero.text}" [${brief.hero.type}]
- Emoción: ${brief.emotionProfile.primaryEmotion} / ${brief.emotionProfile.secondaryEmotion}
- Tono: ${brief.emotionProfile.tone}

VISUAL PROMPT DOMINANCE:
${brief.promptDominance.positiveTerms.join('\n')}

${brief.promptDominance.negativeTerms.join('\n')}

INSTRUCCIONES:
1. Categoría DEBE ser: ${brief.category}
2. Hero DEBE ser exactamente: "${brief.hero.text}"
3. Titular debe reflejar: ${brief.emotionProfile.primaryEmotion}
4. Gancho debe sonar: ${brief.emotionProfile.tone}
5. El gancho NO debe evocar: ${brief.promptDominance.negativeTerms.slice(0,3).join(', ')}`;

      const payload = JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(payload),
        },
      };

      const apiReq = https.request(options, apiRes => {
        let data = '';
        apiRes.on('data', chunk => { data += chunk; });
        apiRes.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'ANTHROPIC_ERROR', message: parsed.error.message }));
              return;
            }
            const raw = (parsed.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
            const editorial = JSON.parse(raw);
            const valid = ['MODA','BELLEZA','TALENTO','EVENTOS','LIFESTYLE','EXCLUSIVAS'];
            const categoria = valid.includes((editorial.categoria || '').toUpperCase()) ? editorial.categoria.toUpperCase() : 'EXCLUSIVAS';
            const n = new Date();
            const pdpId = `PDP-${String(n.getFullYear()).slice(2)}${String(n.getMonth()+1).padStart(2,'0')}${String(n.getDate()).padStart(2,'0')}-${String(Math.floor(Math.random()*9000)+1000)}`;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              data: { categoria, titular: editorial.titular || 'PASARELA', gancho: editorial.gancho || 'El estilo es una declaración.', hero: editorial.hero || 'PODER', pdpId }
            }));
          } catch(e) {
            console.error('MATERIALIZE_ERROR:', e);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'MATERIALIZE_FAILED', message: e.message }));
          }
        });
      });
      apiReq.on('error', err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'NETWORK_ERROR', message: err.message }));
      });
      apiReq.write(payload);
      apiReq.end();
    });
    return;
  }


  // POST /auto-publicar — publicar automaticamente los mejores articulos del dia
  if (req.method === 'POST' && req.url === '/auto-publicar') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      let cantidad = 3;
      try { cantidad = JSON.parse(body).cantidad || 3; } catch(e) {}

      if (cacheNoticias.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ publicados: 0, error: 'Cache RSS vacio' }));
        return;
      }

      const prioridad = ['Moda', 'Belleza', 'Talento', 'Dallas', 'Lifestyle'];
      const seleccionadas = [];
      for (const cat of prioridad) {
        const del_cat = cacheNoticias.filter(n => n.scope === cat && n.titulo.length > 20);
        seleccionadas.push(...del_cat.slice(0, 2));
        if (seleccionadas.length >= cantidad * 2) break;
      }
      const aPublicar = seleccionadas.slice(0, cantidad);
      const resultados = [];

      for (const noticia of aPublicar) {
        try {
          const promptEditorial = 'Escribe un articulo editorial original sobre este tema de moda/belleza/talento:\n\nTEMA: ' + noticia.titulo + '\nCONTEXTO: ' + (noticia.descripcion || '') + '\nCATEGORIA: ' + noticia.scope + '\n\nEl articulo es para PASARELA, revista de moda latina de Dallas. Voz propia, sin citar fuentes.';
          const genPayload = JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 1200,
            system: 'Eres la editora de PASARELA™, revista de moda latina de Dallas con 37 años, fundada por Nadeska Salas. Voz sofisticada, empoderada, latina. NUNCA cites fuentes externas ni menciones la fuente original. Primera persona editorial. 280-420 palabras. FIRMA obligatoria después del primer párrafo: "— Por la editora de PASARELA™ —". NUNCA uses "Equipo de Redacción".',
            messages: [{ role: 'user', content: promptEditorial }],
          });

          const contenido = await new Promise((resolve, reject) => {
            const opts = {
              hostname: 'api.anthropic.com',
              path: '/v1/messages',
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(genPayload) },
            };
            const r = https.request(opts, apiRes => {
              let d = '';
              apiRes.on('data', c => { d += c; });
              apiRes.on('end', () => { try { resolve(JSON.parse(d).content?.[0]?.text || ''); } catch(e) { reject(e); } });
            });
            r.on('error', reject);
            r.write(genPayload);
            r.end();
          });

          if (!contenido) { resultados.push({ titulo: noticia.titulo, error: 'Claude sin respuesta' }); continue; }

          const slug = generarSlug(noticia.titulo);
          const result = await pool.query(
            'INSERT INTO noticias (titulo, contenido, tono, slug, publicado, imagen) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [noticia.titulo, contenido, 'editorial', slug, true, noticia.imagen || '']
          );
          const url = 'https://pasarelastudiointer.com/noticias/' + slug;
          console.log('[auto-publicar] Publicado: ' + noticia.titulo);
          noticia.imagen
  ? publicarFotoFacebook(noticia.imagen, noticia.titulo + '\n\n' + contenido.substring(0,200) + '...\n\n🔗 ' + url)
  : publicarEnFacebook(noticia.titulo, contenido, url, '')
        } catch(e) {
          console.error('[auto-publicar] Error:', e.message);
          resultados.push({ titulo: noticia.titulo, error: e.message });
        }
      }

      const exitosos = resultados.filter(r => r.url).length;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ publicados: exitosos, total: aPublicar.length, resultados }));
    });
    return;
  }


  // POST /foto-facebook — publicar foto manualmente
  if (req.method === 'POST' && req.url === '/foto-facebook') {
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', async () => {
      const { imageUrl, caption } = JSON.parse(body || '{}');
      if (!imageUrl) { res.writeHead(400); res.end(JSON.stringify({ error: 'imageUrl requerido' })); return; }
      const id = await publicarFotoFacebook(imageUrl, caption || '✨ PASARELA™ — Moda, cultura e identidad latina. #ModaLatina #Pasarela #DallasFashion');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: !!id, photo_id: id }));
    });
    return;
  }

  // POST /story-facebook — publicar Story manualmente
  if (req.method === 'POST' && req.url === '/story-facebook') {
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', async () => {
      const data = JSON.parse(body || '{}');
      const imageUrl = data.imageUrl || (() => {
        const conImg = cacheNoticias.filter(n => n.imagen && n.imagen.startsWith('http'));
        return conImg.length > 0 ? conImg[Math.floor(Math.random() * conImg.length)].imagen : null;
      })();
      if (!imageUrl) { res.writeHead(400); res.end(JSON.stringify({ error: 'No hay imagen disponible' })); return; }
      const id = await publicarStoryFacebook(imageUrl);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: !!id, story_id: id, imagen: imageUrl }));
    });
    return;
  }

  // GET /debug-env — diagnostico variables de entorno
  if (req.method === 'GET' && req.url === '/debug-env') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      FB_TOKEN_PRESENT: !!process.env.FACEBOOK_PAGE_TOKEN,
      FB_TOKEN_LENGTH: (process.env.FACEBOOK_PAGE_TOKEN || '').length,
      FB_TOKEN_START: (process.env.FACEBOOK_PAGE_TOKEN || '').substring(0, 8),
      FB_PAGE_ID: process.env.FACEBOOK_PAGE_ID || 'not_set',
      NODE_ENV: process.env.NODE_ENV || 'not_set'
    }));
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Servidor Pasarela Studio corriendo en http://0.0.0.0:3000');
});

// Auto-publicar cada 6 horas (3 articulos por ciclo)
setInterval(async () => {
  console.log('[CRON] Iniciando auto-publicacion...');
  if (cacheNoticias.length === 0) { console.log('[CRON] Cache vacio, saltando'); return; }
  try {
    const prioridad = ['Moda', 'Belleza', 'Talento', 'Dallas', 'Lifestyle'];
    const seleccionadas = [];
    for (const cat of prioridad) {
      const del_cat = cacheNoticias.filter(n => n.scope === cat && n.titulo.length > 20);
      seleccionadas.push(...del_cat.slice(0, 2));
      if (seleccionadas.length >= 6) break;
    }
    const aPublicar = seleccionadas.slice(0, 3);
    for (const noticia of aPublicar) {
      try {
        // Filtro de relevancia — solo moda, belleza, talento, modelaje
        const filtroPayload = JSON.stringify({
          model: 'claude-haiku-3-5', max_tokens: 5,
          system: 'Responde SOLO con SI o NO. Sin explicacion.',
          messages: [{ role: 'user', content: '¿Este titular es relevante para una revista de moda, belleza, talento o modelaje? Titulo: "' + noticia.titulo + '"' }]
        });
        const relevante = await new Promise((resolve, reject) => {
          const opts = { hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(filtroPayload) } };
          const r = https.request(opts, apiRes => { let d = ''; apiRes.on('data', c => { d += c; }); apiRes.on('end', () => { try { resolve(JSON.parse(d).content?.[0]?.text || 'NO'); } catch(e) { reject(e); } }); });
          r.on('error', reject); r.write(filtroPayload); r.end();
        });
        if (!relevante.trim().toUpperCase().startsWith('SI')) { console.log('[CRON] Descartado off-brand:', noticia.titulo); continue; }

        const promptCron = 'Escribe un articulo editorial original sobre: ' + noticia.titulo + '. Contexto: ' + (noticia.descripcion || '') + '. Para PASARELA, revista de moda latina. Voz propia, sin citar fuentes.';
        const genPayload = JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1200,
          system: 'Eres la editora de PASARELA™, revista de moda latina de Dallas con 37 años, fundada por Nadeska Salas. Voz sofisticada, empoderada, latina. NUNCA cites fuentes externas ni menciones la fuente original. Primera persona editorial. 280-420 palabras. FIRMA obligatoria después del primer párrafo: "— Por la editora de PASARELA™ —". NUNCA uses "Equipo de Redacción".',
          messages: [{ role: 'user', content: promptCron }],
        });
        const contenido = await new Promise((resolve, reject) => {
          const opts = { hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(genPayload) } };
          const r = https.request(opts, apiRes => { let d = ''; apiRes.on('data', c => { d += c; }); apiRes.on('end', () => { try { resolve(JSON.parse(d).content?.[0]?.text || ''); } catch(e) { reject(e); } }); });
          r.on('error', reject); r.write(genPayload); r.end();
        });
        if (!contenido) continue;
        const slug = generarSlug(noticia.titulo);
        await pool.query('INSERT INTO noticias (titulo, contenido, tono, slug, publicado, imagen) VALUES ($1, $2, $3, $4, $5, $6)', [noticia.titulo, contenido, 'editorial', slug, true, noticia.imagen || '']);
        console.log('[CRON] Publicado en blog: ' + noticia.titulo);
        // Publicar cover editorial en Facebook
        try {
          const teaserPayload = JSON.stringify({
            model: 'claude-sonnet-4-6', max_tokens: 120,
            system: 'Eres la directora digital de PASARELA™ revista. Escribe SOLO el caption para Facebook: 2 líneas editoriales impactantes sobre el tema, luego 5 hashtags relevantes. Sin comillas, sin asteriscos, sin markdown.',
            messages: [{ role: 'user', content: 'Caption de revista para Facebook sobre: ' + noticia.titulo }]
          });
          const teaser = await new Promise((resolve, reject) => {
            const opts2 = { hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(teaserPayload) } };
            const r2 = https.request(opts2, apiRes2 => { let d2 = ''; apiRes2.on('data', c => { d2 += c; }); apiRes2.on('end', () => { try { resolve(JSON.parse(d2).content?.[0]?.text || ''); } catch(e) { reject(e); } }); });
            r2.on('error', reject); r2.write(teaserPayload); r2.end();
          });
          if (teaser) {
            const coverBuffer = await generarCoverPasarela(noticia.titulo.substring(0, 80));
            await publicarFotoBuffer(coverBuffer, teaser);
            console.log('[CRON] Cover publicado en Facebook:', noticia.titulo);
          }
        } catch(efb) { console.error('[CRON] Error Facebook cover:', efb.message); }
        // Publicar mismo artículo en páginas extra con voz adaptada
        if (PAGES_EXTRA.length > 0) {
          for (const page of PAGES_EXTRA) {
            if (!page.token) continue;
            // Verificar relevancia para el nicho de la página extra
            const tituloRelevante = page.temas.some(t => noticia.titulo.toLowerCase().includes(t));
            if (!tituloRelevante) continue;
            await publicarCoverParaPagina(page, noticia.titulo).catch(e => console.error('[MultiPage] Error blog:', e.message));
            await new Promise(r => setTimeout(r, 8000));
          }
        }
      } catch(e) { console.error('[CRON] Error:', e.message); }
    }
  } catch(e) { console.error('[CRON] Error general:', e.message); }
}, 6 * 60 * 60 * 1000);
// ============================================================
// GENERADOR DE COVERS EDITORIALES PASARELA TU REVISTA
// ============================================================
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
let fontsLoaded = false;
async function setupFonts() {
  if (fontsLoaded) return;
  const fs = require('fs');
  const fonts = [
    { url: 'https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5.0.18/files/playfair-display-latin-700-normal.woff2', path: '/tmp/serif-bold.woff2', family: 'PSSerif' },
    { url: 'https://cdn.jsdelivr.net/npm/@fontsource/outfit@5.0.15/files/outfit-latin-400-normal.woff2', path: '/tmp/sans-reg.woff2', family: 'PSSans' },
    { url: 'https://cdn.jsdelivr.net/npm/@fontsource/outfit@5.0.15/files/outfit-latin-700-normal.woff2', path: '/tmp/sans-bold.woff2', family: 'PSSansBold' }
  ];
  for (const f of fonts) {
   try {
    if (f.url && !fs.existsSync(f.path)) { fs.writeFileSync(f.path, await fetchBuf(f.url)); }
    GlobalFonts.registerFromPath(f.path, f.family);
    console.log('[fonts]', f.family, 'OK');
  } catch(e) { console.log('[fonts] Error:', f.family, e.message); }
 }
  fontsLoaded = true;
}
try {
  ['/usr/share/fonts', '/usr/local/share/fonts', '/usr/share/fonts/truetype'].forEach(d => {
    try { GlobalFonts.loadFontsFromDir(d); } catch(e) {}
  });
  console.log('[fonts] Sistema cargado');
} catch(e) { console.log('[fonts] Sin fuentes sistema'); }
const FormData = require('form-data');

const EDITORIAL_POOL = [
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1080&q=85',
  'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1080&q=85',
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1080&q=85',
  'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1080&q=85',
  'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=1080&q=85',
  'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=1080&q=85',
  'https://images.unsplash.com/photo-1581338834647-b0fb40704e21?w=1080&q=85',
  'https://images.unsplash.com/photo-1566206091558-7f218b696731?w=1080&q=85',
  'https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=1080&q=85',
  'https://images.unsplash.com/photo-1523359346063-d879354c0ea5?w=1080&q=85',
  'https://images.unsplash.com/photo-1550614000-4895a10e1bfd?w=1080&q=85',
  'https://images.unsplash.com/photo-1614251056216-f748f76cd228?w=1080&q=85',
  'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=1080&q=85',
  'https://images.unsplash.com/photo-1585914641050-fa5466c2e3d0?w=1080&q=85',
  'https://images.unsplash.com/photo-1537832816519-689ad163239b?w=1080&q=85'
];

async function fetchBuf(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; PasarelaBot/1.0)',
      'Accept': 'image/*'
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '', lines = [];
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line.trim());
      line = word + ' ';
    } else { line = test; }
  }
  if (line.trim()) lines.push(line.trim());
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.slice(0, 4).forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
}

async function generarCoverPasarela(titulo = '') {
  await setupFonts();
  const W = 1080, H = 1080;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Foto editorial de fondo
  const imgUrl = `https://picsum.photos/seed/${Math.floor(Math.random() * 999) + 1}/1080/1080`;
  try {
    const buf = await fetchBuf(imgUrl);
    const img = await loadImage(buf);
    const scale = Math.max(W / img.width, H / img.height);
    const sw = img.width * scale, sh = img.height * scale;
    ctx.drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh);
  } catch(e) {
    ctx.fillStyle = '#0D0A0B';
    ctx.fillRect(0, 0, W, H);
  }

  // Gradiente oscuro editorial
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(13,10,11,0.55)');
  grad.addColorStop(0.35, 'rgba(13,10,11,0.15)');
  grad.addColorStop(1, 'rgba(13,10,11,0.92)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Barra superior burgundy
  ctx.fillStyle = '#7B2D3E';
  ctx.fillRect(0, 0, W, 95);

  // PASARELA
  ctx.fillStyle = '#E8C5B0';
  ctx.font = 'bold 54px PSSerif';
  ctx.textAlign = 'center';
  ctx.fillText('P A S A R E L A', W / 2, 62);

  // TU REVISTA
  ctx.fillStyle = '#C9A66B';
  ctx.font = '22px PSSans';
  ctx.fillText('T U   R E V I S T A', W / 2, 88);

  // Línea gold
  ctx.strokeStyle = '#C9A66B';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(60, 105); ctx.lineTo(W - 60, 105);
  ctx.stroke();

  // Título principal
  if (titulo) {
    const texto = titulo.toUpperCase().split(' ').slice(0, 10).join(' ');
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 66px PSSerif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 14;
    wrapText(ctx, texto, W / 2, H - 230, W - 120, 74);
    ctx.shadowBlur = 0;
  }

  // Barra inferior
  ctx.fillStyle = '#7B2D3E';
  ctx.fillRect(0, H - 85, W, 85);

  ctx.fillStyle = '#C9A66B';
  ctx.font = 'bold 17px PSSansBold';
  ctx.textAlign = 'center';
  ctx.fillText('PASARELA STUDIO INTERNACIONAL  ·  DALLAS, TX', W / 2, H - 50);

  ctx.fillStyle = '#E8C5B0';
  ctx.font = '14px PSSans';
  ctx.fillText('pasarelastudiointer.com  ·  @PASARELASTUDIO', W / 2, H - 28);

  return canvas.toBuffer('image/png');
}

async function publicarFotoBuffer(buffer, caption) {
  // Obtener page access token desde user token
  let pageToken = FB_PAGE_TOKEN;
  try {
    const tr = await fetch(`https://graph.facebook.com/v19.0/${FB_PAGE_ID}?fields=access_token&access_token=${FB_PAGE_TOKEN}`);
    const td = await tr.json();
    if (td.access_token) pageToken = td.access_token;
    console.log('[publicarFotoBuffer] Page token obtenido:', !!td.access_token);
  } catch(e) { console.log('[publicarFotoBuffer] Usando token original'); }

  const fs = require('fs');
  const FormData = require('form-data');
  const tmpPath = `/tmp/cover_${Date.now()}.png`;
  fs.writeFileSync(tmpPath, buffer);
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('source', fs.createReadStream(tmpPath));
    form.append('caption', caption);
    form.append('access_token', pageToken);
    form.submit(`https://graph.facebook.com/v19.0/${FB_PAGE_ID}/photos`, (err, res) => {
      fs.unlinkSync(tmpPath);
      if (err) return reject(err);
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(`FB: ${json.error.message}`));
          console.log('[publicarFotoBuffer] Publicado:', json.id);
          resolve(json);
        } catch(e) { reject(e); }
      });
    });
  });
}
function getImagenPasarela() {
  const seed = Math.floor(Math.random() * 999) + 1;
  return `https://picsum.photos/seed/${seed}/1080/1080`;
}

// CRON FOTOS — cada 4 horas, 2 fotos con caption editorial AI
setInterval(async () => {
  console.log('[CRON-FOTO] Iniciando publicacion de fotos...');
  if (!FB_PAGE_TOKEN) { console.log('[CRON-FOTO] Sin token Facebook, saltando'); return; }
  try {
    for (let _i = 0; _i < 2; _i++) {
      try {
        
        const captionPayload = JSON.stringify({
          model: 'claude-sonnet-4-6', max_tokens: 200,
          system: 'Eres la editora de PASARELA™. Escribe SOLO el caption, sin preámbulo, sin comillas, sin asteriscos ni markdown. Max 2 líneas de texto editorial poderoso sobre moda latina en Dallas. Termina con 3 hashtags: #ModaLatina #PasarelaStudio #DallasFashion',
          messages: [{ role: 'user', content: 'Genera un caption editorial para PASARELA™' }],
        });
        const caption = await new Promise((resolve, reject) => {
          const opts = { hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(captionPayload) } };
          const r = https.request(opts, apiRes => { let d = ''; apiRes.on('data', c => { d += c; }); apiRes.on('end', () => { try { resolve(JSON.parse(d).content?.[0]?.text || ''); } catch(e) { reject(e); } }); });
          r.on('error', reject); r.write(captionPayload); r.end();
        });
        if (!caption) continue;
        const buffer = await generarCoverPasarela(caption); 
        await publicarFotoBuffer(buffer, caption);
        console.log('[CRON-FOTO] Foto publicada OK');
        await new Promise(r => setTimeout(r, 30000));
      } catch(e) { console.error('[CRON-FOTO] Error:', e.message); }
    }
  } catch(e) { console.error('[CRON-FOTO] Error general:', e.message); }
  // Publicar en páginas extra con contenido del mismo nicho
  if (PAGES_EXTRA.length > 0) {
    const temasAleatorios = ['tendencias de la temporada', 'estilo editorial', 'moda latina', 'looks de la semana', 'accesorios imprescindibles'];
    const temaExtra = temasAleatorios[Math.floor(Math.random() * temasAleatorios.length)];
    for (const page of PAGES_EXTRA) {
      if (!page.token) continue;
      await publicarCoverParaPagina(page, temaExtra).catch(e => console.error('[MultiPage] Error CRON-FOTO:', e.message));
      await new Promise(r => setTimeout(r, 10000)); // 10s entre páginas
    }
  }
}, 4 * 60 * 60 * 1000);

// CRON STORIES — cada 2 horas (Stories = mayor ingreso de monetizacion)
setInterval(async () => {
  console.log('[CRON-STORY] Iniciando Story...');
  if (!FB_PAGE_TOKEN) { console.log('[CRON-STORY] Sin token Facebook, saltando'); return; }
   try {
    const imgUrl = `https://picsum.photos/seed/${Math.floor(Math.random() * 999) + 1}/1080/1080`;
    await publicarStoryFacebook(imgUrl);
    console.log('[CRON-STORY] Story publicada OK');
  } catch(e) { console.error('[CRON-STORY] Error:', e.message); }
}, 2 * 60 * 60 * 1000);
  
// CRON ENGAGEMENT — cada 3 horas, post inspiracional con imagen
setInterval(async () => {
  console.log('[CRON-ENGAGE] Iniciando post de engagement...');
  if (!FB_PAGE_TOKEN) { console.log('[CRON-ENGAGE] Sin token Facebook, saltando'); return; }
  try {
    const temas = ['elegancia latina', 'moda como identidad', 'empowerment femenino', 'Dallas fashion scene', 'cultura latina y moda', 'belleza autentica', 'estilo editorial', 'mujer empoderada', 'modelaje profesional Dallas', 'fashion week inspiracion'];
    const tema = temas[Math.floor(Math.random() * temas.length)];
    const engagePayload = JSON.stringify({
      model: 'claude-sonnet-4-6', max_tokens: 220,
      system: 'Eres la editora de PASARELA™ en Facebook. Crea un post de engagement: frase inspiracional de moda, pregunta a la comunidad, o insight editorial. Max 4 lineas. Voz empoderada, latina. Emojis elegantes. 3-4 hashtags. Invita a comentar o compartir. Firma: — PASARELA™',
      messages: [{ role: 'user', content: 'Post de engagement sobre: ' + tema }],
    });
    const post = await new Promise((resolve, reject) => {
      const opts = { hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(engagePayload) } };
      const r = https.request(opts, apiRes => { let d = ''; apiRes.on('data', c => { d += c; }); apiRes.on('end', () => { try { resolve(JSON.parse(d).content?.[0]?.text || ''); } catch(e) { reject(e); } }); });
      r.on('error', reject); r.write(engagePayload); r.end();
    });
    if (!post) return;
    const buffer = await generarCoverPasarela(post);
    await publicarFotoBuffer(buffer, post);
    console.log('[CRON-ENGAGE] Post engagement publicado — tema:', tema);
  } catch(e) { console.error('[CRON-ENGAGE] Error:', e.message); }
}, 3 * 60 * 60 * 1000);

const PORT = process.env.PORT || 3000;