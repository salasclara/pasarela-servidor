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
  connectionString: process.env.PASARELA_PG, || 'postgresql://postgres:OdKnMEAUvdaRgvUCWeESUNbJrSIhEMeS@postgres.railway.internal:5432/railway',
  ssl: false,
});

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

const server = http.createServer((req, res) => {
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

  // POST /claude — generar relato editorial fashion
  if (req.method === 'POST' && req.url === '/claude') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let prompt = '';
      try { prompt = JSON.parse(body).prompt; }
      catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: 'JSON invalido' })); return; }

      const payload = JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
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
        const { titulo, contenido, tono } = JSON.parse(body);
        if (!titulo || !contenido) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'titulo y contenido son requeridos' }));
          return;
        }
        const slug = generarSlug(titulo);
        const result = await pool.query(
          'INSERT INTO noticias (titulo, contenido, tono, slug, publicado) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [titulo, contenido, tono || 'editorial', slug, true]
        );
        const post = result.rows[0];
        const url = `https://pasarelastudiointer.com/noticias/${slug}`;
        console.log(`✓ Publicado: ${titulo} → ${url}`);
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

  res.writeHead(404);
  res.end();
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Servidor Pasarela Studio corriendo en http://0.0.0.0:3000');
});
