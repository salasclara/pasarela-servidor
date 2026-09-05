const http = require('http');
const https = require('https');
const { Pool } = require('pg');

// ============================================================
// GLOBAL ERROR HANDLERS — captura crashes silenciosos
// ============================================================
process.on('uncaughtException', (err) => {
  console.error('[CRASH] uncaughtException:', err.message);
  console.error(err.stack);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRASH] unhandledRejection:', reason);
});


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
    token: process.env.COMUNIDAD_FE_PAGE_TOKEN,
    nombre: 'Comunidad de Fe Maravillas Del Reino',
    nicho: 'fe, comunidad y empoderamiento femenino cristiano',
    tipo: 'fe',
    voice: 'Eres la voz de Comunidad de Fe Maravillas Del Reino. Escribe declaraciones bíblicas de identidad para familias latinas. Voz cálida, llena de fe. Solo español. NUNCA menciones moda ni Pasarela.',
    hashtags: '#MaravillaDelReino #FeCristiana #Esperanza',
    temas: ['versículos bíblicos', 'fe', 'esperanza', 'familia cristiana', 'mujer de fe', 'hijos', 'amor de Dios', 'propósito divino', 'bendición', 'oración', 'gratitud a Dios', 'vida en Cristo'],
    branding: {
      colorBarra: '#0D2E6E',
      colorAccento: '#C9A66B',
      colorTexto: '#C9A66B',
      nombreMarca: 'MARAVILLAS DEL REINO',
      subtituloMarca: 'COMUNIDAD DE FE',
      footerLinea1: 'Comunidad de Fe Maravillas Del Reino  ·  Dallas, TX',
      footerLinea2: '@MaravillaDelReino',
      imagePool: [
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&q=90',
        'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=1080&q=90',
        'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1080&q=90',
        'https://images.unsplash.com/photo-1511895426328-dc8714191011?w=1080&q=90',
        'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=1080&q=90',
        'https://images.unsplash.com/photo-1475483768296-6163e08872a1?w=1080&q=90',
        'https://images.unsplash.com/photo-1490750967868-88df5691cc5e?w=1080&q=90',
        'https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=1080&q=90',
      ]
    }
  },
  // ✅ ACTIVA — Fancy by Roxette
  {
    id: '2645809545432358',
    token: process.env.FANCY_BY_TOKEN,
    tipo: 'fancy',
    nombre: 'Fancy by Roxette',
    nicho: 'moda y accesorios',
    voice: 'Eres la editora de Fancy by Roxette, boutique de moda y accesorios en Dallas. Voz chic, aspiracional y accesible. Mezcla de español e inglés de moda. Tendencias, outfits y estilo de vida.',
    hashtags: '#FancyByRoxette #ModaAccesorios #Tendencias #StyleLatina #FashionDallas #OOTD #BoutiqueDallas',
    temas: ['accesorios', 'moda', 'tendencias', 'looks', 'outfit', 'estilo', 'joyería', 'bolsos', 'belleza', 'maquillaje', 'zapatos', 'ropa'],
    branding: {
      colorBarra: '#2C1A2E',
      colorAccento: '#E8C5B0',
      colorTexto: '#F9F0E8',
      nombreMarca: 'FANCY BY ROXETTE',
      subtituloMarca: 'BOUTIQUE · DALLAS TX',
      footerLinea1: 'Fancy by Roxette  ·  Dallas, TX',
      footerLinea2: '@FancyByRoxette'
    }
  },
  // ✅ ACTIVA — Amar es
  {
    id: '529892146881748',
    token: process.env.AMAR_ES_TOKEN,
    tipo: 'amor',
    nombre: 'Amar es',
    nicho: 'amor, relaciones y lifestyle femenino',
    voice: 'Eres la voz de Amar es. Escribe reflexiones cortas y profundas sobre el amor, las relaciones, el amor propio y el bienestar emocional femenino. Frases que toquen el corazón de la mujer latina. Voz poética, cálida, empática. Solo español. NUNCA menciones moda ni Pasarela.',
    hashtags: '#AmarEs #AmorPropio #ReflexionesDeAmor',
    temas: ['amor propio', 'reflexiones de amor', 'relaciones sanas', 'corazón', 'mujer', 'bienestar emocional', 'pareja', 'autoestima', 'perdón', 'crecimiento personal', 'paz interior', 'felicidad'],
    branding: {
      colorBarra: '#7B3A4A',
      colorAccento: '#E8C5B0',
      colorTexto: '#FFF5F0',
      nombreMarca: 'AMAR ES',
      subtituloMarca: 'AMOR  ·  RELACIONES  ·  BIENESTAR',
      footerLinea1: 'Amar es  ·  Para la mujer latina',
      footerLinea2: '@AmarEs',
      imagePool: [
        'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=1080&q=90',
        'https://images.unsplash.com/photo-1501901609772-df0848060b33?w=1080&q=90',
        'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=1080&q=90',
        'https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=1080&q=90',
        'https://images.unsplash.com/photo-1529467770800-a80e6c2efb42?w=1080&q=90',
        'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=1080&q=90',
        'https://images.unsplash.com/photo-1494774157365-9e04c6720e47?w=1080&q=90',
        'https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?w=1080&q=90',
      ]
    }
  },
  {
    id: '321611941644368',
    nombre: 'Trabajando En Casa',
    tipo: 'trabajando',
    token: process.env.FACEBOOK_TRABA_TOKEN,
    voice: 'Eres la voz de Trabajando En Casa, comunidad de emprendedoras latinas que trabajan desde casa. Voz emprendedora, práctica y motivacional. Inspira con oportunidades reales. Español.',
    hashtags: '#TrabajarDesdeCasa #EmprendimientoLatino #LibertadFinanciera #NegocioDesdeHouse #EmprendedoraLatina',
    temas: ['oportunidades', 'trabajo remoto', 'emprendimiento'],
    branding: {
      colorBarra: '#1A3A2E',
      colorAccento: '#C9A66B',
      colorTexto: '#F0F5E8',
      nombreMarca: 'TRABAJANDO EN CASA',
      subtituloMarca: 'EMPRENDIMIENTO LATINO',
      footerLinea1: 'Trabajando En Casa  ·  Emprendedoras Latinas',
      footerLinea2: '@TrabajarDesdeCasa',
      imagePool: [
        'https://images.unsplash.com/photo-1587614382346-4ec70e388b28?w=1080&q=90',
        'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1080&q=90',
        'https://images.unsplash.com/photo-1483058712412-4245e9b90334?w=1080&q=90',
        'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1080&q=90',
        'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1080&q=90',
        'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1080&q=90',
        'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1080&q=90',
        'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=1080&q=90',
      ]
    }
  }
];

// Función genérica: publica cover editorial en cualquier página

// ============================================================
// CANVAS + COVER GENERATORS
// ============================================================
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const _fontPath = require('path').join(__dirname, 'Roboto-Bold.ttf');
// Registrar fuente al arrancar — @napi-rs/canvas en Linux no usa fuentes del sistema
(async () => {
  try {
    if (!require('fs').existsSync(_fontPath)) {
      console.log('[Fonts] Descargando Roboto-Bold...');
      const _buf = await new Promise(res => {
        require('https').get('https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc9.ttf', r => {
          const c = []; r.on('data', d => c.push(d)); r.on('end', () => res(Buffer.concat(c)));
        }).on('error', () => res(null));
      });
      if (_buf && _buf.length > 10000) { require('fs').writeFileSync(_fontPath, _buf); console.log('[Fonts] Roboto-Bold descargado OK'); }
    }
    if (require('fs').existsSync(_fontPath)) {
      GlobalFonts.registerFromPath(_fontPath, 'Roboto');
      console.log('[Fonts] Roboto registrado para canvas');
    }
  } catch(e) { console.error('[Fonts] Error:', e.message); }
})();

async function descargarImagen(url) {
  if (!url) return null;
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'PasarelaBot/1.0' } }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', () => resolve(null));
  });
}

const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';
async function getImagenCategoria(categoria, query) {
  const QUERIES = {
    'MODA': ['fashion editorial woman', 'elegant fashion latina', 'runway model', 'luxury fashion'],
    'BELLEZA': ['beauty makeup latina', 'skincare beauty', 'cosmetics'],
    'TALENTO': ['model photoshoot', 'fashion photography'],
    'DEFAULT': ['fashion elegance', 'luxury lifestyle'],
  };
  const q = query || (QUERIES[categoria] || QUERIES['DEFAULT'])[Math.floor(Math.random() * 4)];
  try {
    const pexUrl = 'https://api.pexels.com/v1/search?query=' + encodeURIComponent(q) + '&per_page=15&orientation=square';
    const data = await new Promise((resolve, reject) => {
      const opts = new URL(pexUrl);
      const r = https.request({ hostname: opts.hostname, path: opts.pathname + opts.search, headers: { Authorization: PEXELS_API_KEY } }, res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
      });
      r.on('error', reject); r.end();
    });
    const fotos = data.photos || [];
    if (!fotos.length) return null;
    return fotos[Math.floor(Math.random() * fotos.length)].src.large;
  } catch(e) { console.error('[Pexels] Error:', e.message); return null; }
}

const MASTER_PROMPT_AMOR = 'Cute chibi anime couple, kawaii style illustration. Scene: {{SCENE}}. Soft pastel pink and lavender colors, romantic atmosphere, heart decorations, warm lighting. No text in image.';

async function generarCoverPasarela(titulo, imgUrl) {
  const canvas = createCanvas(1080, 1080);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0D0A0B';
  ctx.fillRect(0, 0, 1080, 1080);
  if (imgUrl) {
    try {
      const buf = await descargarImagen(imgUrl);
      if (buf) { const img = await loadImage(buf); ctx.globalAlpha = 0.45; ctx.drawImage(img, 0, 0, 1080, 1080); ctx.globalAlpha = 1; }
    } catch(e) { console.error('[Cover] img error:', e.message); }
  }
  const grad = ctx.createLinearGradient(0, 0, 0, 1080);
  grad.addColorStop(0, 'rgba(13,10,11,0.3)');
  grad.addColorStop(0.6, 'rgba(13,10,11,0.7)');
  grad.addColorStop(1, 'rgba(13,10,11,0.95)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 1080, 1080);
  ctx.fillStyle = '#7B2D3E'; ctx.fillRect(0, 0, 1080, 6);
  ctx.fillStyle = '#C9A66B'; ctx.font = 'bold 22px Roboto'; ctx.textAlign = 'center';
  ctx.fillText('PASARELA\u2122 STUDIO INTERNACIONAL', 540, 55);
  ctx.fillStyle = 'rgba(201,166,107,0.4)'; ctx.fillRect(80, 68, 920, 1);
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 72px Roboto';
  const words = titulo.toUpperCase().split(' ');
  let line = ''; let y = 580;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > 880) { ctx.fillText(line, 540, y); line = w; y += 85; } else line = test;
  }
  if (line) ctx.fillText(line, 540, y);
  ctx.fillStyle = '#C9A66B'; ctx.fillRect(80, y + 30, 920, 3);
  ctx.fillStyle = '#C4826A'; ctx.font = '20px Roboto';
  ctx.fillText('pasarelastudiointer.com  \u00b7  Dallas, TX', 540, 1045);
  return canvas.toBuffer('image/png');
}

function drawImageCover(ctx, img, canvasW, canvasH) {
  const imgAspect    = img.width / img.height;
  const canvasAspect = canvasW / canvasH;
  let drawW, drawH, drawX, drawY;
  if (imgAspect > canvasAspect) {
    drawH = canvasH; drawW = img.width * (canvasH / img.height);
    drawX = (canvasW - drawW) / 2; drawY = 0;
  } else {
    drawW = canvasW; drawH = img.height * (canvasW / img.width);
    drawX = 0; drawY = (canvasH - drawH) / 2;
  }
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

// ── VISUAL ENGINE — Maravillas del Reino ───────────────────────────────────
const VISUAL_ENGINE_FE = [
  { cat: 'FAITH',          queries: ['woman praying', 'hands praying', 'person praying sunrise', 'Bible prayer'] },
  { cat: 'HOPE',           queries: ['hope sunrise', 'sunlight clouds', 'looking at sunrise', 'walking toward light'] },
  { cat: 'GOD_PRESENCE',   queries: ['sun rays clouds', 'heavenly light', 'light through clouds', 'dramatic sky sunlight'] },
  { cat: 'BIBLE',          queries: ['open Bible', 'woman reading Bible', 'Bible study', 'Bible coffee'] },
  { cat: 'PEACE',          queries: ['peaceful nature', 'calm lake sunrise', 'serene landscape', 'quiet morning'] },
  { cat: 'COMFORT',        queries: ['woman reflection', 'woman finding peace', 'hope after sadness', 'light after storm'] },
  { cat: 'GRATITUDE',      queries: ['woman grateful', 'worship hands', 'woman looking sky', 'gratitude nature'] },
  { cat: 'NEW_BEGINNING',  queries: ['new beginning sunrise', 'morning light', 'open road sunrise', 'beautiful dawn'] },
  { cat: 'DIFFICULT_TIMES',queries: ['storm clouds sunlight', 'woman rain window', 'light in darkness', 'hopeful silhouette'] },
  { cat: 'BLESSINGS',      queries: ['flowers sunlight', 'sunflower field', 'golden field sunlight', 'beautiful morning nature'] },
  { cat: 'FAMILY_FAITH',   queries: ['family praying', 'mother daughter praying', 'family holding hands', 'family together home'] },
  { cat: 'PURPOSE',        queries: ['woman walking path', 'road sunrise', 'person mountain path', 'walking toward light'] },
];
function getQueryFe() {
  const cat = VISUAL_ENGINE_FE[Math.floor(Math.random() * VISUAL_ENGINE_FE.length)];
  return cat.queries[Math.floor(Math.random() * cat.queries.length)];
}
const VISUAL_ENGINE_TRABAJANDO = [
  { cat: 'HOME_OFFICE',      queries: ['woman working laptop home', 'hispanic woman home office', 'cozy female home office'] },
  { cat: 'ENTREPRENEUR',     queries: ['latina entrepreneur', 'hispanic business woman', 'female small business owner'] },
  { cat: 'EMPOWERMENT',      queries: ['confident latina woman', 'successful hispanic woman', 'confident female entrepreneur'] },
  { cat: 'PRODUCTIVITY',     queries: ['woman planning desk', 'woman writing planner', 'organized home office'] },
  { cat: 'DIGITAL_BUSINESS', queries: ['woman smartphone business', 'female content creator', 'woman online business'] },
  { cat: 'MOM_ENTREPRENEUR', queries: ['mother working from home', 'working mom laptop', 'mother entrepreneur'] },
  { cat: 'SMALL_BUSINESS',   queries: ['woman packing orders', 'female ecommerce business', 'woman small business owner'] },
  { cat: 'LEARNING',         queries: ['woman studying laptop', 'online learning woman', 'woman taking notes'] },
  { cat: 'LIFESTYLE',        queries: ['woman coffee laptop home', 'woman morning routine', 'woman working cozy home'] },
  { cat: 'SUCCESS',          queries: ['woman celebrating success', 'happy female entrepreneur', 'woman celebrating laptop'] },
];
function getQueryTrabajando() {
  const cat = VISUAL_ENGINE_TRABAJANDO[Math.floor(Math.random() * VISUAL_ENGINE_TRABAJANDO.length)];
  return cat.queries[Math.floor(Math.random() * cat.queries.length)];
}


async function generarCoverFe(branding, afirmacion, hero, versiculo, referencia) {
  const canvas = createCanvas(1080, 1080);
  const ctx    = canvas.getContext('2d');
  ctx.fillStyle = branding.colorBarra || '#0D2E6E';
  ctx.fillRect(0, 0, 1080, 1080);
  const imgUrl = await getImagenCategoria('DEFAULT', getQueryFe());
  if (imgUrl) {
    try {
      const buf = await descargarImagen(imgUrl);
      if (buf) { const img = await loadImage(buf); ctx.globalAlpha = 1; drawImageCover(ctx, img, 1080, 1080); ctx.globalAlpha = 1; }
    } catch(e) { console.error('[CoverFe] imagen:', e.message); }
  }
  const grad = ctx.createLinearGradient(0, 0, 0, 1080);
  grad.addColorStop(0,    'rgba(13,46,110,0.0)');
  grad.addColorStop(0.45, 'rgba(13,46,110,0.10)');
  grad.addColorStop(0.72, 'rgba(13,46,110,0.45)');
  grad.addColorStop(1,    'rgba(13,46,110,0.82)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 1080, 1080);
  ctx.fillStyle = 'rgba(13,46,110,0.60)'; ctx.fillRect(0, 0, 1080, 115);
  ctx.fillStyle = branding.colorAccento || '#C9A66B'; ctx.fillRect(0, 0, 1080, 8);
  ctx.font = 'bold 18px Roboto'; ctx.textAlign = 'center';
  ctx.fillStyle = branding.colorAccento || '#C9A66B';
  ctx.fillText((branding.subtituloMarca || '').toUpperCase(), 540, 44);
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 33px Roboto';
  ctx.fillText(branding.nombreMarca || 'MARAVILLAS DEL REINO', 540, 84);
  ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 18;
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 68px Roboto';
  ctx.fillText(afirmacion.toUpperCase().substring(0, 20), 540, 680);
  ctx.fillStyle = branding.colorAccento || '#C9A66B'; ctx.font = 'bold 92px Roboto';
  ctx.fillText(hero.toUpperCase().substring(0, 14), 540, 790);
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = 'italic 22px Roboto';
  const vw = versiculo.split(' '); let vl = ''; let vy = 870;
  for (const w of vw) { const t = vl ? vl+' '+w : w; if (ctx.measureText(t).width > 880) { ctx.fillText(vl, 540, vy); vl = w; vy += 30; } else vl = t; }
  if (vl) ctx.fillText(vl, 540, vy);
  ctx.fillStyle = branding.colorAccento || '#C9A66B'; ctx.font = 'bold 20px Roboto';
  ctx.fillText('— ' + referencia + ' —', 540, vy + 36);
  ctx.shadowBlur = 0;
  ctx.fillStyle = branding.colorAccento || '#C9A66B'; ctx.fillRect(0, 1072, 1080, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.70)'; ctx.font = '15px Roboto';
  ctx.fillText(branding.footerLinea1 || '', 540, 1056);
  return canvas.toBuffer('image/png');
}
async function generarCoverFancy(branding, titular, subtitulo) {
  const canvas = createCanvas(1080, 1080);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = branding.colorBarra || '#2C1A2E'; ctx.fillRect(0, 0, 1080, 1080);
  const imgUrl = await getImagenCategoria('MODA', 'fashion accessories elegant woman');
  if (imgUrl) {
    try {
      const buf = await descargarImagen(imgUrl);
      if (buf) { const img = await loadImage(buf); ctx.globalAlpha = 0.4; ctx.drawImage(img, 0, 0, 1080, 1080); ctx.globalAlpha = 1; }
    } catch(e) {}
  }
  const grad = ctx.createLinearGradient(0, 0, 0, 1080);
  grad.addColorStop(0, 'rgba(44,26,46,0.35)'); grad.addColorStop(0.5, 'rgba(44,26,46,0.6)'); grad.addColorStop(1, 'rgba(44,26,46,0.95)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 1080, 1080);
  ctx.fillStyle = branding.colorAccento || '#E8C5B0'; ctx.fillRect(0, 0, 1080, 5);
  ctx.font = 'bold 19px Roboto'; ctx.textAlign = 'center';
  ctx.fillText(branding.subtituloMarca || 'BOUTIQUE \u00b7 DALLAS TX', 540, 52);
  ctx.font = 'bold 40px Roboto'; ctx.fillText(branding.nombreMarca || 'FANCY BY ROXETTE', 540, 100);
  ctx.fillStyle = 'rgba(232,197,176,0.35)'; ctx.fillRect(80, 115, 920, 1);
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 86px Roboto';
  const tw = titular.toUpperCase().split(' '); let tl = ''; let ty = 550;
  for (const w of tw) { const t = tl ? tl+' '+w : w; if (ctx.measureText(t).width > 900) { ctx.fillText(tl, 540, ty); tl = w; ty += 98; } else tl = t; }
  if (tl) ctx.fillText(tl, 540, ty);
  if (subtitulo) { ctx.fillStyle = branding.colorAccento || '#E8C5B0'; ctx.font = 'italic 30px Roboto'; ctx.fillText(subtitulo, 540, ty + 52); }
  ctx.fillStyle = branding.colorAccento || '#E8C5B0'; ctx.fillRect(0, 1073, 1080, 5);
  ctx.fillStyle = 'rgba(249,240,232,0.65)'; ctx.font = '17px Roboto';
  ctx.fillText(branding.footerLinea1 || 'Fancy by Roxette \u00b7 Dallas, TX', 540, 1051);
  return canvas.toBuffer('image/png');
}

async function generarCoverTrabajando(branding, coverTitulo) {
  const canvas = createCanvas(1080, 1080);
  const ctx    = canvas.getContext('2d');
  ctx.fillStyle = branding.colorBarra || '#1A3A2E';
  ctx.fillRect(0, 0, 1080, 1080);
  const imgUrl = await getImagenCategoria('DEFAULT', getQueryTrabajando());
  if (imgUrl) {
    try {
      const buf = await descargarImagen(imgUrl);
      if (buf) { const img = await loadImage(buf); ctx.globalAlpha = 1; drawImageCover(ctx, img, 1080, 1080); ctx.globalAlpha = 1; }
    } catch(e) { console.error('[CoverTrabajando] imagen:', e.message); }
  }
  const grad = ctx.createLinearGradient(0, 0, 0, 1080);
  grad.addColorStop(0,    'rgba(26,58,46,0.0)');
  grad.addColorStop(0.50, 'rgba(26,58,46,0.08)');
  grad.addColorStop(0.70, 'rgba(26,58,46,0.40)');
  grad.addColorStop(1,    'rgba(26,58,46,0.88)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 1080, 1080);
  ctx.fillStyle = 'rgba(26,58,46,0.72)'; ctx.fillRect(0, 0, 1080, 120);
  ctx.fillStyle = branding.colorAccento || '#C9A66B'; ctx.fillRect(0, 0, 1080, 6);
  ctx.font = 'bold 18px Roboto'; ctx.textAlign = 'center';
  ctx.fillStyle = branding.colorAccento || '#C9A66B';
  ctx.fillText((branding.subtituloMarca || 'EMPRENDIMIENTO LATINO').toUpperCase(), 540, 40);
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 36px Roboto';
  ctx.fillText(branding.nombreMarca || 'TRABAJANDO EN CASA', 540, 84);
  ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 16;
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 80px Roboto';
  const cw = coverTitulo.toUpperCase().split(' '); let cl = ''; let cy = 740;
  for (const w of cw) { const t = cl ? cl+' '+w : w; if (ctx.measureText(t).width > 920) { ctx.fillText(cl, 540, cy); cl = w; cy += 93; } else cl = t; }
  if (cl) ctx.fillText(cl, 540, cy);
  ctx.shadowBlur = 0;
  ctx.fillStyle = branding.colorAccento || '#C9A66B'; ctx.fillRect(0, 1073, 1080, 6);
  ctx.fillStyle = 'rgba(240,245,232,0.75)'; ctx.font = '15px Roboto';
  ctx.fillText(branding.footerLinea1 || 'Trabajando En Casa · Emprendedoras Latinas', 540, 1051);
  ctx.fillStyle = branding.colorAccento || '#C9A66B'; ctx.font = '13px Roboto';
  ctx.fillText(branding.footerLinea2 || '@TrabajarDesdeCasa', 540, 1067);
  return canvas.toBuffer('image/png');
}

async function generarCoverAmarEs(branding, gancho, reflexion, dallePrompt) {
  const canvas = createCanvas(1080, 1080);
  const ctx    = canvas.getContext('2d');
  ctx.fillStyle = branding.colorBarra || '#7B3A4A';
  ctx.fillRect(0, 0, 1080, 1080);
  if (!process.env.OPENAI_API_KEY || !dallePrompt) {
    console.error('[AmarEs] OPENAI_API_KEY ausente o sin prompt — cancelando'); return null;
  }
  let usedAI = false;
  try {
    const aiPrompt = 'Premium cute chibi anime illustration. Scene: ' + dallePrompt + '. Style: flat colors, big expressive eyes, round chibi faces, warm cinematic lighting, soft pink and lavender palette, romantic atmosphere, floating hearts, bokeh background. NO text. NO letters. NO watermark. NO photorealism. NO watercolor.';
    const body = JSON.stringify({ model: 'gpt-image-1', prompt: aiPrompt, n: 1, size: '1024x1024', quality: 'medium' });
    const r = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY }, body });
    const j = await r.json();
    if (j.data && j.data[0] && j.data[0].b64_json) {
      const img = await loadImage(Buffer.from(j.data[0].b64_json, 'base64'));
      ctx.globalAlpha = 1; drawImageCover(ctx, img, 1080, 1080); ctx.globalAlpha = 1;
      usedAI = true; console.log('[AmarEs] gpt-image-1 OK');
    } else { console.error('[AmarEs] gpt-image-1 sin datos:', JSON.stringify(j).substring(0, 200)); }
  } catch(e) { console.error('[AmarEs] gpt-image-1 error:', e.message); }
  if (!usedAI) { console.error('[AmarEs] OpenAI falló — cancelando publicación'); return null; }
  const grad = ctx.createLinearGradient(0, 0, 0, 1080);
  grad.addColorStop(0,    'rgba(123,58,74,0.0)');
  grad.addColorStop(0.55, 'rgba(123,58,74,0.10)');
  grad.addColorStop(0.78, 'rgba(123,58,74,0.50)');
  grad.addColorStop(1,    'rgba(123,58,74,0.90)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 1080, 1080);
  ctx.fillStyle = 'rgba(123,58,74,0.65)'; ctx.fillRect(0, 0, 1080, 115);
  ctx.fillStyle = branding.colorAccento || '#E8C5B0'; ctx.fillRect(0, 0, 1080, 6);
  ctx.font = 'bold 18px Roboto'; ctx.textAlign = 'center';
  ctx.fillStyle = branding.colorAccento || '#E8C5B0';
  ctx.fillText((branding.subtituloMarca || 'AMOR · RELACIONES · BIENESTAR').toUpperCase(), 540, 40);
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 44px Roboto';
  ctx.fillText(branding.nombreMarca || 'AMAR ES', 540, 84);
  ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 16;
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 72px Roboto';
  const gw = gancho.toUpperCase().split(' '); let gl = ''; let gy = 740;
  for (const w of gw) { const t = gl ? gl+' '+w : w; if (ctx.measureText(t).width > 920) { ctx.fillText(gl, 540, gy); gl = w; gy += 82; } else gl = t; }
  if (gl) ctx.fillText(gl, 540, gy);
  if (reflexion) { ctx.fillStyle = branding.colorAccento || '#E8C5B0'; ctx.font = 'italic 26px Roboto'; ctx.fillText('"' + reflexion + '"', 540, gy + 54); }
  ctx.shadowBlur = 0;
  ctx.fillStyle = branding.colorAccento || '#E8C5B0'; ctx.fillRect(0, 1073, 1080, 6);
  ctx.fillStyle = 'rgba(255,245,240,0.75)'; ctx.font = '15px Roboto';
  ctx.fillText(branding.footerLinea1 || 'Amar es · Para la mujer latina', 540, 1054);
  return canvas.toBuffer('image/png');
}
async function generarCoverGenerico(branding, coverTitulo) {
  const canvas = createCanvas(1080, 1080);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = branding.colorBarra || '#1A3A2E'; ctx.fillRect(0, 0, 1080, 1080);
  const imgUrlGen = await getImagenCategoria('DEFAULT', getQueryTrabajando());
  if (imgUrlGen) {
    try {
      const buf = await descargarImagen(imgUrlGen);
      if (buf) { const img = await loadImage(buf); ctx.globalAlpha = 0.4; ctx.drawImage(img, 0, 0, 1080, 1080); ctx.globalAlpha = 1; }
    } catch(e) { console.error('[CoverGen] imagen error:', e.message); }
  }
  const grad = ctx.createLinearGradient(0, 0, 0, 1080);
  grad.addColorStop(0, 'rgba(26,58,46,0.65)'); grad.addColorStop(1, 'rgba(26,58,46,0.97)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 1080, 1080);
  ctx.fillStyle = branding.colorAccento || '#C9A66B'; ctx.fillRect(0, 0, 1080, 6);
  ctx.font = 'bold 19px Roboto'; ctx.textAlign = 'center';
  ctx.fillText(branding.subtituloMarca || '', 540, 52);
  ctx.font = 'bold 36px Roboto'; ctx.fillText(branding.nombreMarca || '', 540, 96);
  ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 14;
  ctx.fillStyle = branding.colorTexto || '#FFFFFF'; ctx.font = 'bold 80px Roboto';
  const cw = coverTitulo.toUpperCase().split(' '); let cl = ''; let cy = 550;
  for (const w of cw) { const t = cl ? cl+' '+w : w; if (ctx.measureText(t).width > 900) { ctx.fillText(cl, 540, cy); cl = w; cy += 93; } else cl = t; }
  if (cl) ctx.fillText(cl, 540, cy);
  ctx.fillStyle = branding.colorAccento || '#C9A66B'; ctx.fillRect(0, 1073, 1080, 6);
  ctx.fillStyle = 'rgba(240,245,232,0.65)'; ctx.font = '17px Roboto';
  ctx.fillText(branding.footerLinea1 || '', 540, 1051);
  return canvas.toBuffer('image/png');
}

async function generarCoverBlogArticulo(imgBuf, titulo, fecha) {
  const canvas = createCanvas(1080, 566);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0D0A0B'; ctx.fillRect(0, 0, 1080, 566);
  if (imgBuf) {
    try { const img = await loadImage(imgBuf); ctx.globalAlpha = 0.5; ctx.drawImage(img, 0, 0, 1080, 566); ctx.globalAlpha = 1; } catch(e) {}
  }
  const grad = ctx.createLinearGradient(0, 0, 0, 566);
  grad.addColorStop(0, 'rgba(13,10,11,0.2)'); grad.addColorStop(1, 'rgba(13,10,11,0.9)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 1080, 566);
  ctx.fillStyle = '#7B2D3E'; ctx.fillRect(0, 0, 1080, 4);
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 50px Roboto'; ctx.textAlign = 'center';
  const tw = titulo.split(' '); let tl = ''; let ty = 330;
  for (const w of tw) { const t = tl ? tl+' '+w : w; if (ctx.measureText(t).width > 940) { ctx.fillText(tl, 540, ty); tl = w; ty += 60; } else tl = t; }
  if (tl) ctx.fillText(tl, 540, ty);
  ctx.fillStyle = '#C9A66B'; ctx.font = '19px Roboto';
  ctx.fillText('PASARELA\u2122  \u00b7  ' + (fecha || new Date().toLocaleDateString('es-US')), 540, ty + 40);
  return canvas.toBuffer('image/png');
}

function publicarStoryFacebook(imageUrl) {
  if (!FB_PAGE_TOKEN || !imageUrl) return Promise.resolve(null);
  const postData = new URLSearchParams({ url: imageUrl, access_token: FB_PAGE_TOKEN });
  return new Promise((resolve) => {
    const postBody = postData.toString();
    const opts = { hostname: 'graph.facebook.com', path: '/v19.0/' + FB_PAGE_ID + '/photo_stories', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postBody) } };
    const r = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { const p = JSON.parse(d); if (p.id) { console.log('[Story] OK:', p.id); resolve(p.id); } else { console.error('[Story] Error:', JSON.stringify(p)); resolve(null); } } catch(e) { resolve(null); } });
    });
    r.on('error', () => resolve(null));
    r.write(postBody); r.end();
  });
}


async function publicarCoverParaPagina(pageConfig, titulo) {
  if (!pageConfig.token || !pageConfig.id) {
    console.log('[MultiPage] Token o ID faltante para:', pageConfig.nombre);
    return;
  }
  try {
    // Generar caption con la voz del nicho
    const esFe         = pageConfig.tipo === 'fe';
    const esAmor       = pageConfig.tipo === 'amor';
    const esFancy      = pageConfig.tipo === 'fancy';
    const esTrabajando = pageConfig.tipo === 'trabajando';
    const FANCY_CATEGORIAS = [
      { tema: 'vestidos elegantes mujer',        searchTerm: 'vestidos mujer elegantes',          emoji: '👗' },
      { tema: 'zapatos tacones tendencia',        searchTerm: 'tacones mujer moda',                emoji: '👠' },
      { tema: 'bolsos y carteras de moda',        searchTerm: 'bolso de mano mujer elegante',      emoji: '👜' },
      { tema: 'joyería collares y aretes',        searchTerm: 'joyeria mujer elegante set',        emoji: '✨' },
      { tema: 'maquillaje y belleza latina',      searchTerm: 'maquillaje set completo mujer',     emoji: '💄' },
      { tema: 'ropa casual chic mujer',           searchTerm: 'ropa casual elegante mujer',        emoji: '🛍️' },
    ];
    const fancyCat = esFancy ? FANCY_CATEGORIAS[Math.floor(Math.random()*FANCY_CATEGORIAS.length)] : null;
    const AMAZON_TAG = process.env.AMAZON_TAG || 'fancybyroxette-20';
    const formatoFancy = 'Eres la editora jefa de Fancy by Roxette, medio digital de moda para la mujer latina en Dallas. Voz: chic, directa, aspiracional. Responde en este formato exacto (sin comillas ni asteriscos):\nTITULAR: [frase de portada de revista, máx 6 palabras en español, mayúsculas, impactante]\nSUBTITULO: [frase editorial corta máx 10 palabras, española, minúsculas]\nCAPTION: [2 a 3 líneas editoriales en español — por qué esta tendencia/producto es indispensable ahora, primera o segunda persona, voz chic]\nCTA: [llamada a acción corta mencionando que el link está en los comentarios — máx 10 palabras]\nHASHTAGS: #FancyByRoxette — añade 2 más relevantes a: ' + (fancyCat ? fancyCat.tema : 'moda');
    console.log('[MultiPage] tipo:', pageConfig.tipo, '| esFe:', esFe, '| esAmor:', esAmor, '| nombre:', pageConfig.nombre);
    const temaActual = pageConfig.temas && pageConfig.temas.length ? pageConfig.temas[Math.floor(Math.random() * pageConfig.temas.length)] : titulo;
    const formatoAmor = 'Responde en este formato exacto (sin comillas, sin asteriscos, sin texto adicional):\nSCENE: [describe in English a specific romantic scene for the Amor Es chibi couple — location, lighting, specific action, emotion — max 200 chars]\nGANCHO: [frase gancho max 7 palabras en español, mayúsculas, impactante, 2ª persona]\nREFLEXION: [una sola línea poética emotiva max 12 palabras, español, minúsculas]\nMICROHISTORIA: [2 a 3 líneas en segunda persona, emotivas, sin hashtags — narra el momento como si le hablaras directamente a ella]\nCTA: [pregunta conversacional corta para invitar a comentar, español]\nPILAR: [elige uno: amor de pareja | amor propio | relaciones sanas | pequeños gestos cotidianos | sanar y dejar ir | familia y complicidad]\nHASHTAGS: ' + (pageConfig.hashtags || '#AmarEs #AmorPropio') + ' — escoge máximo 3 hashtags relevantes al pilar elegido, sin repetición';
    const formatoFe = 'Responde en este formato exacto (sin comillas ni asteriscos):\nAFIRMACION: [frase corta tipo "SOY..." o "TENGO..." máx 6 palabras]\nHERO: [1 a 3 palabras clave poderosas en mayúsculas, ej: EN CRISTO, PAZ, ORO]\nVERSICULO: [cita bíblica real completa relacionada, máx 120 caracteres]\nREFERENCIA: [libro capítulo:versículo, ej: Juan 3:16]\nCAPTION: [1 o 2 frases inspiradoras para el post de Facebook]\nHASHTAGS: ' + (pageConfig.hashtags || '#Fe #Biblia');
    const formatoGenerico = 'Responde en este formato exacto (sin comillas ni asteriscos):\nCOVER: [frase de MÁXIMO 4 PALABRAS en español — solo sustantivos/adjetivos poderosos]\nCAPTION: [2 líneas reflexivas o inspiradoras]\nHASHTAGS: ' + (pageConfig.hashtags || '#Inspiracion #Reflexion #Vida');
    const formatoTrabajando = 'Responde en este formato exacto (sin comillas ni asteriscos):\nCOVER: [frase de MÁXIMO 4 PALABRAS en español — impactante, motivadora, segunda persona]\nCAPTION: [2 a 3 líneas inspiradoras para emprendedoras latinas — práctica, directa, real]\nHASHTAGS: ' + (pageConfig.hashtags || '#TrabajarDesdeCasa #EmprendimientoLatino');
    const captionPayload = JSON.stringify({
      model: 'claude-sonnet-4-6', max_tokens: 180,
      system: pageConfig.voice + ' ' + (esFe ? formatoFe : esAmor ? formatoAmor : esFancy ? formatoFancy : esTrabajando ? formatoTrabajando : formatoGenerico),
      messages: [{ role: 'user', content: esFancy && fancyCat ? 'Tendencia del día: ' + fancyCat.tema + ' ' + fancyCat.emoji : 'Tema: ' + temaActual }]
    });
    const caption = await new Promise((resolve, reject) => {
      const opts = { hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(captionPayload) } };
      const r = https.request(opts, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d).content?.[0]?.text || ''); } catch(e) { reject(e); } }); });
      r.on('error', reject); r.write(captionPayload); r.end();
    });
    if (!caption) { console.error('[MultiPage] Caption vacío para:', pageConfig.nombre); return; }
    // Extraer campos según tipo
    let coverBuffer;
    let captionTexto = '';
    if (esFe) {
      const afirmMatch    = caption.match(/AFIRMACION:\s*(.+)/i);
      const heroMatch     = caption.match(/HERO:\s*(.+)/i);
      const versMatch     = caption.match(/VERSICULO:\s*(.+)/i);
      const refMatch      = caption.match(/REFERENCIA:\s*(.+)/i);
      const capMatch      = caption.match(/CAPTION:\s*([\s\S]+?)(?=HASHTAGS:|$)/i);
      const afirmacion    = afirmMatch  ? afirmMatch[1].trim()  : 'SOY AMADO';
      const hero          = heroMatch   ? heroMatch[1].trim()   : 'POR DIOS';
      const versiculo     = versMatch   ? versMatch[1].trim()   : '';
      const referencia    = refMatch    ? refMatch[1].trim()    : '';
      captionTexto        = capMatch    ? capMatch[1].trim()    : '';
      console.log('[MultiPage-FE] Afirmacion:', afirmacion, '| Hero:', hero, '| Ref:', referencia);
      coverBuffer = await generarCoverFe(pageConfig.branding, afirmacion, hero, versiculo, referencia);
    } else if (esAmor) {
      const sceneMatch   = caption.match(/SCENE:\s*(.+)/i);
      const ganchoMatch  = caption.match(/GANCHO:\s*(.+)/i);
      const reflexMatch  = caption.match(/REFLEXION:\s*(.+)/i);
      const mhMatch      = caption.match(/MICROHISTORIA:\s*([\s\S]+?)(?=CTA:|HASHTAGS:|$)/i);
      const ctaMatch     = caption.match(/CTA:\s*(.+)/i);
      const hashMatch    = caption.match(/HASHTAGS:\s*(.+)/i);
      const dallePrompt  = sceneMatch  ? sceneMatch[1].trim()  : 'cute chibi couple sharing a tender moment, park, warm afternoon';
      const gancho       = ganchoMatch ? ganchoMatch[1].trim() : titulo.substring(0, 40);
      const reflexion    = reflexMatch ? reflexMatch[1].trim() : '';
      const microhistoria = mhMatch   ? mhMatch[1].trim()     : '';
      const ctaTexto     = ctaMatch   ? ctaMatch[1].trim()    : '';
      const hashTexto    = hashMatch  ? hashMatch[1].trim()   : pageConfig.hashtags || '#AmarEs #AmorPropio';
      // Deduplicar hashtags — evitar repetición
      const hashArr = [...new Set((hashTexto || '').split(/\s+/).filter(h => h.startsWith('#')))].slice(0,4).join(' ');
      captionTexto = microhistoria + (ctaTexto ? '\n\n' + ctaTexto : '') + '\n\n— ' + (pageConfig.branding.footerLinea1 || 'Amar es') + ' ✨\n\n' + hashArr;
      console.log('[AmarEs] SCENE:', dallePrompt);
      console.log('[AmarEs] GANCHO:', gancho);
      console.log('[AmarEs] Llamando gpt-image-1...');
      coverBuffer = await generarCoverAmarEs(pageConfig.branding, gancho, reflexion, dallePrompt);
    } else if (esFancy) {
      const titularMatch  = caption.match(/TITULAR:\s*(.+)/i);
      const subMatch      = caption.match(/SUBTITULO:\s*(.+)/i);
      const capMatch      = caption.match(/CAPTION:\s*([\s\S]+?)(?=CTA:|HASHTAGS:|$)/i);
      const ctaMatch      = caption.match(/CTA:\s*(.+)/i);
      const hashMatch     = caption.match(/HASHTAGS:\s*(.+)/i);
      const titular       = titularMatch ? titularMatch[1].trim() : (fancyCat ? fancyCat.tema.toUpperCase() : titulo);
      const subtitulo     = subMatch     ? subMatch[1].trim()     : '';
      const capTexto      = capMatch     ? capMatch[1].trim()     : '';
      const ctaTexto      = ctaMatch     ? ctaMatch[1].trim()     : 'El link está en los comentarios 👇';
      const hashArr       = [...new Set((hashMatch ? hashMatch[1].trim() : '#FancyByRoxette #Moda').split(/\s+/).filter(h => h.startsWith('#')))].slice(0,4).join(' ');
      const amazonLink    = fancyCat ? 'https://www.amazon.com/s?k=' + encodeURIComponent(fancyCat.searchTerm) + '&tag=' + AMAZON_TAG : '';
      captionTexto = capTexto + '\n\n' + ctaTexto + (amazonLink ? '\n🔗 ' + amazonLink + '\n*(enlace de afiliado)' : '') + '\n\n— Fancy by Roxette ✨\n\n' + hashArr;
      console.log('[Fancy] TITULAR:', titular, '| CAT:', fancyCat ? fancyCat.tema : 'genérico');
      coverBuffer = await generarCoverFancy(pageConfig.branding, titular, subtitulo);
    } else if (esTrabajando) {
      const coverMatch  = caption.match(/COVER:\s*(.+)/i);
      const capMatch    = caption.match(/CAPTION:\s*([\s\S]+?)(?=HASHTAGS:|$)/i);
      const hashMatch   = caption.match(/HASHTAGS:\s*(.+)/i);
      const coverTitulo = coverMatch ? coverMatch[1].trim() : titulo.substring(0, 25);
      const capTexto    = capMatch   ? capMatch[1].trim()   : '';
      const hashTexto   = hashMatch  ? hashMatch[1].trim()  : pageConfig.hashtags || '';
      captionTexto = capTexto + '\n\n' + hashTexto;
      console.log('[Trabajando] COVER:', coverTitulo);
      coverBuffer = await generarCoverTrabajando(pageConfig.branding, coverTitulo);
    } else {
      console.error('[MultiPage] Tipo no reconocido:', pageConfig.tipo, '— abortando');
      return;
    }
    if (!coverBuffer) {
      console.error('[MultiPage] No se generó imagen para:', pageConfig.nombre, '— abortando');
      return;
    }
    console.log('[MultiPage] Caption generado para:', pageConfig.nombre, '— publicando cover...');
    // Intercambiar por page token largo
    let pageToken = pageConfig.token;
    try {
      const tr = await fetch(`https://graph.facebook.com/v19.0/${pageConfig.id}?fields=access_token&access_token=${pageConfig.token}`);
      const td = await tr.json();
      if (td.access_token) pageToken = td.access_token;
    } catch(e) {}
    const FormData = require('form-data');
    const form = new FormData();
    form.append('caption', captionTexto + '\n\n' + pageConfig.hashtags);
    form.append('access_token', pageToken);
    form.append('source', coverBuffer, { filename: 'cover.jpg', contentType: 'image/jpeg' });
    await new Promise((resolve, reject) => {
      form.submit(`https://graph.facebook.com/v19.0/${pageConfig.id}/photos`, (err, res) => {
        if (err) return reject(err);
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (json.error) {
              console.error('[MultiPage] FB error en', pageConfig.nombre, ':', json.error.message);
              reject(new Error(json.error.message));
            } else {
              console.log('[MultiPage] Cover publicado en:', pageConfig.nombre, '| post id:', json.id, '|', titulo);
              resolve(json);
            }
          } catch(e) { reject(e); }
        });
      });
    });
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
  // GET /test-pexels — verifica Pexels API y muestra imagen generada (sin publicar)
  if (req.method === 'GET' && req.url.startsWith('/test-pexels')) {
    try {
      const params = new URL(req.url, 'http://localhost').searchParams;
      const cat    = (params.get('cat') || 'MODA').toUpperCase();
      const titulo = params.get('titulo') || 'ELEGANCIA LATINA';
      const imgUrl = await getImagenCategoria(cat);
      const buffer = await generarCoverPasarela(titulo, imgUrl);
      console.log('[test-pexels] imagen:', imgUrl.substring(0, 80));
      res.writeHead(200, { 'Content-Type': 'image/png', 'X-Pexels-Url': imgUrl.substring(0, 120) });
      res.end(buffer);
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // GET /test-cover — preview cover sin publicar en Facebook
  if (req.method === 'GET' && req.url === '/test-cover') {
   try {
     const buffer = await generarCoverPasarela('Elegancia latina. Poder. Transformación.');
     res.writeHead(200, { 'Content-Type': 'image/png' });
     res.end(buffer);
   } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
   }
   return;
 }

  // GET /test-blog-facebook — prueba el flujo completo: RSS imagen real + articulo + link
  if (req.method === 'GET' && req.url === '/test-blog-facebook') {
    try {
      if (cacheNoticias.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Cache RSS vacio, espera 30s y reintenta' }));
        return;
      }
      // Elegir noticia con imagen
      const conImagen = cacheNoticias.filter(n => n.imagen && n.imagen.startsWith('http'));
      const noticia = conImagen.length > 0 ? conImagen[0] : cacheNoticias[0];
      // Generar articulo editorial
      const promptTest = 'Escribe un articulo editorial original sobre: ' + noticia.titulo + '. Para PASARELA, revista de moda latina. Voz propia, 280-350 palabras.';
      const genPayload = JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 900,
        system: 'Eres la editora de PASARELA™, revista de moda latina de Dallas. Voz sofisticada, empoderada, latina. NUNCA cites fuentes. Primera persona editorial.',
        messages: [{ role: 'user', content: promptTest }]
      });
      const contenido = await new Promise((resolve, reject) => {
        const opts = { hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(genPayload) } };
        const r = https.request(opts, apiRes => { let d = ''; apiRes.on('data', c => { d += c; }); apiRes.on('end', () => { try { resolve(JSON.parse(d).content?.[0]?.text || ''); } catch(e) { reject(e); } }); });
        r.on('error', reject); r.write(genPayload); r.end();
      });
      if (!contenido) throw new Error('Claude sin respuesta');
      // Guardar en DB
      const slug = generarSlug(noticia.titulo);
      await pool.query('INSERT INTO noticias (titulo, contenido, tono, slug, publicado, imagen) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING', [noticia.titulo, contenido, 'editorial', slug, true, noticia.imagen || '']);
      // Publicar en Facebook con imagen real
      const urlBlog = 'https://pasarelastudiointer.com/noticias/' + slug;
      const primerParrafo = contenido.split('\n').filter(p => p.trim().length > 40)[0] || contenido.substring(0, 350);
      const captionFB = primerParrafo.trim() + '\n\nLeer más → ' + urlBlog + '\n\n#Pasarela #ModaLatina #DallasFashion';
      let fbId = null;
      const fechaTest = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
      const captionCompleto = contenido + '\n\nLeer más → ' + urlBlog + '\n\n#Pasarela #ModaLatina #DallasFashion';
      if (noticia.imagen) {
        try {
          const imgBuf = await fetchBuf(noticia.imagen);
          const coverBlog = await generarCoverBlogArticulo(imgBuf, noticia.titulo, fechaTest);
          const fbRes = await publicarFotoBuffer(coverBlog, captionCompleto);
          fbId = fbRes?.id || fbRes;
        } catch(efetch) {
          console.log('[test-blog-facebook] Imagen no accesible, usando cover canvas:', efetch.message);
          const _ct_1275 = noticia.titulo.split(' ').slice(0,5).join(' ');
          const coverBuffer = await generarCoverPasarela(_ct_1275, await getImagenCategoria('MODA', _ct_1275));
          fbId = await publicarFotoBuffer(coverBuffer, captionCompleto);
        }
      } else {
        const _ct_1275 = noticia.titulo.split(' ').slice(0,5).join(' ');
        const coverBuffer = await generarCoverPasarela(_ct_1275, await getImagenCategoria('MODA', _ct_1275));
        fbId = await publicarFotoBuffer(coverBuffer, captionCompleto);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, titulo: noticia.titulo, imagen: noticia.imagen || null, urlBlog, fb_id: fbId }));
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


  // TEST MULTI-PÁGINA — dispara publicarCoverParaPagina en todas las páginas extra

  // TEST gpt-image-1
  if (req.method === 'GET' && req.url === '/test-imagen-amor') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    (async () => {
      const testScene = 'Cute chibi couple sitting on a park bench sharing an ice cream cone on a sunny afternoon, the girl has long dark wavy hair with white flower accessories, the boy has short tousled dark hair, both smiling happily';
      const promptFinal = MASTER_PROMPT_AMOR.replace('{{SCENE}}', testScene);
      console.log('[test-imagen] OPENAI_API_KEY SET:', !!process.env.OPENAI_API_KEY);
      console.log('[test-imagen] Prompt length:', promptFinal.length);
      try {
        const body = JSON.stringify({ model: 'gpt-image-1', prompt: promptFinal, n: 1, size: '1024x1024', quality: 'medium' });
        const r = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY },
          body
        });
        const j = await r.json();
        console.log('[test-imagen] Status:', r.status);
        console.log('[test-imagen] Respuesta:', JSON.stringify(j).substring(0, 400));
        if (j.data && j.data[0] && j.data[0].b64_json) {
          console.log('[test-imagen] ✅ b64_json recibido, length:', j.data[0].b64_json.length);
        }
      } catch(e) {
        console.error('[test-imagen] ERROR:', e.message);
      }
    })();
    res.end(JSON.stringify({ mensaje: 'Generando imagen de prueba — ver logs Railway' }));
    return;
  }

  if (req.method === 'GET' && req.url === '/test-multipagina') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const resultados = [];
    const titulo = 'Estilo Editorial — PASARELA™ Revista';
    (async () => {
      for (const page of PAGES_EXTRA) {
        if (!page.token) { resultados.push({ pagina: page.nombre, status: 'sin token' }); continue; }
        try {
          await publicarCoverParaPagina(page, titulo);
          resultados.push({ pagina: page.nombre, status: 'OK' });
          await new Promise(r => setTimeout(r, 5000));
        } catch(e) {
          resultados.push({ pagina: page.nombre, status: 'ERROR', error: e.message });
        }
      }
      console.log('[test-multipagina] Resultados:', JSON.stringify(resultados));
    })();
    res.end(JSON.stringify({ mensaje: 'Publicando en páginas extra...', paginas: PAGES_EXTRA.map(p => p.nombre), nota: 'Ver logs Railway para resultados' }));
    return;
  }
  // TEST MULTI-PÁGINA
  if (req.method === 'GET' && req.url === '/test-multipagina') {
    // ... (ya existe)
  }

  // 👇 AGREGA AQUÍ el bloque setup-tokens
  if (req.method === 'GET' && req.url.startsWith('/setup-tokens')) {
    const urlObj = new URL(req.url, 'http://localhost');
    const shortToken = urlObj.searchParams.get('token');
    if (!shortToken) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Falta ?token=TU_TOKEN_CORTO' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    (async () => {
      try {
        const appId     = process.env.FB_APP_ID;
        const appSecret = process.env.FB_APP_SECRET;
        const exUrl = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`;
        const exRes  = await fetch(exUrl);
        const exData = await exRes.json();
        if (exData.error) throw new Error('Exchange: ' + exData.error.message);
        const longToken = exData.access_token;
        console.log('[setup-tokens] Token largo. Días:', Math.floor(exData.expires_in / 86400));
        const accRes  = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${longToken}&limit=20`);
        const accData = await accRes.json();
        if (accData.error) throw new Error('Accounts: ' + accData.error.message);
        const paginas = accData.data.map(p => ({ nombre: p.name, id: p.id, token: p.access_token }));
        console.log('[setup-tokens] Páginas:', paginas.map(p => p.nombre));
        res.end(JSON.stringify({ ok: true, instruccion: 'Copia cada token a Railway', paginas }));
      } catch(e) {
        console.error('[setup-tokens] Error:', e.message);
        res.end(JSON.stringify({ error: e.message }));
      }
    })();
    return;
  }


  res.writeHead(404);
  res.end();
});
// ── AUTO-PUBLICADOR PÁGINAS EXTRA — cada 6 horas ──────────────────────────
async function autoPublicarPaginasExtra() {
  const _titulo = 'Reflexión del día — ' + new Date().toLocaleDateString('es-MX', {weekday:'long', month:'long', day:'numeric'});
  console.log('[AutoPublish] Iniciando ciclo multi-página:', _titulo);
  for (const _pg of PAGES_EXTRA) {
    if (!_pg.token) { console.log('[AutoPublish] Sin token:', _pg.nombre); continue; }
    try {
      await publicarCoverParaPagina(_pg, _titulo);
      console.log('[AutoPublish] ✅', _pg.nombre);
      await new Promise(r => setTimeout(r, 8000));
    } catch(e) { console.error('[AutoPublish] Error en', _pg.nombre, ':', e.message); }
  }
  console.log('[AutoPublish] Ciclo completado');
}
setInterval(autoPublicarPaginasExtra, 6 * 60 * 60 * 1000);
console.log('[AutoPublish] Scheduler activado — publica cada 6 horas');

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[Servidor] Corriendo en puerto ${PORT}`);
});
