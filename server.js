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
    voice: 'Eres la voz editorial de Trabajando En Casa — comunidad de mujeres que construyen su vida con autonomía. Hablas como una mujer a otra mujer: cercana, inteligente, práctica, realista. Nunca lenguaje de gurú, nunca promesas exageradas. Tu mensaje central es: puedes crecer, empieza con lo que tienes. Español. Sin clichés. Sin motivación tóxica.',
    hashtags: '#TrabajarDesdeCasa #EmprendimientoLatino #MujeresEmprendedoras #NegocioDesdeHouse #EmprendedoraLatina #Productividad #MujeresQueInspiran #TrabajoRemoto #EmprendeLuego #MujerEmprendedora #IndependenciaEconomica #NegocioPropio #MujeresLatinas #DesdeHouse #Emprendimiento',
    temas: ['cómo empezar un negocio desde cero', 'miedo a dar el primer paso', 'organizar el tiempo trabajando desde casa', 'construir ingresos extra con tus habilidades', 'trabajar con enfoque sin distracciones', 'reinventarse a cualquier edad', 'pequeños pasos que construyen resultados', 'consistencia vs motivación', 'valorar tu trabajo y cobrar lo que mereces', 'el primer cliente es el más difícil', 'emprender siendo mamá', 'productividad sin agotamiento'],
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
    // Cormorant Garamond Bold — hero editorial
    const _fontPathCG = require('path').join(__dirname, 'CormorantGaramond-Bold.ttf');
    if (!require('fs').existsSync(_fontPathCG)) {
      console.log('[Fonts] Descargando CormorantGaramond-Bold...');
      const _bufCG = await new Promise(res => {
        require('https').get('https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/CormorantGaramond-Bold.ttf', r => {
          const c = []; r.on('data', d => c.push(d)); r.on('end', () => res(Buffer.concat(c)));
        }).on('error', () => res(null));
      });
      if (_bufCG && _bufCG.length > 10000) { require('fs').writeFileSync(_fontPathCG, _bufCG); console.log('[Fonts] CormorantGaramond-Bold descargado OK'); }
    }
    if (require('fs').existsSync(_fontPathCG)) {
      GlobalFonts.registerFromPath(_fontPathCG, 'Cormorant');
      _cormorantLoaded = true;
      console.log('[Fonts] Cormorant registrado para canvas');
    }
    // Playfair Display Bold — titular editorial Pasarela
    const _fontPathPF = require('path').join(__dirname, 'PlayfairDisplay-Bold.ttf');
    if (!require('fs').existsSync(_fontPathPF)) {
      console.log('[Fonts] Descargando PlayfairDisplay-Bold...');
      const _bufPF = await new Promise(res => {
        require('https').get('https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay-Bold.ttf', r => {
          const c = []; r.on('data', d => c.push(d)); r.on('end', () => res(Buffer.concat(c)));
        }).on('error', () => res(null));
      });
      if (_bufPF && _bufPF.length > 10000) { require('fs').writeFileSync(_fontPathPF, _bufPF); console.log('[Fonts] PlayfairDisplay-Bold descargado OK'); }
    }
    if (require('fs').existsSync(_fontPathPF)) {
      GlobalFonts.registerFromPath(_fontPathPF, 'Playfair');
      _playfairLoaded = true;
      console.log('[Fonts] Playfair registrado para canvas');
    }
    // Montserrat Bold — header/footer/badge Pasarela
    const _fontPathMT = require('path').join(__dirname, 'Montserrat-Bold.ttf');
    if (!require('fs').existsSync(_fontPathMT)) {
      console.log('[Fonts] Descargando Montserrat-Bold...');
      const _bufMT = await new Promise(res => {
        require('https').get('https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/static/Montserrat-Bold.ttf', r => {
          const c = []; r.on('data', d => c.push(d)); r.on('end', () => res(Buffer.concat(c)));
        }).on('error', () => res(null));
      });
      if (_bufMT && _bufMT.length > 10000) { require('fs').writeFileSync(_fontPathMT, _bufMT); console.log('[Fonts] Montserrat-Bold descargado OK'); }
    }
    if (require('fs').existsSync(_fontPathMT)) {
      GlobalFonts.registerFromPath(_fontPathMT, 'Montserrat');
      _montserratLoaded = true;
      console.log('[Fonts] Montserrat registrado para canvas');
    }
  } catch(e) { console.error('[Fonts] Error:', e.message); }
})();
let _cormorantLoaded = false;
let _playfairLoaded  = false;
let _montserratLoaded = false;

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

// ============================================================
// FANCY COMMERCE ENGINE — Constantes y estado en RAM
// NO compartir con otras páginas — exclusivo Fancy by Roxette
// ============================================================
const FANCY_CATEGORIAS = [
  { tema: 'vestidos y looks de ocasión',     searchBase: 'women occasion dress elegant',      queryPexels: 'elegant woman dress fashion',         emoji: '👗', tiposModoA: ['DISCOVER_FANCY','FASHION_PICK','GIFT_IDEA','ESSENTIAL'],       intenciones: ['elevar_un_look','autocuidado','regalo','descubrir_algo_util'] },
  { tema: 'tacones y zapatos de tendencia',  searchBase: 'women heels fashion shoes',          queryPexels: 'fashion heels shoes woman',            emoji: '👠', tiposModoA: ['DISCOVER_FANCY','FASHION_PICK','HOW_TO_STYLE'],                intenciones: ['elevar_un_look','comodidad','regalo','descubrir_algo_util'] },
  { tema: 'bolsos y carteras estructurados', searchBase: 'women structured handbag tote',      queryPexels: 'woman handbag fashion accessories',   emoji: '👜', tiposModoA: ['DISCOVER_FANCY','FASHION_PICK','ESSENTIAL','GIFT_IDEA'],       intenciones: ['organizar','elevar_un_look','regalo','comodidad'] },
  { tema: 'joyería fina y accesorios',       searchBase: 'women fine jewelry set elegant',     queryPexels: 'woman jewelry accessories elegant',   emoji: '✨', tiposModoA: ['DISCOVER_FANCY','GIFT_IDEA','FASHION_PICK'],                   intenciones: ['elevar_un_look','regalo','autocuidado','descubrir_algo_util'] },
  { tema: 'maquillaje y sets de belleza',    searchBase: 'makeup set women beauty kit',        queryPexels: 'makeup beauty cosmetics woman',       emoji: '💄', tiposModoA: ['BEAUTY_FIND','DISCOVER_FANCY','GIFT_IDEA','HOW_TO_STYLE'],    intenciones: ['autocuidado','simplificar_rutina','elevar_un_look','regalo'] },
  { tema: 'ropa casual chic diaria',         searchBase: 'women casual chic everyday outfit',  queryPexels: 'casual chic woman street fashion',    emoji: '🛍️', tiposModoA: ['FASHION_PICK','HOW_TO_STYLE','ESSENTIAL'],                     intenciones: ['comodidad','elevar_un_look','descubrir_algo_util'] },
  { tema: 'skincare y rutina de piel',       searchBase: 'skincare routine set women glow',    queryPexels: 'skincare beauty routine woman',       emoji: '🧴', tiposModoA: ['BEAUTY_FIND','DISCOVER_FANCY','HOW_TO_STYLE'],                intenciones: ['autocuidado','simplificar_rutina','resolver_un_problema'] },
  { tema: 'organización del hogar',          searchBase: 'home organization storage elegant',  queryPexels: 'home organization aesthetic storage', emoji: '🏠', tiposModoA: ['HOME_FIND','DISCOVER_FANCY','ESSENTIAL'],                      intenciones: ['organizar','resolver_un_problema','ahorrar_tiempo','simplificar_rutina'] },
  { tema: 'bolsos de trabajo y oficina',     searchBase: 'women work tote bag office laptop',  queryPexels: 'professional woman work bag office',  emoji: '💼', tiposModoA: ['ESSENTIAL','DISCOVER_FANCY','FASHION_PICK'],                   intenciones: ['organizar','comodidad','elevar_un_look','resolver_un_problema'] },
  { tema: 'regalo para ella',                searchBase: 'gift for women fashion accessories', queryPexels: 'gift box woman elegant fashion',      emoji: '🎁', tiposModoA: ['GIFT_IDEA','DISCOVER_FANCY','BEAUTY_FIND'],                    intenciones: ['regalo','descubrir_algo_util','autocuidado'] },
];

// Tipos editoriales Modo A — Modo B (FIND_OF_THE_DAY, LOOK_FOR_LESS, TRENDING) se activa cuando Amazon Creators API sea elegible
const FANCY_TIPOS_MODO_A = ['DISCOVER_FANCY','FASHION_PICK','BEAUTY_FIND','HOME_FIND','HOW_TO_STYLE','GIFT_IDEA','ESSENTIAL'];

// Modificadores de intención → sufijo de búsqueda Amazon
const INTENCION_MODIFIER = {
  organizar:             'organizer storage',
  simplificar_rutina:    'kit set easy',
  resolver_un_problema:  'solution for women',
  elevar_un_look:        'elegant chic',
  autocuidado:           'self care women',
  regalo:                'gift set',
  comodidad:             'comfortable everyday',
  descubrir_algo_util:   'useful women',
  ahorrar_tiempo:        'quick easy',
};

// Estado anti-repetición en RAM — se reinicia en cada redeploy de Railway
const FANCY_STATE = {
  lastTipos:         [],  // últimos 3 tipoEditorial usados
  lastCategorias:    [],  // últimas 3 categorías usadas
  lastPexelsQueries: [],  // últimas 5 queries Pexels
};

// ── Helpers Fancy ────────────────────────────────────────────────────────────

function fancyMemPush(arr, val, max) {
  arr.push(val);
  if (arr.length > (max || 3)) arr.shift();
}

function elegirTipoEditorialFancy() {
  const disponibles = FANCY_TIPOS_MODO_A.filter(t => !FANCY_STATE.lastTipos.includes(t));
  const pool = disponibles.length > 0 ? disponibles : FANCY_TIPOS_MODO_A;
  const tipo = pool[Math.floor(Math.random() * pool.length)];
  fancyMemPush(FANCY_STATE.lastTipos, tipo, 3);
  return tipo;
}

function elegirCategoriaFancy(tipoEditorial) {
  const compatibles = FANCY_CATEGORIAS.filter(c =>
    c.tiposModoA.includes(tipoEditorial) && !FANCY_STATE.lastCategorias.includes(c.tema)
  );
  const pool = compatibles.length > 0 ? compatibles
    : FANCY_CATEGORIAS.filter(c => !FANCY_STATE.lastCategorias.includes(c.tema));
  const pool2 = pool.length > 0 ? pool : FANCY_CATEGORIAS;
  const cat = pool2[Math.floor(Math.random() * pool2.length)];
  fancyMemPush(FANCY_STATE.lastCategorias, cat.tema, 3);
  return cat;
}

function elegirIntencionCompraFancy(tipoEditorial, categoria) {
  const MAP = {
    DISCOVER_FANCY: 'descubrir_algo_util',
    FASHION_PICK:   'elevar_un_look',
    BEAUTY_FIND:    'autocuidado',
    HOME_FIND:      'organizar',
    HOW_TO_STYLE:   'elevar_un_look',
    GIFT_IDEA:      'regalo',
    ESSENTIAL:      'comodidad',
  };
  const preferred = MAP[tipoEditorial];
  if (preferred && categoria.intenciones.includes(preferred)) return preferred;
  return categoria.intenciones[Math.floor(Math.random() * categoria.intenciones.length)];
}

function construirSearchTermFancy(categoria, intencionCompra) {
  const mod = INTENCION_MODIFIER[intencionCompra] || '';
  const result = (categoria.searchBase + (mod ? ' ' + mod : '')).trim();
  console.log('[Fancy] searchTerm:', result);
  return result;
}

function obtenerEnlaceFancy(categoria, intencionCompra) {
  const AMAZON_TAG = process.env.AMAZON_TAG || 'fancybyroxette-20';
  const searchTerm = construirSearchTermFancy(categoria, intencionCompra);
  const link = 'https://www.amazon.com/s?k=' + encodeURIComponent(searchTerm) + '&tag=' + AMAZON_TAG;
  console.log('[Fancy] amazonLink:', link);
  return link;
}

async function getImagenFancy(categoria, tipoEditorial, intencionCompra) {
  const TIPO_PEXELS_MOD = {
    DISCOVER_FANCY: 'editorial fashion',
    FASHION_PICK:   'fashion look outfit',
    BEAUTY_FIND:    'beauty makeup',
    HOME_FIND:      'home decor aesthetic',
    HOW_TO_STYLE:   'style fashion woman',
    GIFT_IDEA:      'gift elegant woman',
    ESSENTIAL:      'everyday fashion woman',
  };
  const tipoMod  = TIPO_PEXELS_MOD[tipoEditorial] || 'fashion editorial';
  let query      = categoria.queryPexels + ' ' + tipoMod;
  if (FANCY_STATE.lastPexelsQueries.includes(query)) {
    const variants = ['luxury','elegant','chic','trendy','glamour'];
    query = categoria.queryPexels + ' ' + variants[Math.floor(Math.random() * variants.length)];
  }
  fancyMemPush(FANCY_STATE.lastPexelsQueries, query, 5);
  console.log('[Fancy] queryPexels:', query);
  const url = await getImagenCategoria('DEFAULT', query);
  if (!url) return null;
  return await descargarImagen(url);
}

async function generarCopyFancy(tipoEditorial, categoria, intencionCompra) {
  const TIPO_VOZ = {
    DISCOVER_FANCY: 'Eres editora de descubrimiento. Presenta este hallazgo como algo especial que pocas conocen. Primera persona plural ("descubrimos", "encontramos"). Voz entusiasta pero sofisticada.',
    FASHION_PICK:   'Eres editora de moda. Presenta el look que define esta temporada. Segunda persona ("tu look perfecto", "te imaginas"). Voz autoritativa y aspiracional.',
    BEAUTY_FIND:    'Eres editora de belleza. Habla de este ritual como inversión en una misma. Primera persona ("nos encanta", "lo que toda mujer merece"). Voz cómplice y empática.',
    HOME_FIND:      'Eres editora de estilo de vida. Presenta este producto como la solución que transforma el espacio. Segunda persona ("imagina tu espacio", "el cambio que necesitas"). Voz práctica y aspiracional.',
    HOW_TO_STYLE:   'Eres editora de how-to. Guía el look o uso del producto paso a paso. Segunda persona directa ("primero", "luego", "resultado"). Voz didáctica e inspiradora.',
    GIFT_IDEA:      'Eres editora de regalos. Presenta esta idea como el detalle que demuestra que la conoces. Segunda persona ("para la mujer especial en tu vida", "un regalo que habla por ti"). Voz cálida e íntima.',
    ESSENTIAL:      'Eres editora de básicos. Presenta este artículo como el indispensable que falta en su closet/vida. Segunda persona ("necesitas", "no puede faltar"). Voz directa y convincente.',
  };
  const voz = TIPO_VOZ[tipoEditorial] || TIPO_VOZ['DISCOVER_FANCY'];
  const prompt = voz + '\nCategoría: ' + categoria.tema + ' ' + categoria.emoji
    + '\nIntención de compra: ' + intencionCompra.replace(/_/g, ' ')
    + '\n\nCONTEXTO: Estás curating CATEGORÍAS de productos en Amazon (Modo A), no un producto específico. El enlace se publica directamente en el post, no en comentarios.'
    + '\n\nPROHIBIDO en CAPTION y CTA:\n- Afirmar o insinuar que otras personas eligieron/compraron/recomendaron el producto\n- Mencionar número de compradores, bestseller, tendencia de ventas, opiniones, reviews, rating, popularidad, stock, precio o descuentos\n- Frases como "link en los comentarios", "enlace en comentarios", "te dejo el link abajo", "lo encuentras en mi perfil"\n\nCTA: invita a descubrir/explorar/hacer clic. Ejemplos de tono: "🛍️ Descubre las opciones aquí 👇", "✨ Mira lo que encontramos 👇", "🎁 Encuentra ideas para regalar aquí 👇", "🛒 Ver opciones disponibles 👇". El emoji va al inicio, máx 10 palabras.'
    + '\n\nGenera exactamente este formato (sin comillas, sin asteriscos):\nTITULAR: [frase de portada de revista, máx 6 palabras, español, MAYÚSCULAS, impactante]\nSUBTITULO: [frase editorial corta máx 8 palabras, español, minúsculas]\nCAPTION: [2-3 líneas editoriales en español — describe por qué esta CATEGORÍA es relevante ahora — sin prueba social inventada, sin datos no verificados]\nCTA: [invitación a explorar — emoji al inicio — máx 10 palabras — NUNCA mencionar comentarios]\nHASHTAGS: #FancyByRoxette — añade exactamente 3 hashtags relevantes a: ' + categoria.tema;
  const payload = JSON.stringify({
    model: 'claude-sonnet-4-6', max_tokens: 300,
    system: 'Eres la editora de Fancy by Roxette, boutique de moda y accesorios en Dallas. Voz chic, aspiracional. Solo español. NUNCA menciones nombres de marcas externas. NUNCA repitas hashtags. NUNCA inventes datos, estadísticas, ventas, o prueba social que no te hayan dado.',
    messages: [{ role: 'user', content: prompt }]
  });
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(payload) } };
    const r = https.request(opts, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d).content?.[0]?.text || ''); } catch(e) { reject(e); } }); });
    r.on('error', reject); r.write(payload); r.end();
  });
}

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
// ── VISUAL ENGINE — Maravillas del Reino (13 categorías semánticas) ─────────
const VISUAL_ENGINE_FE = [
  // ── NATURALEZA 45% (9 categorías) ──────────────────────────────────────────
  { cat: 'SUNRISE',      queries: ['golden sunrise sky morning light', 'beautiful sunrise landscape', 'sunrise over mountains peaceful', 'warm golden sunrise horizon'] },
  { cat: 'MOUNTAINS',    queries: ['majestic mountains sunlight', 'mountain peak sunrise golden', 'scenic mountain landscape morning', 'mountains clouds sunlight peaceful'] },
  { cat: 'FLOWERS',      queries: ['beautiful flowers sunlight garden', 'wildflowers morning light colorful', 'sunflower field golden light', 'spring flowers bloom sunlight'] },
  { cat: 'FIELDS',       queries: ['golden wheat field sunlight', 'green field horizon morning', 'meadow wildflowers sunlight peaceful', 'open field sunrise warm light'] },
  { cat: 'OCEAN',        queries: ['calm ocean sunrise peaceful', 'beach sunrise warm golden light', 'ocean waves sunlight blue sky', 'tropical beach morning light'] },
  { cat: 'FOREST',       queries: ['sunlight through forest trees', 'forest path morning light', 'green forest sunlight peaceful', 'trees sunlight nature calm'] },
  { cat: 'PATHS',        queries: ['road sunrise morning light', 'peaceful path nature morning', 'trail through nature sunrise', 'walkway garden sunlight'] },
  { cat: 'GOLDEN_HOUR',  queries: ['golden hour sunset landscape', 'warm golden light nature', 'sunset golden glow peaceful', 'golden light sky clouds'] },
  { cat: 'SKY',          queries: ['beautiful blue sky clouds sunlight', 'dramatic clouds golden sunlight', 'sky sunrise colors horizon', 'peaceful sky morning light'] },
  // ── PERSONAS 30% (6 categorías) ─────────────────────────────────────────────
  { cat: 'JOY',          queries: ['joyful woman outdoors sunlight', 'happy woman laughing nature', 'woman smiling sunlight peaceful', 'cheerful woman arms open sky'] },
  { cat: 'FREEDOM',      queries: ['woman arms open field sunrise', 'free woman nature light', 'woman standing hilltop sunrise', 'woman open arms morning sky'] },
  { cat: 'STRENGTH',     queries: ['confident woman sunrise outdoors', 'strong woman nature morning light', 'determined woman hilltop sunrise', 'woman standing strong sunlight'] },
  { cat: 'PEACE_PERSON', queries: ['peaceful woman nature sunlight', 'woman eyes closed sunlight', 'serene woman garden morning', 'calm woman nature light'] },
  { cat: 'WORSHIP',      queries: ['woman worship arms raised sunrise', 'person worship outdoor sunlight', 'woman hands raised sky morning', 'worship sunset arms open'] },
  { cat: 'WALK',         queries: ['woman walking nature morning light', 'person walking path sunrise', 'woman walking beach sunrise', 'woman walk through flowers morning'] },
  // ── FAMILIA 15% (3 categorías) ──────────────────────────────────────────────
  { cat: 'FAMILY_JOY',   queries: ['happy family outdoors sunlight', 'family laughing park sunny day', 'family together bright sunny', 'joyful family outdoor light'] },
  { cat: 'MOTHER_CHILD', queries: ['mother hugging child sunlight', 'mother daughter outdoors bright', 'mom child garden sunlight', 'mother holding child morning'] },
  { cat: 'FAMILY_LOVE',  queries: ['family holding hands sunlight', 'couple family outdoors bright morning', 'family embrace sunset golden', 'family love outdoor light'] },
  // ── BIBLIA 10% (2 categorías) ───────────────────────────────────────────────
  { cat: 'BIBLE_LIGHT',  queries: ['open Bible sunlight bright', 'Bible window morning light', 'Bible study warm light', 'holy Bible golden light coffee'] },
  { cat: 'PRAYER_BRIGHT', queries: ['hands praying bright sunlight', 'woman praying window morning light', 'person praying outdoor sunlight', 'prayer hands warm golden light'] },
];

// Fallback aleatorio biased hacia naturaleza (9/20 chance nature)
function getQueryFe() {
  const cat = VISUAL_ENGINE_FE[Math.floor(Math.random() * VISUAL_ENGINE_FE.length)];
  return cat.queries[Math.floor(Math.random() * cat.queries.length)];
}

// Mapeo emocional (emoción > literalidad): texto del mensaje → categoría visual
function getQueryFeByContent(afirmacion, hero) {
  const txt = ((afirmacion || '') + ' ' + (hero || '')).toLowerCase();
  const map = [
    // Emociones positivas → naturaleza luminosa primero
    { keys: ['alegría','gozo','feliz','felicidad','gozoso','gozosa'],                  cat: 'JOY'          },
    { keys: ['libre','libertad','libre en cristo','liberado','liberada'],               cat: 'FREEDOM'      },
    { keys: ['vencedor','victoria','venzo','triunfo','triunfar'],                      cat: 'STRENGTH'     },
    { keys: ['nueva criatura','nueva','renovado','renovada','transformado'],           cat: 'SUNRISE'      },
    { keys: ['nueva mañana','amanecer','nueva oportunidad'],                           cat: 'SUNRISE'      },
    { keys: ['esperanza','espero','confío','confio','confianza'],                      cat: 'GOLDEN_HOUR'  },
    { keys: ['paz','tranquilo','tranquila','descanso','quietud','calma'],              cat: 'PEACE_PERSON' },
    { keys: ['fortaleza','fuerte','fuerza','valiente','valentía'],                     cat: 'STRENGTH'     },
    { keys: ['propósito','proposito','llamado','misión','mision','destino'],           cat: 'PATHS'        },
    { keys: ['gratitud','agradecido','agradecida','gracias','doy gracias'],            cat: 'FIELDS'       },
    { keys: ['consuelo','consuela','consolado','refugio','amparo'],                    cat: 'OCEAN'        },
    { keys: ['restaura','restaurado','restaurada','sana','sanado','sanada'],           cat: 'FLOWERS'      },
    { keys: ['bendecido','bendecida','bendición','bendicion'],                         cat: 'GOLDEN_HOUR'  },
    { keys: ['familia','hijo','hija','madre','padre','hogar'],                         cat: 'FAMILY_JOY'   },
    { keys: ['madre','mamá','mama','hijos','niños'],                                   cat: 'MOTHER_CHILD' },
    { keys: ['adoración','adorar','alabanza','alabar','glorificar'],                   cat: 'WORSHIP'      },
    { keys: ['oración','orar','ora','orando','ruego','ruega'],                         cat: 'PRAYER_BRIGHT'},
    { keys: ['palabra','biblia','escritura','versículo','versiculo'],                  cat: 'BIBLE_LIGHT'  },
    { keys: ['heredero','hijo de dios','hija de dios','pertenezco'],                  cat: 'SKY'          },
    { keys: ['dios conmigo','no estoy solo','no estoy sola','dios está'],             cat: 'MOUNTAINS'    },
    { keys: ['fe','creo','creer','creyente'],                                          cat: 'SUNRISE'      },
    { keys: ['camino','jornada','paso a paso','avanzar','seguir'],                    cat: 'PATHS'        },
    { keys: ['creación','maravilla','asombro','obra de dios'],                         cat: 'SKY'          },
    { keys: ['bosque','naturaleza','jardín','jardin'],                                  cat: 'FOREST'       },
  ];
  for (const rule of map) {
    if (rule.keys.some(k => txt.includes(k))) {
      const found = VISUAL_ENGINE_FE.find(c => c.cat === rule.cat);
      if (found) return found.queries[Math.floor(Math.random() * found.queries.length)];
    }
  }
  // Fallback biased: 60% naturaleza
  const roll = Math.random();
  let pool;
  if (roll < 0.60) {
    pool = VISUAL_ENGINE_FE.filter(c => ['SUNRISE','MOUNTAINS','FLOWERS','FIELDS','OCEAN','FOREST','PATHS','GOLDEN_HOUR','SKY'].includes(c.cat));
  } else if (roll < 0.90) {
    pool = VISUAL_ENGINE_FE.filter(c => ['JOY','FREEDOM','STRENGTH','PEACE_PERSON','WORSHIP','WALK'].includes(c.cat));
  } else {
    pool = VISUAL_ENGINE_FE.filter(c => ['FAMILY_JOY','MOTHER_CHILD','FAMILY_LOVE'].includes(c.cat));
  }
  const cat = pool[Math.floor(Math.random() * pool.length)];
  return cat.queries[Math.floor(Math.random() * cat.queries.length)];
}

// ── IMAGEN EXCLUSIVA FE — anti-repetición + filtro de luminosidad ─────────────
let _feRecentIds = []; // últimos ~20 IDs usados
async function getImagenFe(query) {
  try {
    const pexUrl = 'https://api.pexels.com/v1/search?query=' + encodeURIComponent(query) + '&per_page=20&orientation=square';
    const data = await new Promise((resolve, reject) => {
      const opts = new URL(pexUrl);
      const r = https.request({ hostname: opts.hostname, path: opts.pathname + opts.search, headers: { Authorization: PEXELS_API_KEY } }, res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
      });
      r.on('error', reject); r.end();
    });
    const todas = (data.photos || []).filter(p => !_feRecentIds.includes(p.id));
    const pool  = todas.length > 0 ? todas : (data.photos || []);
    if (!pool.length) return null;

    // Filtro de luminosidad: preferir fotos con brightness > 80
    function hexBrightness(hex) {
      if (!hex || hex.length < 6) return 128;
      const h = hex.replace('#','');
      const r = parseInt(h.slice(0,2),16);
      const g = parseInt(h.slice(2,4),16);
      const b = parseInt(h.slice(4,6),16);
      return (r*299 + g*587 + b*114) / 1000;
    }
    const BRIGHT_MIN = 80;
    const luminosas = pool.filter(p => hexBrightness(p.avg_color) > BRIGHT_MIN);
    const candidatos = luminosas.length >= 3 ? luminosas : pool; // fallback si pocas luminosas

    // Tomar top 5 candidatos para variedad
    const top5 = candidatos.slice(0, 5);
    const pick  = top5[Math.floor(Math.random() * top5.length)];

    // Registrar ID usado
    _feRecentIds.push(pick.id);
    if (_feRecentIds.length > 20) _feRecentIds.shift();
    return pick.src.large2x || pick.src.large || pick.src.original;
  } catch(e) { console.error('[Pexels-Fe] Error:', e.message); return null; }
}
// ── TRABAJANDO EN CASA — pilares editoriales ────────────────────────────────
const PILARES_TRABAJANDO = ['EMPRENDIMIENTO', 'INDEPENDENCIA', 'PRODUCTIVIDAD', 'MENTALIDAD', 'ACCION'];
let _trabPilaresRecientes = [];
let _trabRecentIds = [];

function elegirPilarTrabajando() {
  const disponibles = PILARES_TRABAJANDO.filter(p => !_trabPilaresRecientes.includes(p));
  const pool = disponibles.length > 0 ? disponibles : PILARES_TRABAJANDO;
  const pilar = pool[Math.floor(Math.random() * pool.length)];
  _trabPilaresRecientes.push(pilar);
  if (_trabPilaresRecientes.length > 3) _trabPilaresRecientes.shift();
  return pilar;
}

// ── VISUAL ENGINE — distribución: 55% emprendiendo / 20% home office / 15% small biz / 10% lifestyle
const VISUAL_ENGINE_TRABAJANDO = [
  // ── EMPRENDIENDO / ENTREPRENEUR 55% (4 categorías) ──────────────────────
  { cat: 'ENTREPRENEUR',     queries: [
    'woman entrepreneur home bright', 'female entrepreneur laptop sunlight',
    'woman starting business smiling', 'female business owner desk daylight',
    'woman working laptop natural light', 'latina entrepreneur bright office',
    'female entrepreneur confident working', 'woman business idea notebook'
  ]},
  { cat: 'EMPOWERMENT',      queries: [
    'confident woman smiling work', 'successful woman entrepreneur outdoor',
    'woman arms open field', 'happy woman working laptop',
    'woman celebrating achievement', 'confident female professional natural light',
    'woman winner success smile', 'empowered woman working home'
  ]},
  { cat: 'DIGITAL_BUSINESS', queries: [
    'woman smartphone business home', 'female content creator bright room',
    'woman social media laptop window', 'woman online business natural light',
    'female creator working daylight', 'woman video call bright office',
    'woman working phone laptop home', 'female digital entrepreneur'
  ]},
  { cat: 'SMALL_BUSINESS',   queries: [
    'woman small business owner', 'female entrepreneur products table',
    'woman handmade business bright', 'woman packaging orders daylight',
    'female ecommerce seller home', 'woman craft business natural light',
    'woman online seller working', 'female shop owner bright'
  ]},
  // ── HOME OFFICE / PRODUCTIVIDAD 20% (2 categorías) ──────────────────────
  { cat: 'HOME_OFFICE',      queries: [
    'woman working laptop home bright', 'cozy female home office daylight',
    'woman desk laptop coffee morning', 'bright home office woman working',
    'woman home office natural light', 'female remote work bright room',
    'woman organized desk daylight', 'clean home office woman laptop'
  ]},
  { cat: 'PRODUCTIVITY',     queries: [
    'woman writing planner daylight', 'woman planning notebook bright',
    'organized desk woman morning', 'woman taking notes laptop window',
    'woman focused working natural light', 'woman calendar planning bright',
    'woman checklist notebook daylight', 'woman priorities planning home'
  ]},
  // ── LIFESTYLE / LOGROS 10% (2 categorías) ───────────────────────────────
  { cat: 'LIFESTYLE',        queries: [
    'woman coffee laptop morning home', 'woman flexible work bright',
    'woman enjoying home office', 'woman morning routine laptop',
    'woman working cozy bright home', 'woman work life balance',
    'woman laptop morning window', 'woman peaceful working home'
  ]},
  { cat: 'SUCCESS',          queries: [
    'woman celebrating success laptop', 'happy female entrepreneur achievement',
    'woman excited laptop success', 'confident woman work achievement',
    'woman happy working from home', 'female entrepreneur proud moment',
    'woman victory arms raised', 'happy business woman success bright'
  ]},
];

function getQueryTrabajando() {
  // Fallback biased: 55% entrepreneur, 20% home/productivity, 10% lifestyle
  const roll = Math.random();
  let pool;
  if (roll < 0.55) pool = VISUAL_ENGINE_TRABAJANDO.filter(c => ['ENTREPRENEUR','EMPOWERMENT','DIGITAL_BUSINESS','SMALL_BUSINESS'].includes(c.cat));
  else if (roll < 0.75) pool = VISUAL_ENGINE_TRABAJANDO.filter(c => ['HOME_OFFICE','PRODUCTIVITY'].includes(c.cat));
  else pool = VISUAL_ENGINE_TRABAJANDO.filter(c => ['LIFESTYLE','SUCCESS'].includes(c.cat));
  const cat = pool[Math.floor(Math.random() * pool.length)];
  return cat.queries[Math.floor(Math.random() * cat.queries.length)];
}

// Mapeo por PILAR + palabras clave del gancho → categoría visual
function getQueryTrabajandoByContent(pilar, gancho) {
  const txt = ((pilar || '') + ' ' + (gancho || '')).toLowerCase();
  const map = [
    { keys: ['digital','redes','online','internet','celular','teléfono','apps','contenido'],  cat: 'DIGITAL_BUSINESS' },
    { keys: ['producto','empacar','vender','cliente','paquete','tienda','artesanal','manualidad'], cat: 'SMALL_BUSINESS' },
    { keys: ['logro','éxito','celebra','consegui','alcanz','triunf','ganar','primera venta'],  cat: 'SUCCESS'         },
    { keys: ['café','mañana','balance','bienestar','calma','rutina mañana','lifestyle'],       cat: 'LIFESTYLE'       },
    { keys: ['tiempo','organiza','plan','agenda','productiv','prioridad','hábito','enfoque'],  cat: 'PRODUCTIVITY'    },
    { keys: ['hogar','casa','oficina','escritorio','desde casa','espacio','remoto'],           cat: 'HOME_OFFICE'     },
    { keys: ['confianza','miedo','dudas','impostor','creencia','creer en','síndrome'],        cat: 'EMPOWERMENT'     },
    { keys: ['empezar','inicio','primer paso','primera vez','comienzo','arrancar','debut'],   cat: 'ENTREPRENEUR'    },
    { keys: ['talento','habilidad','aprender','curso','estudia','conocimiento'],               cat: 'ENTREPRENEUR'    },
    { keys: ['ingreso','dinero','cobrar','precio','valor','independencia','económica'],        cat: 'SMALL_BUSINESS'  },
    { keys: ['mamá','familia','hijo','hija','madre','concilia','mientras duermen'],           cat: 'HOME_OFFICE'     },
    { keys: ['productividad', 'accion', 'acción', 'disciplina', 'hábito', 'constancia'],     cat: 'PRODUCTIVITY'    },
  ];
  for (const rule of map) {
    if (rule.keys.some(k => txt.includes(k))) {
      const found = VISUAL_ENGINE_TRABAJANDO.find(c => c.cat === rule.cat);
      if (found) return found.queries[Math.floor(Math.random() * found.queries.length)];
    }
  }
  return getQueryTrabajando(); // fallback biased
}

// ── IMAGEN EXCLUSIVA TRABAJANDO — Pexels directo, anti-repetición, luminosidad preferida
async function getImagenTrabajando(query) {
  try {
    // Sin orientation=square para mayor pool de calidad — cover crop adapta al 1080x1080
    const pexUrl = 'https://api.pexels.com/v1/search?query=' + encodeURIComponent(query) + '&per_page=20';
    const data = await new Promise((resolve, reject) => {
      const opts = new URL(pexUrl);
      const r = https.request({ hostname: opts.hostname, path: opts.pathname + opts.search, headers: { Authorization: PEXELS_API_KEY } }, res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
      });
      r.on('error', reject); r.end();
    });
    const todas = (data.photos || []).filter(p => !_trabRecentIds.includes(p.id));
    const pool  = todas.length > 0 ? todas : (data.photos || []);
    if (!pool.length) return null;

    // Preferir fotos luminosas — criterio de calidad, no rígido
    function hexBright(hex) {
      if (!hex || hex.length < 6) return 128;
      const h = hex.replace('#','');
      const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
      return (r*299 + g*587 + b*114) / 1000;
    }
    const BRIGHT_MIN = 75;
    const luminosas = pool.filter(p => hexBright(p.avg_color) > BRIGHT_MIN);
    // Si hay al menos 3 luminosas, preferirlas; si no, usar todo el pool
    const candidatos = luminosas.length >= 3 ? luminosas : pool;
    const top5 = candidatos.slice(0, 5);
    const pick = top5[Math.floor(Math.random() * top5.length)];

    _trabRecentIds.push(pick.id);
    if (_trabRecentIds.length > 20) _trabRecentIds.shift();
    return pick.src.large2x || pick.src.large || pick.src.original;
  } catch(e) { console.error('[Pexels-Trab] Error:', e.message); return null; }
}


async function generarCoverFe(branding, afirmacion, hero, versiculo, referencia) {
  const canvas = createCanvas(1080, 1080);
  const ctx    = canvas.getContext('2d');
  const AZUL   = '#123B7A';
  const DORADO = branding.colorAccento || '#C9A66B';

  // BASE azul
  ctx.fillStyle = AZUL;
  ctx.fillRect(0, 0, 1080, 1080);

  // FOTO — full canvas 1080×1080, object-fit cover, SIN clip, SIN reducción
  const imgUrl = await getImagenFe(getQueryFeByContent(afirmacion, hero));
  if (imgUrl) {
    try {
      const buf = await descargarImagen(imgUrl);
      if (buf) {
        const img = await loadImage(buf);
        ctx.globalAlpha = 1;
        drawImageCover(ctx, img, 1080, 1080);
        ctx.globalAlpha = 1;
      }
    } catch(e) { console.error('[CoverFe] imagen:', e.message); }
  }

  // GRADIENTE INFERIOR — localizado solo en zona texto inferior, tono azul-fe
  const gBot = ctx.createLinearGradient(0, 500, 0, 985);
  gBot.addColorStop(0,    'rgba(8,35,82,0.0)');
  gBot.addColorStop(0.35, 'rgba(8,35,82,0.10)');
  gBot.addColorStop(0.70, 'rgba(8,35,82,0.42)');
  gBot.addColorStop(1,    'rgba(8,35,82,0.60)');
  ctx.fillStyle = gBot;
  ctx.fillRect(0, 500, 1080, 485);

  // ── HEADER — encima de la foto, y=0..80 ─────────────────────────────────
  ctx.fillStyle = AZUL;
  ctx.fillRect(0, 0, 1080, 88);
  ctx.fillStyle = DORADO;
  ctx.fillRect(0, 86, 1080, 2);                     // línea dorada inferior

  ctx.textAlign = 'center';
  ctx.shadowBlur = 0;
  const hdrFont = _cormorantLoaded ? 'bold 54px Cormorant' : 'bold 46px Roboto';
  ctx.fillStyle = DORADO;
  ctx.font = hdrFont;
  ctx.fillText('MARAVILLAS DEL REINO', 540, 58);

  // ── AFIRMACIÓN — y ≈ 165–215 ─────────────────────────────────────────────
  // Ajuste vertical: texto corto empieza más abajo para dejar más foto visible
  const totalWords = (afirmacion + ' ' + hero).split(' ').length;
  const startY = totalWords <= 6 ? 230 : totalWords <= 10 ? 200 : 175;
  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur  = 14;
  ctx.fillStyle   = '#FFFFFF';
  ctx.font        = 'bold 33px Roboto';
  const aw = afirmacion.toUpperCase().split(' ');
  let al = ''; let ay = startY;
  for (const w of aw) {
    const t = al ? al+' '+w : w;
    if (ctx.measureText(t).width > 940) { ctx.fillText(al, 540, ay); al = w; ay += 40; }
    else al = t;
  }
  if (al) { ctx.fillText(al, 540, ay); ay += 40; }

  // ── HERO — elemento dominante, 65–90 px ──────────────────────────────────
  const heroFace = _cormorantLoaded ? 'Cormorant' : 'Roboto';
  let   heroSz   = _cormorantLoaded ? 88 : 74;
  ctx.fillStyle  = DORADO;
  ctx.font       = `bold ${heroSz}px ${heroFace}`;
  // Reducir si el hero de 1 palabra excede el canvas
  if (ctx.measureText(hero.toUpperCase()).width > 1020) {
    heroSz = Math.max(60, heroSz - 12);
    ctx.font = `bold ${heroSz}px ${heroFace}`;
  }
  const heroLineH = heroSz + 12;
  const hw = hero.toUpperCase().split(' ');
  let hl = ''; let hy = ay + 28;
  for (const w of hw) {
    const t = hl ? hl+' '+w : w;
    if (ctx.measureText(t).width > 990) { ctx.fillText(hl, 540, hy); hl = w; hy += heroLineH; }
    else hl = t;
  }
  if (hl) { ctx.fillText(hl, 540, hy); hy += heroLineH; }

  // ── SEPARADOR — y ≈ 450–490 ──────────────────────────────────────────────
  ctx.shadowBlur = 0;
  const sepY = Math.max(Math.min(hy + 22, 490), 410);
  const lineW = 1080 * 0.68;
  ctx.strokeStyle = DORADO;
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo((1080 - lineW) / 2, sepY);
  ctx.lineTo((1080 + lineW) / 2, sepY);
  ctx.stroke();

  // ── VERSÍCULO — y ≈ 590–720, 30 px, legible ──────────────────────────────
  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur  = 10;
  ctx.fillStyle   = 'rgba(255,255,255,0.97)';
  ctx.font        = 'italic 38px Roboto';
  const vText  = '“' + versiculo + '”';
  const vwords = vText.split(' '); let vl = ''; let vy = Math.max(sepY + 105, 595);
  for (const w of vwords) {
    const t = vl ? vl+' '+w : w;
    if (ctx.measureText(t).width > 880) { ctx.fillText(vl, 540, vy); vl = w; vy += 44; }
    else vl = t;
  }
  if (vl) { ctx.fillText(vl, 540, vy); vy += 44; }

  // ── REFERENCIA — y ≈ 880–930 ─────────────────────────────────────────────
  ctx.fillStyle = DORADO;
  ctx.font      = 'bold 32px Roboto';
  const refY = Math.max(Math.min(vy + 44, 930), 850);
  ctx.fillText('— ' + referencia + ' —', 540, refY);

  ctx.shadowBlur = 0;

  // ── FOOTER — encima de la foto, y=985..1080 ──────────────────────────────
  ctx.fillStyle = AZUL;
  ctx.fillRect(0, 985, 1080, 95);
  ctx.fillStyle = DORADO;
  ctx.fillRect(0, 985, 1080, 2);                    // línea dorada superior

  ctx.fillStyle = DORADO;
  ctx.font      = 'bold 22px Roboto';
  ctx.fillText(branding.footerLinea1 || 'Comunidad de Fe Maravillas Del Reino · Dallas, TX', 540, 1020);
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font      = '18px Roboto';
  ctx.fillText(branding.footerLinea2 || '@MaravillaDelReino', 540, 1050);

  // ── VALIDACIÓN ─────────────────────────────────────────────────────────────
  const comp = { photoWidth:1080, heroFontSize:heroSz, verseFontSize:38, noLateralMargins:true };
  console.log('[CoverFe] Composición:', JSON.stringify(comp));
  if (comp.heroFontSize < 60 || comp.verseFontSize < 26) {
    console.error('[CoverFe] FALLA validación — abortando'); return null;
  }

  return canvas.toBuffer('image/png');
}
// ── AMAZON CREATORS API — FANCY BY ROXETTE ────────────────────────────────
// Función EXCLUSIVA de Fancy — NO compartida con otras páginas
// SDK oficial: @amzn/creatorsapi-nodejs-sdk v1.3.0 (OAuth 2.0 / LWA)
// Variables Railway: AMAZON_CREATORS_CREDENTIAL_ID, AMAZON_CREATORS_CREDENTIAL_SECRET,
//                    AMAZON_CREATORS_CREDENTIAL_VERSION, AMAZON_TAG
// NO publicar — solo obtener producto real y loggear

async function getAmazonProductFancy(searchTerm) {
  const credentialId      = process.env.AMAZON_CREATORS_CREDENTIAL_ID;
  const credentialSecret  = process.env.AMAZON_CREATORS_CREDENTIAL_SECRET;
  const credentialVersion = process.env.AMAZON_CREATORS_CREDENTIAL_VERSION;
  const partnerTag        = process.env.AMAZON_TAG || 'fancybyroxette-20';

  if (!credentialId || !credentialSecret || !credentialVersion) {
    console.error('[AmazonFancy] ⚠️ Faltan variables Railway: AMAZON_CREATORS_CREDENTIAL_ID / SECRET / VERSION');
    return null;
  }

  try {
    const { ApiClient, DefaultApi, SearchItemsRequestContent } = require('@amzn/creatorsapi-nodejs-sdk');

    // Configurar cliente OAuth 2.0 (el SDK gestiona token, caché y renovación)
    const apiClient = new ApiClient();
    apiClient.credentialId      = credentialId;
    apiClient.credentialSecret  = credentialSecret;
    apiClient.version           = credentialVersion;

    const api = new DefaultApi(apiClient);

    // Construir SearchItemsRequest
    const req         = new SearchItemsRequestContent(partnerTag);
    req.keywords      = searchTerm;
    req.searchIndex   = 'All';
    req.itemCount     = 5;
    req.resources     = [
      'images.primary.large',
      'images.primary.medium',
      'itemInfo.title',
      'offersV2.listings.price',
    ];

    // Llamada al API — marketplace US
    const response = await api.searchItems('www.amazon.com', req);

    // Validar respuesta
    const items = response && response.searchResult && response.searchResult.items;
    if (!items || items.length === 0) {
      console.error('[AmazonFancy] NoProductsFound para:', searchTerm);
      return null;
    }

    // Filtrar candidatos válidos: deben tener ASIN + title + URL + imagen
    const candidatos = items.filter(item => {
      const tieneAsin  = !!item.asin;
      const tieneTitle = item.itemInfo && item.itemInfo.title && item.itemInfo.title.displayValue;
      const tieneURL   = !!item.detailPageURL;
      const tieneImg   = item.images && item.images.primary &&
                         (item.images.primary.large || item.images.primary.medium);
      return tieneAsin && tieneTitle && tieneURL && tieneImg;
    });

    if (candidatos.length === 0) {
      console.error('[AmazonFancy] Sin candidatos válidos (sin imagen o sin URL) para:', searchTerm);
      return null;
    }

    // Seleccionar primer candidato válido
    const item   = candidatos[0];
    const imgObj = item.images.primary.large || item.images.primary.medium;
    const price  = item.offersV2 && item.offersV2.listings && item.offersV2.listings[0] &&
                   item.offersV2.listings[0].price && item.offersV2.listings[0].price.money
                     ? item.offersV2.listings[0].price.money.displayAmount
                     : null; // precio es OPCIONAL — no es error si es null

    // Producto normalizado — estructura interna Fancy
    return {
      asin:          item.asin,
      title:         item.itemInfo.title.displayValue,
      image:         imgObj.url || null,
      price:         price,           // string displayable o null
      detailPageURL: item.detailPageURL, // URL devuelta por Amazon — NO reconstruir
    };

  } catch (e) {
    // Loggear error de API sin exponer credenciales
    const errType   = (e.status ? 'HTTP ' + e.status : '') || '';
    const errReason = (e.body && (e.body.message || e.body.type)) || e.message || 'unknown';
    if (e.status === 403) {
      console.error("[AmazonFancy] AssociateNotEligible — cuenta pendiente de habilitación Creators API");
    } else {
      console.error("[AmazonFancy] ❌ Error API:", errType, errReason);
    }
    return null;
  }
}

async function generarCoverFancy(branding, titular, subtitulo, imagenBuffer) {
  const canvas = createCanvas(1080, 1080);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = branding.colorBarra || '#2C1A2E'; ctx.fillRect(0, 0, 1080, 1080);
  if (imagenBuffer) {
    try {
      const img = await loadImage(imagenBuffer); ctx.globalAlpha = 0.4; ctx.drawImage(img, 0, 0, 1080, 1080); ctx.globalAlpha = 1;
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

// ── VISUAL ENGINE V2 — Fancy by Roxette ─────────────────────────────────────────────
// generarCoverFancyV2: renderer experimental INDEPENDIENTE de generarCoverFancy()
// Layout LIFESTYLE_HERO: zona editorial izquierda | zona visual derecha (fotografía protagonista)
// NO modifica ni llama ninguna función de producción existente.
async function generarCoverFancyV2({ branding, visualLabel, titular, microtexto, imagenBuffer, layout, fuchsiaWord }) {
  const canvas = createCanvas(1080, 1080);
  const ctx    = canvas.getContext('2d');

  const CREAM   = '#FFF8F1';
  const FUCHSIA = '#D50067';
  const YELLOW  = '#FFD52A';
  const BLACK   = '#111111';
  const GRAY    = '#555555';

  // Geometría LIFESTYLE_HERO — Iteración 2
  const LEFT_SOLID  = 490;
  const LEFT_FADE   = 590;
  const MARGIN_L    = 60;
  const EDITORIAL_W = LEFT_SOLID - MARGIN_L - 30;   // ≈400px

  // ── CAPA 1: FOTOGRAFÍA FULL CANVAS ──────────────────────────────────────
  let photoLoaded = false;
  if (imagenBuffer) {
    try {
      const img = await loadImage(imagenBuffer);
      drawImageCover(ctx, img, 1080, 1080);
      photoLoaded = true;
    } catch (e) {
      console.log('[ FancyV2 ] Error cargando imagenBuffer:', e.message);
    }
  }
  if (!photoLoaded) {
    console.log('[ FancyV2 ] Pexels image unavailable — rendering fallback');
    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, 1080, 1080);
  }

  // ── CAPA 2: PANEL CREMA + GRADIENTE HORIZONTAL ──────────────────────────
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, LEFT_SOLID, 1080);
  const leftGrad = ctx.createLinearGradient(LEFT_SOLID, 0, LEFT_FADE, 0);
  leftGrad.addColorStop(0, 'rgba(255,248,241,1)');
  leftGrad.addColorStop(1, 'rgba(255,248,241,0)');
  ctx.fillStyle = leftGrad;
  ctx.fillRect(LEFT_SOLID, 0, LEFT_FADE - LEFT_SOLID, 1080);

  // ── CAPA 3: BRANDING ─────────────────────────────────────────────────────
  ctx.textAlign = 'left';
  ctx.font      = 'bold 42px Roboto';
  ctx.fillStyle = BLACK;
  ctx.fillText('FANCY', MARGIN_L, 108);
  ctx.fillStyle = FUCHSIA;
  ctx.fillRect(MARGIN_L, 116, 210, 3);
  ctx.font      = '15px Roboto';
  ctx.fillStyle = GRAY;
  ctx.fillText('by ROXETTE', MARGIN_L, 142);

  // ── CAPA 4: VISUAL LABEL ─────────────────────────────────────────────────
  const label  = (visualLabel || 'STYLE IT').toUpperCase();
  ctx.font     = 'bold 19px Roboto';
  const labelW = ctx.measureText(label).width + 30;
  const labelH = 50;
  const labelY = 210;
  ctx.fillStyle = YELLOW;
  ctx.fillRect(MARGIN_L, labelY, labelW, labelH);
  ctx.fillStyle = BLACK;
  ctx.fillText(label, MARGIN_L + 15, labelY + 34);

  // ── CAPA 5: TITULAR — fuente adaptativa + wrapping equilibrado ───────────
  const titWords = (titular || '').toUpperCase().split(' ');

  function wrapTitular(size) {
    ctx.font = `bold ${size}px Roboto`;
    const lines = []; let curr = '';
    for (let i = 0; i < titWords.length; i++) {
      if (lines.length >= 2) {
        curr = curr ? `${curr} ${titWords[i]}` : titWords[i]; continue;
      }
      const test = curr ? `${curr} ${titWords[i]}` : titWords[i];
      if (ctx.measureText(test).width > EDITORIAL_W && curr) {
        const isOrphan = !curr.includes(' ') && curr.length <= 3;
        if (isOrphan) {
          const withNext = `${curr} ${titWords[i]}`;
          if (ctx.measureText(withNext).width <= EDITORIAL_W * 1.05) {
            curr = withNext; continue;
          }
        }
        lines.push(curr); curr = titWords[i];
      } else { curr = test; }
    }
    if (curr) lines.push(curr);
    return lines;
  }

  // Adaptativo: 78px → 54px safety fallback (rango normal 60–78px)
  let titFontSize = 78;
  let titLines = wrapTitular(titFontSize);
  while (titFontSize > 54 && titLines.some(l => ctx.measureText(l).width > EDITORIAL_W)) {
    titFontSize -= 2;
    titLines = wrapTitular(titFontSize);
  }
  ctx.font = `bold ${titFontSize}px Roboto`;

  // Acento fuchsia en palabra específica (default: segunda palabra del titular)
  const accentWord = (fuchsiaWord || titWords[1] || '').toUpperCase();

  const TIT_START_Y = 310;
  const TIT_LINE_H  = Math.round(titFontSize * 1.18);
  titLines.slice(0, 3).forEach((line, i) => {
    const lineWords = line.split(' ');
    if (lineWords.includes(accentWord)) {
      let x = MARGIN_L;
      lineWords.forEach(w => {
        ctx.fillStyle = (w === accentWord) ? FUCHSIA : BLACK;
        ctx.fillText(w, x, TIT_START_Y + i * TIT_LINE_H);
        x += ctx.measureText(w + ' ').width;
      });
    } else {
      ctx.fillStyle = BLACK;
      ctx.fillText(line, MARGIN_L, TIT_START_Y + i * TIT_LINE_H);
    }
  });

  const titEndY = TIT_START_Y + Math.min(titLines.length, 3) * TIT_LINE_H;

  // ── CAPA 6: MICROTEXTO — posición dinámica desde titEndY ────────────────
  const MICRO_GAP    = 28;
  const MICRO_LINE_H = 36;
  const MICRO_SAFE   = 920;
  let renderedMicroLines = 0;
  if (microtexto) {
    ctx.font      = '26px Roboto';
    ctx.fillStyle = GRAY;
    const mWords = microtexto.split(' ');
    const mLines = []; let mCurr = '';
    for (const w of mWords) {
      if (mLines.length >= 1) { mCurr = mCurr ? `${mCurr} ${w}` : w; continue; }
      const t = mCurr ? `${mCurr} ${w}` : w;
      if (ctx.measureText(t).width > EDITORIAL_W && mCurr) { mLines.push(mCurr); mCurr = w; }
      else { mCurr = t; }
    }
    if (mCurr) mLines.push(mCurr);
    const microStartY = titEndY + MICRO_GAP;
    mLines.slice(0, 2).forEach((line, i) => {
      const lineY = microStartY + i * MICRO_LINE_H;
      if (lineY <= MICRO_SAFE) { ctx.fillText(line, MARGIN_L, lineY); renderedMicroLines++; }
    });
  }

  // ── CAPA 7: ACENTO FUCHSIA ───────────────────────────────────────────────
  const decoY = titEndY + (renderedMicroLines > 0
    ? MICRO_GAP + renderedMicroLines * MICRO_LINE_H + 16
    : 32);
  if (decoY < 980) {
    ctx.fillStyle = FUCHSIA;
    ctx.fillRect(MARGIN_L, decoY, 68, 3);
  }

  return canvas.toBuffer('image/png');
}


// ── FANCY VISUAL ENGINE — Escena AI ─────────────────────────────────────────────────────
// generarEscenaFancyAI: genera la escena fotográfica base vía GPT-Image.
// COMPLETAMENTE AISLADA — no llama ni modifica ninguna función de producción existente.
// No usa Pexels. No usa getImagenFancy(). No crashea en fallo — devuelve null.
async function generarEscenaFancyAI({ category, visualFamily, editorialType, intention, searchTerm, recentVisuals }) {
  try {
    const scenePrompt = `You are the FANCY VISUAL DIRECTOR for "Fancy by Roxette", a premium lifestyle and fashion brand on Facebook.

VISUAL FAMILY: ${visualFamily}
EDITORIAL TYPE: ${editorialType}
CATEGORY: ${category}
INTENTION: ${intention}
SEARCH TERM: ${searchTerm}

Generate a photographic scene with these properties:
- Style: Editorial lifestyle photography, natural light, warm tones, cream and white backgrounds preferred
- Subject: ${searchTerm}
- Mood: aspirational, modern, feminine elegance — never clinical or catalog-flat
- Composition: leave generous space on the LEFT THIRD of the frame for brand text overlay (soft background, no busy detail on the left)
- No text, no logos, no watermarks in the image
- Format: square 1:1, full bleed
- Lighting: soft directional, golden hour or studio-natural
- Color palette: creams, warm whites, blush tones, occasional fuchsia or yellow accent object
- Do NOT include people's faces — hands, body details, flat-lay or object-hero compositions preferred
Output: a vivid present-tense image generation prompt describing the scene directly.`;

    const body = JSON.stringify({
      model: 'gpt-image-1',
      prompt: scenePrompt,
      n: 1,
      size: '1024x1024',
      quality: 'medium'
    });

    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
      },
      body
    });

    const j = await r.json();

    if (!j.data || !j.data[0] || !j.data[0].b64_json) {
      console.log('[ FancyAI ] GPT-Image no devolvio b64_json. Respuesta:', JSON.stringify(j).slice(0, 300));
      return null;
    }

    const buf = Buffer.from(j.data[0].b64_json, 'base64');

    if (buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      console.log('[ FancyAI ] Buffer recibido no es PNG valido.');
      return null;
    }

    console.log('[ FancyAI ] Escena generada correctamente. Tamano:', buf.length, 'bytes');
    return buf;

  } catch (err) {
    console.log('[ FancyAI ] Error en generarEscenaFancyAI:', err.message);
    return null;
  }
}


async function generarCoverTrabajando(branding, gancho) {
  const canvas   = createCanvas(1080, 1080);
  const ctx      = canvas.getContext('2d');
  const VERDE    = '#123F32';
  const DORADO   = branding.colorAccento || '#C9A66B';
  const HEADER_H = 95;
  const FOOTER_Y = 985;
  const FOOTER_H = 95;
  const PHOTO_H  = FOOTER_Y - HEADER_H; // 890px

  // ── 1. HEADER sólido ──────────────────────────────────────────────────────
  ctx.fillStyle = VERDE; ctx.fillRect(0, 0, 1080, HEADER_H);
  ctx.fillStyle = DORADO; ctx.fillRect(0, HEADER_H - 3, 1080, 3);
  ctx.textAlign = 'center';
  const hFont = _cormorantLoaded ? 'bold 56px Cormorant' : 'bold 48px Roboto';
  ctx.font = hFont; ctx.fillStyle = '#FFFFFF';
  ctx.fillText((branding.nombreMarca || 'TRABAJANDO EN CASA').toUpperCase(), 540, 60);
  ctx.font = 'bold 15px Roboto'; ctx.fillStyle = DORADO;
  ctx.fillText((branding.subtituloMarca || 'EMPRENDIMIENTO LATINO').toUpperCase(), 540, 82);

  // ── 2. FOTO protagonista — cover crop en zona y=95..985 ──────────────────
  ctx.fillStyle = '#1A2A20'; ctx.fillRect(0, HEADER_H, 1080, PHOTO_H);
  const query = getQueryTrabajandoByContent(null, gancho);
  const imgUrl = await getImagenTrabajando(query);
  if (imgUrl) {
    try {
      const buf = await descargarImagen(imgUrl);
      if (buf) {
        const img = await loadImage(buf);
        ctx.save();
        ctx.beginPath(); ctx.rect(0, HEADER_H, 1080, PHOTO_H); ctx.clip();
        const ia = img.width / img.height;
        const za = 1080 / PHOTO_H;
        let dw, dh, dx, dy;
        if (ia > za) { dh = PHOTO_H; dw = img.width * (PHOTO_H / img.height); dx = (1080 - dw) / 2; dy = HEADER_H; }
        else          { dw = 1080;   dh = img.height * (1080 / img.width);     dx = 0;                dy = HEADER_H + (PHOTO_H - dh) / 2; }
        ctx.globalAlpha = 1; ctx.drawImage(img, dx, dy, dw, dh); ctx.globalAlpha = 1;
        ctx.restore();
      }
    } catch(e) { console.error('[CoverTrabajando] imagen:', e.message); }
  }

  // ── 3. Gradiente localizado — 55% inferior, solo para legibilidad del gancho
  const gradY = HEADER_H + PHOTO_H * 0.45;
  const grad  = ctx.createLinearGradient(0, gradY, 0, FOOTER_Y);
  grad.addColorStop(0,    'rgba(0,0,0,0.0)');
  grad.addColorStop(0.25, 'rgba(0,0,0,0.18)');
  grad.addColorStop(0.60, 'rgba(0,0,0,0.60)');
  grad.addColorStop(1,    'rgba(0,0,0,0.80)');
  ctx.fillStyle = grad; ctx.fillRect(0, gradY, 1080, FOOTER_Y - gradY);

  // ── 4. GANCHO — protagonista visual, tercio inferior ─────────────────────
  // El gancho puede ser 6–12 palabras, wrap dinámico
  const hf = _cormorantLoaded ? 'Cormorant' : 'Roboto';
  let heroSize = 72;
  ctx.font = `bold ${heroSize}px ${hf}`;
  const palabras = gancho.toUpperCase().split(' ');
  let lineas = []; let linea = '';
  for (const w of palabras) {
    const p = linea ? linea + ' ' + w : w;
    if (ctx.measureText(p).width > 960) { if (linea) lineas.push(linea); linea = w; } else linea = p;
  }
  if (linea) lineas.push(linea);
  // Reducir fuente si hay 4+ líneas
  if (lineas.length >= 4) {
    heroSize = 58; ctx.font = `bold ${heroSize}px ${hf}`;
    lineas = []; linea = '';
    for (const w of palabras) {
      const p = linea ? linea + ' ' + w : w;
      if (ctx.measureText(p).width > 960) { if (linea) lineas.push(linea); linea = w; } else linea = p;
    }
    if (linea) lineas.push(linea);
  }
  const lineH = Math.round(heroSize * 1.20);
  // Anclar al tercio inferior, subir según número de líneas
  let heroY = 820 - (lineas.length - 1) * lineH;
  if (heroY < HEADER_H + 60) heroY = HEADER_H + 60; // nunca salir del canvas
  ctx.shadowColor = 'rgba(0,0,0,0.92)'; ctx.shadowBlur = 18;
  ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center';
  for (const l of lineas) { ctx.fillText(l, 540, heroY); heroY += lineH; }
  ctx.shadowBlur = 0;

  // ── 5. FOOTER sólido ─────────────────────────────────────────────────────
  ctx.fillStyle = VERDE; ctx.fillRect(0, FOOTER_Y, 1080, FOOTER_H);
  ctx.fillStyle = DORADO; ctx.fillRect(0, FOOTER_Y, 1080, 3);
  ctx.textAlign = 'center';
  ctx.fillStyle = DORADO; ctx.font = 'bold 20px Roboto';
  ctx.fillText(branding.footerLinea1 || 'Trabajando En Casa · Emprendedoras Latinas', 540, FOOTER_Y + 35);
  ctx.fillStyle = 'rgba(240,248,236,0.80)'; ctx.font = '16px Roboto';
  ctx.fillText(branding.footerLinea2 || '@TrabajarDesdeCasa', 540, FOOTER_Y + 58);

  return canvas.toBuffer('image/png');
}

async function generarCoverAmarEs(branding, gancho, reflexion, dallePrompt) {
  const canvas = createCanvas(1080, 1080);
  const ctx    = canvas.getContext('2d');
  const CREMA  = '#F5EDE0';
  const DORADO = branding.colorAccento || '#E8C5B0';
  const hFont  = _cormorantLoaded ? 'Cormorant' : 'Roboto';

  // ── Fondo fallback ────────────────────────────────────────────────────────
  ctx.fillStyle = '#3D1A24'; ctx.fillRect(0, 0, 1080, 1080);

  if (!process.env.OPENAI_API_KEY || !dallePrompt) {
    console.error('[AmarEs] OPENAI_API_KEY ausente o sin prompt — cancelando'); return null;
  }
  let usedAI = false;
  try {
    // Prompt premium: chibi, paleta cálida, sin texto, sin marcas de agua
    const aiPrompt = 'Premium cinematic chibi anime illustration, polished digital painting quality. Scene: ' + dallePrompt + '. Style: soft detailed hair with natural flow, delicate refined chibi face, big expressive eyes, round cute proportions, warm golden hour cinematic lighting, soft volumetric light rays, subtle ambient bokeh background with shallow depth of field, soft atmospheric glow, rich environmental detail with elegant romantic atmosphere, warm amber and cream and peach and brown color palette, emotionally expressive high-end editorial illustration, clean professional finish, gentle satin-like rendering. Background must be detailed and atmospheric — soft natural environment, interior with warm window light, petals, or warm bokeh lights. NO flat cartoon background. NO generic pink background. NO excessive hearts. NO sticker style. NO clipart. NO watercolor. NO photorealism. NO 3D render. NO text. NO letters. NO watermark.';
    const body = JSON.stringify({ model: 'gpt-image-1', prompt: aiPrompt, n: 1, size: '1024x1024', quality: 'medium' });
    const r = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY }, body });
    const j = await r.json();
    if (j.data && j.data[0] && j.data[0].b64_json) {
      const _fs = require('fs'); const _os = require('os'); const _path = require('path');
      const _buf  = Buffer.from(j.data[0].b64_json, 'base64');
      const _hex8 = _buf.slice(0, 8).toString('hex');
      console.log('[AmarEs] buffer.length:', _buf.length, '| primeros 8 bytes:', _hex8);
      if (_hex8 !== '89504e470d0a1a0a') {
        console.error('[AmarEs] Firma inválida — no es PNG. Recibido:', _hex8, '— cancelando');
      } else {
        const _tmp = _path.join(_os.tmpdir(), 'amares_' + Date.now() + '.png');
        try {
          _fs.writeFileSync(_tmp, _buf);
          const img = await loadImage(_tmp);
          // Ilustración protagonista — full canvas, sin transparencia
          ctx.globalAlpha = 1; drawImageCover(ctx, img, 1080, 1080); ctx.globalAlpha = 1;
          usedAI = true; console.log('[AmarEs] gpt-image-1 OK');
        } finally { try { _fs.unlinkSync(_tmp); } catch(_e) {} }
      }
    } else { console.error('[AmarEs] gpt-image-1 sin datos:', JSON.stringify(j).substring(0, 200)); }
  } catch(e) { console.error('[AmarEs] gpt-image-1 error:', e.message); }
  if (!usedAI) { console.error('[AmarEs] OpenAI falló — cancelando publicación'); return null; }

  // ── Gradiente localizado — SOLO zona inferior, muy suave ─────────────────
  const grad = ctx.createLinearGradient(0, 560, 0, 1080);
  grad.addColorStop(0,    'rgba(40,20,20,0.0)');
  grad.addColorStop(0.55, 'rgba(40,20,20,0.12)');
  grad.addColorStop(0.82, 'rgba(40,20,20,0.48)');
  grad.addColorStop(1,    'rgba(40,20,20,0.68)');
  ctx.fillStyle = grad; ctx.fillRect(0, 560, 1080, 520);

  // ── HEADER flotante — "AMAR ES" sobre la imagen ───────────────────────────
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.70)'; ctx.shadowBlur = 12;
  ctx.font = `bold 60px ${hFont}`; ctx.fillStyle = '#FFFFFF';
  ctx.fillText((branding.nombreMarca || 'AMAR ES').toUpperCase(), 540, 62);
  ctx.shadowBlur = 0;

  // ── GANCHO principal — tercio inferior, serif premium ────────────────────
  let heroSize = 74; ctx.font = `bold ${heroSize}px ${hFont}`;
  const palabras = gancho.toUpperCase().split(' ');
  let lineas = []; let linea = '';
  for (const w of palabras) {
    const p = linea ? linea + ' ' + w : w;
    if (ctx.measureText(p).width > 820) { if (linea) lineas.push(linea); linea = w; } else linea = p;
  }
  if (linea) lineas.push(linea);
  if (lineas.length >= 3) { heroSize = 62; ctx.font = `bold ${heroSize}px ${hFont}`; }
  if (heroSize < 58) heroSize = 58;
  const lineH = Math.round(heroSize * 1.18);
  let heroY   = 840 - (lineas.length - 1) * lineH;
  ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 18;
  ctx.fillStyle = '#FFFFFF';
  for (const l of lineas) { ctx.fillText(l, 540, heroY); heroY += lineH; }

  // ── REFLEXIÓN — itálica, íntima, debajo del gancho ───────────────────────
  if (reflexion) {
    ctx.font = `italic ${_cormorantLoaded ? 25 : 22}px ${hFont}`;
    ctx.fillStyle = CREMA;
    ctx.fillText(reflexion.toLowerCase(), 540, heroY + 30);
    heroY += 30;
  }
  ctx.shadowBlur = 0;

  // ── FOOTER integrado — texto flotante, sin barra ──────────────────────────
  ctx.font = '13px Roboto'; ctx.fillStyle = 'rgba(245,237,224,0.65)';
  ctx.fillText('AMOR · RELACIONES · BIENESTAR', 540, 1052);

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
  // Diseño Magazine Editorial Pasarela — 1080x1080
  const canvas = createCanvas(1080, 1080);
  const ctx = canvas.getContext('2d');
  const HEADER_H = 84, FOOTER_H = 52;
  const FUCSIA = '#FF1493';
  // Fondo negro
  ctx.fillStyle = '#0D0A0B'; ctx.fillRect(0, 0, 1080, 1080);
  // Foto protagonista — object-fit cover, canvas completo
  if (imgBuf) {
    try {
      const img = await loadImage(imgBuf);
      const aspect = img.width / img.height;
      let dw, dh, dx, dy;
      if (aspect > 1) { dh = 1080; dw = dh * aspect; dx = (1080 - dw) / 2; dy = 0; }
      else { dw = 1080; dh = dw / aspect; dx = 0; dy = (1080 - dh) / 2; }
      ctx.globalAlpha = 0.88; ctx.drawImage(img, dx, dy, dw, dh); ctx.globalAlpha = 1;
    } catch(e) { console.error('[Cover] img error:', e.message); }
  }
  // Gradiente oscuro zona inferior (legibilidad del título)
  const grad = ctx.createLinearGradient(0, 460, 0, 1080 - FOOTER_H);
  grad.addColorStop(0, 'rgba(13,10,11,0)');
  grad.addColorStop(0.4, 'rgba(13,10,11,0.72)');
  grad.addColorStop(1, 'rgba(13,10,11,0.97)');
  ctx.fillStyle = grad; ctx.fillRect(0, HEADER_H, 1080, 1080 - HEADER_H);
  // ── HEADER FUCSIA ────────────────────────────────────────────────────────────
  ctx.fillStyle = FUCSIA; ctx.fillRect(0, 0, 1080, HEADER_H);
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 34px Roboto'; ctx.textAlign = 'center';
  ctx.fillText('PASARELA STUDIO INTERNACIONAL', 540, 56);
  // ── FOOTER FUCSIA ────────────────────────────────────────────────────────────
  ctx.fillStyle = FUCSIA; ctx.fillRect(0, 1080 - FOOTER_H, 1080, FOOTER_H);
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 17px Roboto'; ctx.textAlign = 'center';
  ctx.fillText('PASARELA STUDIO INTERNACIONAL  -  pasarelastudiointer.com', 540, 1080 - FOOTER_H + 34);
  // ── CALCULAR POSICIÓN DEL TÍTULO ─────────────────────────────────────────────
  let hFont = _cormorantLoaded ? 'bold 62px Cormorant' : 'bold 54px Roboto';
  ctx.font = hFont; ctx.textAlign = 'left';
  const maxW = 960, words = titulo.split(' ');
  let lines = [], cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  if (lines.length > 4) {
    hFont = _cormorantLoaded ? 'bold 48px Cormorant' : 'bold 42px Roboto';
    ctx.font = hFont; lines = []; cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
  }
  const lineH = _cormorantLoaded ? 74 : 66;
  const titleBottom = 1080 - FOOTER_H - 22;
  const titleTop    = titleBottom - (lines.length - 1) * lineH;
  // ── BADGE EDITORIAL + FECHA (encima del título) ───────────────────────────────
  const by = titleTop - 92, bx = 52, bw = 120, bh = 30;
  ctx.fillStyle = FUCSIA;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 14px Roboto'; ctx.textAlign = 'left';
  ctx.fillText('EDITORIAL', bx + 14, by + 20);
  ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = '13px Roboto'; ctx.textAlign = 'right';
  ctx.fillText(fecha || new Date().toLocaleDateString('es-MX', {day:'numeric',month:'long',year:'numeric'}), 1028, by + 20);
  // Acento dorado sobre el título
  ctx.fillStyle = '#C9A66B'; ctx.fillRect(52, titleTop - 14, 70, 3);
  // ── TÍTULO ───────────────────────────────────────────────────────────────────
  ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'left'; ctx.font = hFont;
  let ty = titleTop;
  for (const ln of lines) { ctx.fillText(ln, 52, ty); ty += lineH; }
  return canvas.toBuffer('image/png');
}

async function generarCoverPasarelaMaster({ imageBuf, titulo, fecha }) {
  // ═══════════════════════════════════════════════════════════════════════
  // PLANTILLA MAESTRA — Pasarela Studio Internacional
  // 1080×1080 · Dark Editorial · Fucsia #FF0A8A · Aprobada Sep 2026
  // ═══════════════════════════════════════════════════════════════════════
  const canvas = createCanvas(1080, 1080);
  const ctx    = canvas.getContext('2d');
  const FUCSIA  = '#FF0A8A';
  const GOLD    = '#C9A66B';
  const NEGRO   = '#0D0A0B';
  const BLANCO  = '#FFFFFF';
  const HEADER_H = 88;
  const FOOTER_H = 56;

  // Fuentes con fallback
  const fHeader  = _montserratLoaded ? 'Montserrat' : 'Roboto';
  const fTitular = _playfairLoaded   ? 'Playfair'   : (_cormorantLoaded ? 'Cormorant' : 'Roboto');

  // ── 1. Fondo negro base ──────────────────────────────────────────────────
  ctx.fillStyle = NEGRO; ctx.fillRect(0, 0, 1080, 1080);

  // ── 2. Foto protagonista — object-fit cover, canvas completo ────────────
  if (imageBuf) {
    try {
      const img = await loadImage(imageBuf);
      const iA  = img.width / img.height;
      let dw, dh, dx, dy;
      if (iA > 1) { dh = 1080; dw = dh * iA; dx = (1080 - dw) / 2; dy = 0; }
      else        { dw = 1080; dh = dw / iA;  dx = 0; dy = (1080 - dh) / 2; }
      ctx.globalAlpha = 0.90; ctx.drawImage(img, dx, dy, dw, dh); ctx.globalAlpha = 1;
    } catch(e) { console.error('[CoverMaster] img error:', e.message); }
  }

  // ── 3. Gradiente superior (header a 40%) ────────────────────────────────
  const gTop = ctx.createLinearGradient(0, 0, 0, 420);
  gTop.addColorStop(0,    'rgba(13,10,11,0.62)');
  gTop.addColorStop(0.45, 'rgba(13,10,11,0.18)');
  gTop.addColorStop(1,    'rgba(13,10,11,0)');
  ctx.fillStyle = gTop; ctx.fillRect(0, HEADER_H, 1080, 420);

  // ── 4. Gradiente inferior (legibilidad título) ────────────────────────────
  const gBot = ctx.createLinearGradient(0, 440, 0, 1080 - FOOTER_H);
  gBot.addColorStop(0,    'rgba(13,10,11,0)');
  gBot.addColorStop(0.38, 'rgba(13,10,11,0.70)');
  gBot.addColorStop(1,    'rgba(13,10,11,0.97)');
  ctx.fillStyle = gBot; ctx.fillRect(0, 440, 1080, 1080 - FOOTER_H - 440);

  // ── 5. HEADER FUCSIA ─────────────────────────────────────────────────────
  ctx.fillStyle = FUCSIA; ctx.fillRect(0, 0, 1080, HEADER_H);
  ctx.fillStyle = BLANCO;
  ctx.font      = `bold 30px ${fHeader}`;
  ctx.textAlign = 'center';
  ctx.fillText('PASARELA STUDIO INTERNACIONAL', 540, 57);

  // ── 6. FOOTER FUCSIA ─────────────────────────────────────────────────────
  ctx.fillStyle = FUCSIA; ctx.fillRect(0, 1080 - FOOTER_H, 1080, FOOTER_H);
  ctx.fillStyle = BLANCO;
  ctx.font      = `bold 15px ${fHeader}`;
  ctx.textAlign = 'center';
  ctx.fillText('PASARELA STUDIO INTERNACIONAL  ·  pasarelastudiointer.com', 540, 1080 - FOOTER_H + 36);

  // ── 7. Word-wrap del título ───────────────────────────────────────────────
  const maxW    = 970;
  const words   = titulo.split(' ');
  let   tSize   = 68;
  let   lines   = [];
  let   lineH   = 0;
  const wrapLines = (sz) => {
    ctx.font = `bold ${sz}px ${fTitular}`;
    const ls = []; let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW) { if (cur) ls.push(cur); cur = w; } else cur = t;
    }
    if (cur) ls.push(cur);
    return ls;
  };
  lines = wrapLines(tSize);
  if (lines.length > 4) { tSize = 52; lines = wrapLines(tSize); }
  lineH = Math.round(tSize * 1.22);
  ctx.font = `bold ${tSize}px ${fTitular}`;

  // ── 8. Posición ancla título (zona inferior, sobre el footer) ────────────
  const titleBottom = 1080 - FOOTER_H - 24;
  const titleTop    = titleBottom - (lines.length - 1) * lineH;

  // ── 9. Badge EDITORIAL + fecha ────────────────────────────────────────────
  const badgeY = titleTop - 94;
  const badgeX = 52, badgeW = 130, badgeH = 32;
  ctx.fillStyle = FUCSIA;
  ctx.beginPath(); ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 5); ctx.fill();
  ctx.fillStyle = BLANCO;
  ctx.font      = `bold 13px ${fHeader}`;
  ctx.textAlign = 'left';
  ctx.fillText('EDITORIAL', badgeX + 16, badgeY + 22);
  const fechaStr = fecha || new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.fillStyle = 'rgba(255,255,255,0.68)';
  ctx.font      = `12px ${fHeader}`;
  ctx.textAlign = 'right';
  ctx.fillText(fechaStr, 1028, badgeY + 22);

  // ── 10. Línea dorada sobre el título ────────────────────────────────────
  ctx.fillStyle = GOLD; ctx.fillRect(52, titleTop - 16, 80, 3);

  // ── 11. TÍTULO principal ─────────────────────────────────────────────────
  ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 14;
  ctx.fillStyle = BLANCO;
  ctx.font      = `bold ${tSize}px ${fTitular}`;
  ctx.textAlign = 'left';
  let ty = titleTop;
  for (const ln of lines) { ctx.fillText(ln, 52, ty); ty += lineH; }
  ctx.shadowBlur = 0;

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
    // Fancy Commerce Engine — lógica movida a funciones globales (elegirTipoEditorialFancy, etc.)
    console.log('[MultiPage] tipo:', pageConfig.tipo, '| esFe:', esFe, '| esAmor:', esAmor, '| nombre:', pageConfig.nombre);
    const temaActual = pageConfig.temas && pageConfig.temas.length ? pageConfig.temas[Math.floor(Math.random() * pageConfig.temas.length)] : titulo;
    const formatoAmor = 'Responde en este formato exacto (sin comillas, sin asteriscos, sin texto adicional):\nSCENE: [describe in English a specific romantic scene for the Amor Es chibi couple — location, lighting, specific action, emotion — max 200 chars]\nGANCHO: [frase gancho max 7 palabras en español, mayúsculas, impactante, 2ª persona]\nREFLEXION: [una sola línea poética emotiva max 12 palabras, español, minúsculas]\nMICROHISTORIA: [2 a 3 líneas en segunda persona, emotivas, sin hashtags — narra el momento como si le hablaras directamente a ella]\nCTA: [pregunta conversacional corta para invitar a comentar, español]\nPILAR: [elige uno: amor de pareja | amor propio | relaciones sanas | pequeños gestos cotidianos | sanar y dejar ir | familia y complicidad]\nHASHTAGS: ' + (pageConfig.hashtags || '#AmarEs #AmorPropio') + ' — escoge máximo 3 hashtags relevantes al pilar elegido, sin repetición';
    const formatoFe = 'Responde en este formato exacto (sin comillas ni asteriscos):\nAFIRMACION: [frase corta tipo "SOY..." o "TENGO..." máx 6 palabras]\nHERO: [1 a 3 palabras clave poderosas en mayúsculas, ej: EN CRISTO, PAZ, ORO]\nVERSICULO: [cita bíblica real completa relacionada, máx 120 caracteres]\nREFERENCIA: [libro capítulo:versículo, ej: Juan 3:16]\nCAPTION: [1 o 2 frases inspiradoras para el post de Facebook]\nHASHTAGS: ' + (pageConfig.hashtags || '#Fe #Biblia');
    const formatoGenerico = 'Responde en este formato exacto (sin comillas ni asteriscos):\nCOVER: [frase de MÁXIMO 4 PALABRAS en español — solo sustantivos/adjetivos poderosos]\nCAPTION: [2 líneas reflexivas o inspiradoras]\nHASHTAGS: ' + (pageConfig.hashtags || '#Inspiracion #Reflexion #Vida');
    const pilarTrabajando = esTrabajando ? elegirPilarTrabajando() : null;
    // Pool de hashtags — seleccionar 3-5 relevantes al pilar
    const hashPoolTrab = (pageConfig.hashtags || '#TrabajarDesdeCasa #EmprendimientoLatino #MujeresEmprendedoras').split(' ');
    const hashSampleTrab = hashPoolTrab.sort(() => 0.5 - Math.random()).slice(0, 5).join(' ');
    const formatoTrabajando = `Eres una mujer hablando con otra mujer. Cercana, inteligente, práctica. Sin lenguaje de gurú, sin clichés, sin promesas exageradas.
VOZ: Puede provocar y desafiar, pero NUNCA regañar. Evita frases agresivas como "eso es mentira", "deja de poner excusas", "si no lo haces es porque no quieres". Prefiere: "nadie empieza con todo listo", "empezar imperfecta también es empezar", "no necesitas tener todo resuelto para comenzar".
PILAR OBLIGATORIO PARA ESTA PUBLICACIÓN: ${pilarTrabajando}
Genera exactamente este formato (sin comillas, sin asteriscos, SIN incluir las etiquetas en el texto final — solo úsalas para estructurar tu respuesta):
GANCHO: [pregunta, contradicción o afirmación que detenga el scroll — máx 10 palabras — firme y cercana, nunca agresiva — ejemplos: "¿Y si no te falta talento, sino empezar?", "Estar ocupada no significa estar avanzando.", "Nadie empieza con todo listo."]
REVELACION: [1-3 frases que desarrollen el gancho — clara, útil, realista, práctica — escribe el texto directamente sin repetir la palabra REVELACION — aprox 30-60 palabras]
CTA: [escribe directamente el llamado a acción sin la palabra CTA — varía el tipo: invita a comentar / guardar / compartir / hacer algo hoy — máx 20 palabras]
HASHTAGS: [exactamente 3-5 hashtags relevantes al pilar ${pilarTrabajando} — de este pool: ${hashSampleTrab}]`;

    // Fancy usa su propio flujo de copy (generarCopyFancy) — se salta la llamada principal
    let caption = '';
    if (!esFancy) {
      const captionPayload = JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: esAmor ? 520 : esFe ? 220 : esTrabajando ? 350 : 200,
        system: pageConfig.voice + ' ' + (esFe ? formatoFe : esAmor ? formatoAmor : esTrabajando ? formatoTrabajando : formatoGenerico),
        messages: [{ role: 'user', content: 'Tema: ' + temaActual }]
      });
      caption = await new Promise((resolve, reject) => {
        const opts = { hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(captionPayload) } };
        const r = https.request(opts, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d).content?.[0]?.text || ''); } catch(e) { reject(e); } }); });
        r.on('error', reject); r.write(captionPayload); r.end();
      });
      if (!caption) { console.error('[MultiPage] Caption vacío para:', pageConfig.nombre); return; }
    }
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
      // ── Fancy Commerce Engine Fase 2 ─────────────────────────────────────
      const tipoEditorial  = elegirTipoEditorialFancy();
      const categoria      = elegirCategoriaFancy(tipoEditorial);
      const intencion      = elegirIntencionCompraFancy(tipoEditorial, categoria);
      const amazonLink     = obtenerEnlaceFancy(categoria, intencion);
      console.log('[Fancy] tipoEditorial:', tipoEditorial, '| cat:', categoria.tema, '| intencion:', intencion);
      // Obtener imagen dinámica Pexels (anti-repetición)
      const imagenBuffer   = await getImagenFancy(categoria, tipoEditorial, intencion);
      // Generar copy type-specific
      const copyRaw        = await generarCopyFancy(tipoEditorial, categoria, intencion);
      const titularMatch   = copyRaw.match(/TITULAR:\s*(.+)/i);
      const subMatch       = copyRaw.match(/SUBTITULO:\s*(.+)/i);
      const capMatch       = copyRaw.match(/CAPTION:\s*([\s\S]+?)(?=CTA:|HASHTAGS:|$)/i);
      const ctaMatch       = copyRaw.match(/CTA:\s*(.+)/i);
      const hashMatch      = copyRaw.match(/HASHTAGS:\s*(.+)/i);
      const titular        = titularMatch ? titularMatch[1].trim() : categoria.tema.toUpperCase();
      const subtitulo      = subMatch     ? subMatch[1].trim()     : '';
      const capTexto       = capMatch     ? capMatch[1].trim().replace(/#\S+/g, '').replace(/\n{3,}/g, '\n\n').trim()     : '';
      const ctaTexto       = ctaMatch     ? ctaMatch[1].trim()     : '';
      const hashArr        = [...new Set((hashMatch ? hashMatch[1].trim() : '#FancyByRoxette #Moda').split(/\s+/).filter(h => h.startsWith('#')))].slice(0, 4).join(' ');
      captionTexto = capTexto + '\n\n' + ctaTexto + '\n🔗 ' + amazonLink + '\n*(enlace de afiliado)' + '\n\n— Fancy by Roxette ✨\n\n' + hashArr;
      console.log('[Fancy] TITULAR:', titular, '| SUBTITULO:', subtitulo);
      coverBuffer = await generarCoverFancy(pageConfig.branding, titular, subtitulo, imagenBuffer);
    } else if (esTrabajando) {
      const ganchoMatch = caption.match(/GANCHO:\s*(.+)/i);
      const revelMatch  = caption.match(/REVELACION:\s*([\s\S]+?)(?=CTA:|HASHTAGS:|$)/i);
      const ctaMatch    = caption.match(/CTA:\s*(.+)/i);
      const hashMatch   = caption.match(/HASHTAGS:\s*(.+)/i);
      // Gancho: nunca usar fallback de otras páginas — fallback exclusivo Trabajando
      const GANCHO_FALLBACK_TRAB = 'EMPIEZA CON LO QUE TIENES';
      const MARCAS_PROHIBIDAS_TRAB = /pasarela|revista|fancy|amar\s*es|maravillas\s*del\s*reino/i;
      const ganchoRaw = ganchoMatch ? ganchoMatch[1].trim() : '';
      let gancho;
      if (!ganchoRaw) {
        console.error('[Trabajando] ⚠️ GANCHO ausente — usando fallback seguro');
        gancho = GANCHO_FALLBACK_TRAB;
      } else if (MARCAS_PROHIBIDAS_TRAB.test(ganchoRaw)) {
        console.error('[Trabajando] 🚫 GANCHO contaminado con marca ajena:', ganchoRaw, '— usando fallback');
        gancho = GANCHO_FALLBACK_TRAB;
      } else {
        gancho = ganchoRaw;
      }
      // Limpiar etiquetas internas si el modelo las incluyó en el texto
      const stripLabel = (t) => (t || '').replace(/^(REVELACION|CTA|ACTION|COMMENT|SAVE|SHARE|COMMUNITY|GANCHO|HASHTAGS)\s*:\s*/i, '').trim();
      const revelTexto  = stripLabel(revelMatch  ? revelMatch[1].trim()  : '');
      const ctaTexto    = stripLabel(ctaMatch    ? ctaMatch[1].trim()    : '');
      // Hashtags: solo los del modelo, deduplicados, máximo 5 total (sin concatenar pageConfig)
      const hashTexto   = hashMatch ? hashMatch[1].trim() : hashSampleTrab || '#TrabajarDesdeCasa #EmprendimientoLatino';
      const hashArr     = [...new Set(hashTexto.split(/\s+/).filter(h => h.startsWith('#')))].slice(0, 5).join(' ');
      // Copy: REVELACION + CTA + HASHTAGS (el gancho ya va en la imagen, no repetir)
      captionTexto = revelTexto + (ctaTexto ? '\n\n' + ctaTexto : '') + '\n\n' + hashArr;
      // ── Validación antes de publicar ──────────────────────────────────────
      const LABELS_INTERNAS_TRAB = /\b(GANCHO|REVELACION|CTA|ACTION|COMMENT|SAVE|SHARE|COMMUNITY|PILAR|HASHTAGS)\s*:/i;
      const hashFinalArr = hashArr.split(/\s+/).filter(h => h.startsWith('#'));
      const trabajandoOk = gancho && gancho.trim()
        && revelTexto && revelTexto.trim()
        && ctaTexto && ctaTexto.trim()
        && hashFinalArr.length >= 3 && hashFinalArr.length <= 5
        && !LABELS_INTERNAS_TRAB.test(revelTexto)
        && !LABELS_INTERNAS_TRAB.test(ctaTexto);
      if (!trabajandoOk) {
        console.error('[Trabajando] 🚫 VALIDACIÓN FALLIDA — publicación cancelada');
        console.error('[Trabajando] gancho:', gancho, '| revelChars:', revelTexto.length, '| ctaChars:', ctaTexto.length, '| hashtags:', hashFinalArr.length);
        return;
      }
      console.log('[Trabajando] PILAR:', pilarTrabajando, '| GANCHO:', gancho);
      coverBuffer = await generarCoverTrabajando(pageConfig.branding, gancho);
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
    form.append('caption', (esTrabajando || esFancy) ? captionTexto : captionTexto + '\n\n' + pageConfig.hashtags);
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

  // TEST FANCY — dispara publicarCoverParaPagina SOLO para Fancy by Roxette

  if (req.method === 'GET' && req.url === '/test-fancy') {
    const fancyPage = PAGES_EXTRA.find(p => p.tipo === 'fancy');
    if (!fancyPage) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Fancy page config no encontrada' }));
      return;
    }
    if (!fancyPage.token) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'FANCY_BY_TOKEN no configurado en Railway' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ mensaje: 'Publicando en Fancy by Roxette — ver logs Railway', pagina: fancyPage.nombre }));
    (async () => {
      console.log('[TEST FANCY] ── INICIO ──────────────────────────────');
      try {
        await publicarCoverParaPagina(fancyPage, 'Editorial Fancy');
        console.log('[TEST FANCY] ── FIN OK ──────────────────────────────');
      } catch(e) {
        console.error('[TEST FANCY] ERROR:', e.message);
        console.log('[TEST FANCY] ── FIN CON ERROR ──────────────────────');
      }
    })();
    return;
  }

  // ── FANCY VISUAL ENGINE V2 — TEST AISLADO ──────────────────────────────────
  // Devuelve image/png directamente al navegador.
  // NO publica · NO llama Commerce Engine · NO modifica FANCY_STATE · NO scheduler.
  if (req.method === 'GET' && req.url === '/test-fancy-visual-v2') {
    console.log('[ FancyV2 ] ── TEST INICIO ───────────────────────────────');
    const fancyPage    = PAGES_EXTRA.find(p => p.tipo === 'fancy');
    const testBranding = fancyPage ? fancyPage.branding : {
      nombreMarca:    'FANCY BY ROXETTE',
      subtituloMarca: 'BOUTIQUE · DALLAS TX',
      footerLinea1:   'Fancy by Roxette  ·  Dallas, TX',
      footerLinea2:   '@FancyByRoxette'
    };
    let imagenBuffer = null;
    try {
      const imgUrl = await getImagenCategoria('MODA', 'fashion woman full body handbag copy space right');
      if (imgUrl) {
        imagenBuffer = await descargarImagen(imgUrl);
        console.log('[ FancyV2 ] Imagen Pexels obtenida OK');
      } else {
        console.log('[ FancyV2 ] Pexels image unavailable — rendering fallback');
      }
    } catch (e) {
      console.log('[ FancyV2 ] Pexels image unavailable — rendering fallback');
    }
    try {
      const coverBuffer = await generarCoverFancyV2({
        branding:    testBranding,
        visualLabel: 'STYLE IT',
        titular:     'EL BOLSO QUE ELEVA TU LOOK',
        microtexto:  'Un detalle. Todo cambia.',
        imagenBuffer,
        layout:      'LIFESTYLE_HERO'
      });
      console.log('[ FancyV2 ] ── TEST OK ───────────────────────────────');
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(coverBuffer);
    } catch (e) {
      console.error('[ FancyV2 ] ERROR:', e.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (req.method === 'GET' && req.url === '/test-fancy-ai-scene') {
    try {
      console.log('[ FancyAI ] /test-fancy-ai-scene iniciado');

      const escenaBuffer = await generarEscenaFancyAI({
        category:      'fashion / handbags / accessories',
        visualFamily:  'STYLE_LIFESTYLE',
        editorialType: 'STYLE_IT',
        intention:     'style transformation / discovery',
        searchTerm:    'structured handbag for everyday outfits',
        recentVisuals: []
      });

      if (!escenaBuffer) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'GPT-Image no disponible. Revisar logs.' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(escenaBuffer);

    } catch (err) {
      console.log('[ FancyAI ] Error en /test-fancy-ai-scene:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }



  // TEST AMAZON FANCY — SOLO LOGS, NO PUBLICA NADA
  if (req.method === 'GET' && req.url === '/test-amazon-fancy') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ mensaje: 'Consultando Amazon Creators API — ver logs Railway para resultado' }));
    (async () => {
      console.log('[AmazonFancy] ── INICIO PRUEBA ─────────────────────');
      console.log('[AmazonFancy] searchTerm: "women elegant midi dress"');
      const producto = await getAmazonProductFancy('women elegant midi dress');
      if (!producto) {
        console.error('[AmazonFancy] RESULTADO: null — sin producto válido');
        return;
      }
      // Log seguro — sin credenciales, sin tokens, sin secrets
      console.log('[AmazonFancy] ✅ OK');
      console.log('[AmazonFancy] ASIN:', producto.asin);
      console.log('[AmazonFancy] Title:', producto.title);
      console.log('[AmazonFancy] Price:', producto.price || '(no disponible)');
      console.log('[AmazonFancy] Image available:', !!producto.image);
      console.log('[AmazonFancy] Detail URL available:', !!producto.detailPageURL);
      console.log('[AmazonFancy] ── FIN PRUEBA ──────────────────────');
    })();
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
// ── AUTO-PUBLICADOR PASARELA STUDIO — misma hora que páginas extra ──────────
async function fetchBuf(url) {
  return descargarImagen(url);
}

async function publicarFotoBuffer(buffer, caption) {
  if (!FB_PAGE_TOKEN || !buffer) { console.log('[FB Buffer] Token o buffer faltante'); return null; }
  const FormData = require('form-data');
  const form = new FormData();
  form.append('caption', caption || '');
  form.append('access_token', FB_PAGE_TOKEN);
  form.append('source', buffer, { filename: 'cover.png', contentType: 'image/png' });
  return new Promise((resolve, reject) => {
    const req = require('https').request({
      hostname: 'graph.facebook.com',
      path: '/v19.0/' + FB_PAGE_ID + '/photos',
      method: 'POST',
      headers: form.getHeaders(),
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(d);
          if (res.statusCode !== 200 || json.error) {
            console.error('[Pasarela FB] ERROR HTTP', res.statusCode, ':', JSON.stringify(json.error || json));
            reject(new Error(json.error ? json.error.message : 'HTTP ' + res.statusCode));
          } else {
            console.log('[Pasarela FB] ✅ PUBLICADO:', json.id);
            resolve(json);
          }
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    form.pipe(req);
  });
}

async function autoPublicarPasarela() {
  if (!FB_PAGE_TOKEN) { console.log('[AutoPublish-Pasarela] Sin FB_PAGE_TOKEN — omitiendo'); return; }
  console.log('[AutoPublish-Pasarela] Iniciando publicación editorial...');
  try {
    // 1. Tomar noticia del cache RSS (con imagen preferida)
    const pool_noticias = cacheNoticias.length > 0 ? cacheNoticias : [];
    if (pool_noticias.length === 0) { console.log('[AutoPublish-Pasarela] Cache RSS vacío — omitiendo'); return; }
    // Filtro línea editorial Pasarela: solo moda, belleza, modelaje, tendencias
    const _KW_MODA = ['moda','fashion','style','estilo','belleza','beauty','model','modelo','runway','pasarela','tendencia','trend','look','outfit','ropa','clothing','lujo','luxury','elegancia','elegance','vogue','couture','diseño','design','temporada','season','coleccion','collection','latina','latin','vestido','dress','zapato','shoe','accesorio','accessory','makeup','maquillaje'];
    const _noticiasFiltradas = pool_noticias.filter(n => {
      const txt = (n.titulo + ' ' + (n.descripcion || '')).toLowerCase();
      return _KW_MODA.some(kw => txt.includes(kw));
    });
    const _poolFinal = _noticiasFiltradas.length > 0 ? _noticiasFiltradas : pool_noticias;
    const conImagen = _poolFinal.filter(n => n.imagen && n.imagen.startsWith('http'));
    const noticia = conImagen.length > 0
      ? conImagen[Math.floor(Math.random() * conImagen.length)]
      : _poolFinal[Math.floor(Math.random() * _poolFinal.length)];

    // 2. Generar artículo editorial con Claude — incluye TITULAR en español para el cover
    const promptEditorial = 'Escribe un artículo editorial sobre este tema de moda/estilo: ' + noticia.titulo + '. Para PASARELA STUDIO INTERNACIONAL, escuela de modelaje y elegancia latina en Dallas, TX. Voz sofisticada, empoderada, latina. 280-350 palabras. NUNCA cites fuentes externas.\n\nFormato EXACTO de respuesta:\nTITULAR: [título editorial en ESPAÑOL, máx 8 palabras, impactante]\n\n[artículo completo en español]';
    const payload = JSON.stringify({
      model: 'claude-sonnet-4-6', max_tokens: 900,
      system: 'Eres la editora de PASARELA STUDIO INTERNACIONAL™, escuela de modelaje y elegancia latina de Dallas, TX. Voz sofisticada, empoderada, latina. NUNCA cites fuentes. Primera persona editorial.',
      messages: [{ role: 'user', content: promptEditorial }]
    });
    const contenido = await new Promise((resolve, reject) => {
      const opts = { hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(payload) } };
      const r = https.request(opts, res => { let d = ''; res.on('data', c => { d += c; }); res.on('end', () => { try { resolve(JSON.parse(d).content?.[0]?.text || ''); } catch(e) { reject(e); } }); });
      r.on('error', reject); r.write(payload); r.end();
    });
    if (!contenido) throw new Error('Claude sin respuesta');

    // 3. Guardar en DB — contenido limpio (sin markers de Claude)
    const _contenidoLimpio = contenido
      .split('\n')
      .map(p => p.replace(/^TITULAR:\s*/i, '').replace(/^#+\s*/, '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/^[-_]{3,}$/, '').trim())
      .filter(p => p.length > 0)
      .join('\n\n');
    const slug = generarSlug(noticia.titulo);
    await pool.query('INSERT INTO noticias (titulo, contenido, tono, slug, publicado, imagen) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING',
      [noticia.titulo, _contenidoLimpio, 'editorial', slug, true, noticia.imagen || '']);

    // 4. Generar cover con plantilla aprobada
    const urlBlog = 'https://pasarelastudiointer.com/noticias/' + slug;
    const fechaStr = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    let coverBuffer = null;
    // Diseño magazine editorial — descarga buffer y usa generarCoverBlogArticulo
    let _imgBuf = null;
    if (noticia.imagen) {
      try { _imgBuf = await fetchBuf(noticia.imagen); } catch(e) {
        console.log('[AutoPublish-Pasarela] Imagen RSS no descargable, usando Pexels:', e.message);
      }
    }
    if (!_imgBuf) {
      try {
        const _imgUrl = await getImagenCategoria('MODA', noticia.titulo.split(' ').slice(0,5).join(' '));
        _imgBuf = await fetchBuf(_imgUrl);
      } catch(e) { console.error('[AutoPublish-Pasarela] Pexels fallback error:', e.message); }
    }
    // Extraer titular en español generado por Claude
    // Cover usa el título del blog (mismo que el H1 del post)
    coverBuffer = await generarCoverPasarelaMaster({ imageBuf: _imgBuf, titulo: noticia.titulo, fecha: fechaStr });

    // 5. Caption = mismo contenido limpio que va al blog
    const caption = _contenidoLimpio + '\n\nLeer más → ' + urlBlog + '\n\n#PasarelaStudio #ModaLatina #DallasFashion';
    const fbRes = await publicarFotoBuffer(coverBuffer, caption);
    console.log('[AutoPublish-Pasarela] ✅ Publicado:', noticia.titulo, '| FB ID:', fbRes?.id || fbRes);
    return { ok: true, titulo: noticia.titulo, facebook_id: fbRes?.id || null, error: null };
  } catch(e) {
    console.error('[AutoPublish-Pasarela] Error:', e.message);
    return { ok: false, titulo: null, facebook_id: null, error: e.message };
  }
}

// ── SCHEDULER HORARIO FIJO: 9am, 3pm, 9pm (Dallas Central Time) ──────────────
const HORAS_PUBLICACION = [9, 15, 21]; // hora en Central Time
let _ultimaHoraPublicada = -1;

function horaActualCentral() {
  // UTC-5 (CDT verano) / UTC-6 (CST invierno) — Railway corre en UTC
  const ahora = new Date();
  const utcH = ahora.getUTCHours();
  const mes = ahora.getUTCMonth(); // 0=ene, 11=dic
  // CDT (UTC-5): mar 2do dom → nov 1er dom; resto CST (UTC-6)
  const esCDT = mes >= 2 && mes <= 10;
  const offset = esCDT ? -5 : -6;
  return ((utcH + offset) + 24) % 24;
}

setInterval(async () => {
  const hora = horaActualCentral();
  const min  = new Date().getUTCMinutes();
  if (HORAS_PUBLICACION.includes(hora) && min < 10 && hora !== _ultimaHoraPublicada) {
    _ultimaHoraPublicada = hora;
    console.log(`[AutoPublish] ⏰ Hora programada: ${hora}:00 Central — iniciando ciclo`);
    await autoPublicarPasarela();
    await new Promise(r => setTimeout(r, 15000)); // 15s entre Pasarela y páginas extra
    await autoPublicarPaginasExtra();
  }
}, 60 * 1000); // revisa cada minuto

console.log('[AutoPublish] Scheduler activado — publica a las 9am, 3pm y 9pm (Dallas Central Time)');

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[Servidor] Corriendo en puerto ${PORT}`);
});
