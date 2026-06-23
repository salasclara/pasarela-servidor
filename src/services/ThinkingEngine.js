/**
 * ThinkingEngine.js — FINAL
 * PASARELA Editorial Intelligence™
 * HeroDetector v2.0 embebido — jerarquía concept/product/person/brand/event
 */

// ═══════════════════════════════════════════════════════════════════════════════
// HERO DETECTOR v2.0 (embebido)
// ═══════════════════════════════════════════════════════════════════════════════

const CONCEPT_SIGNALS = [
  { signals: ['transforma', 'revoluciona', 'cambia todo', 'redefine', 'reimagina'], hero: 'REVOLUCIÓN', score: 100 },
  { signals: ['futuro de', 'el futuro', 'próxima generación'],                      hero: 'FUTURO',     score: 98  },
  { signals: ['disrupc', 'disruptiv'],                                               hero: 'DISRUPCIÓN', score: 97  },
  { signals: ['huracán', 'terremoto', 'catástrofe', 'emergencia', 'alerta'],        hero: 'ALERTA',     score: 100 },
  { signals: ['innovac'],                                                            hero: 'INNOVACIÓN', score: 95  },
  { signals: ['crisis'],                                                             hero: 'CRISIS',     score: 96  },
];

const KNOWN_PRODUCTS = [
  { pattern: /robotaxi/i,              text: 'ROBOTAXI',                                       score: 94 },
  { pattern: /vision\s*pro\s*(\d+)?/i, text: (m) => `VISION PRO${m[1] ? ' ' + m[1] : ''}`,   score: 93 },
  { pattern: /gpt-?(\d+)/i,           text: (m) => `GPT-${m[1]}`,                             score: 93 },
  { pattern: /starlink/i,              text: 'STARLINK',                                       score: 91 },
  { pattern: /iphone\s*(\d+)?/i,      text: (m) => `IPHONE${m[1] ? ' ' + m[1] : ''}`,        score: 91 },
  { pattern: /airpods?/i,              text: 'AIRPODS',                                        score: 90 },
  { pattern: /cybertruck/i,            text: 'CYBERTRUCK',                                     score: 92 },
  { pattern: /neuralink/i,             text: 'NEURALINK',                                      score: 92 },
  { pattern: /gemini/i,                text: 'GEMINI',                                         score: 90 },
  { pattern: /chatgpt/i,               text: 'CHATGPT',                                        score: 90 },
  { pattern: /dall-?e/i,               text: 'DALL-E',                                         score: 89 },
  { pattern: /sora/i,                  text: 'SORA',                                           score: 89 },
];

const HIGH_IMPACT_NAMES = [
  'gabriela hearst','shakira','beyoncé','beyonce','jennifer lopez',
  'rihanna','bad bunny','maluma','j balvin','karol g','rosalía','rosalia',
  'zendaya','elon musk','taylor swift','madonna','kim kardashian',
];

const BRAND_SIGNALS = [
  { name: 'tesla', score: 74 }, { name: 'apple', score: 74 }, { name: 'openai', score: 74 },
  { name: 'meta', score: 72 },  { name: 'google', score: 72 },{ name: 'microsoft', score: 72 },
  { name: 'amazon', score: 71 },{ name: 'samsung', score: 70 },{ name: 'netflix', score: 71 },
  { name: 'dior', score: 73 },  { name: 'chanel', score: 73 },{ name: 'gucci', score: 73 },
  { name: 'prada', score: 72 }, { name: 'versace', score: 72 },{ name: 'balenciaga', score: 72 },
  { name: 'zara', score: 70 },  { name: 'louis vuitton', score: 73 },
];

const INTENT_HEROES = {
  inauguración: { text: 'INAUGURACIÓN',  score: 88 },
  apertura:     { text: 'GRAN APERTURA', score: 86 },
  lanzamiento:  { text: 'LANZAMIENTO',   score: 75 },
  debut:        { text: 'DEBUT',         score: 82 },
  celebración:  { text: 'CELEBRACIÓN',   score: 80 },
  graduación:   { text: 'GRADUACIÓN',    score: 88 },
  aniversario:  { text: 'ANIVERSARIO',   score: 78 },
  premio:       { text: 'TRIUNFO',       score: 82 },
  exclusiva:    { text: 'EXCLUSIVA',     score: 85 },
};

const INTENT_TRIGGER_WORDS = {
  inauguración: ['inaugura', 'inauguramos', 'inauguración'],
  apertura:     ['abre sus puertas', 'abrimos', 'apertura', 'abrió', 'nuevo restaurante', 'nuevo café', 'nueva tienda', 'gran apertura'],
  lanzamiento:  ['lanzamos', 'lanzamiento', 'lanzó'],
  debut:        ['debut', 'debuta', 'primera vez', 'estrena'],
  celebración:  ['celebra', 'celebramos', 'festeja', 'fiesta'],
  graduación:   ['graduación', 'graduamos', 'graduados', 'graduacion', 'promoci'],
  aniversario:  ['aniversario', 'años de', 'cumpleaños'],
  premio:       ['ganó', 'ganamos', 'gana', 'triunfo', 'campeón', 'premio'],
  exclusiva:    ['exclusiva', 'primicia', 'detrás de'],
};

const CATEGORY_FALLBACK = {
  MODA:'ESTILO', BELLEZA:'BELLEZA', TALENTO:'TALENTO',
  EVENTOS:'EVENTO', LIFESTYLE:'LIFESTYLE', EXCLUSIVAS:'EXCLUSIVA',
};

function resolveLayout(text) {
  const words = text.trim().split(/\s+/).length;
  if (words === 1) return 'gigante';
  if (words === 2) return 'dos-lineas';
  if (words === 3) return 'tres-lineas';
  return 'compacto';
}

function norm(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function extractCapitalizedProduct(idea) {
  const GENERIC = new Set(['LA','EL','LOS','LAS','UN','UNA','DE','DEL','EN','Y','CON','POR','QUE','SE','ES','HOY','SU','AL','NO','SI']);
  const words = idea.split(/\s+/);
  const products = [];
  for (let i = 1; i < words.length; i++) {
    const w = words[i].replace(/[.,!?]/g, '');
    if (/^[A-ZÁÉÍÓÚ][a-zA-Z0-9áéíóú\-]+/.test(w) && w.length > 2 && !GENERIC.has(w.toUpperCase())) {
      if (i + 1 < words.length) {
        const next = words[i + 1].replace(/[.,!?]/g, '');
        if (/^[A-ZÁÉÍÓÚ0-9]/.test(next) && next.length > 1 && !GENERIC.has(next.toUpperCase())) {
          products.push({ text: `${w} ${next}`.toUpperCase(), score: 88 });
        }
      }
      products.push({ text: w.toUpperCase(), score: 85 });
    }
  }
  return products;
}

function detectHero(idea, category = 'EXCLUSIVAS') {
  const text = norm(idea);
  const candidates = [];

  // NIVEL 1 — Conceptos
  for (const { signals, hero, score } of CONCEPT_SIGNALS) {
    if (signals.some(s => text.includes(s))) {
      candidates.push({ text: hero, type: 'concept', score, reason: `Concepto: ${hero}` });
    }
  }

  // NIVEL 2a — Productos conocidos
  for (const product of KNOWN_PRODUCTS) {
    const match = idea.match(product.pattern);
    if (match) {
      const heroText = typeof product.text === 'function' ? product.text(match) : product.text;
      candidates.push({ text: heroText, type: 'product', score: product.score, reason: `Producto conocido: ${heroText}` });
    }
  }

  // NIVEL 3 — Personas (evaluado ANTES de productos capitalizados genéricos)
  for (const name of HIGH_IMPACT_NAMES) {
    if (text.includes(norm(name))) {
      const formatted = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('\n').toUpperCase();
      candidates.push({ text: formatted, type: 'person', score: 92, reason: `Persona: ${name}` });
      break;
    }
  }

  // NIVEL 2b — Productos capitalizados genéricos
  const capProducts = extractCapitalizedProduct(idea);
  for (const p of capProducts.slice(0, 2)) {
    candidates.push({ text: p.text, type: 'product', score: p.score, reason: `Producto capitalizado: ${p.text}` });
  }

  // NIVEL 4 — Marcas
  for (const brand of BRAND_SIGNALS) {
    if (text.includes(brand.name)) {
      candidates.push({ text: brand.name.toUpperCase(), type: 'brand', score: brand.score, reason: `Marca: ${brand.name}` });
      break;
    }
  }

  // NIVEL 5 — Eventos / Intent
  for (const [intent, triggers] of Object.entries(INTENT_TRIGGER_WORDS)) {
    if (triggers.some(t => text.includes(t))) {
      const hero = INTENT_HEROES[intent];
      if (hero) candidates.push({ text: hero.text, type: 'event', score: hero.score, reason: `Intent: ${intent}` });
    }
  }

  // NIVEL 6 — Fallback
  candidates.push({ text: CATEGORY_FALLBACK[category] || 'EXCLUSIVA', type: 'fallback', score: 50, reason: `Fallback: ${category}` });

  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0];

  return {
    hero: {
      text: winner.text, type: winner.type, score: winner.score,
      reason: winner.reason, layout: resolveLayout(winner.text),
    },
    heroCandidates: candidates.map(c => ({ text: c.text, type: c.type, score: c.score })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// THINKING ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORY_SIGNALS = {
  MODA:       ['moda','fashion','ropa','outfit','look','tendencia','colección','diseñador','pasarela','estilo','vestido','temporada','prenda','marca','lujo','zapatilla','bolso','accesorio'],
  BELLEZA:    ['belleza','maquillaje','skincare','piel','cabello','tratamiento','cosmético','perfume','rutina','labial','cuidado','spa','facial','serum','glam'],
  TALENTO:    ['modelo','modelaje','casting','agencia','talento','carrera','editorial','shooting','fotografía','artista','actor','cantante','influencer','creador','academia'],
  EVENTOS:    ['evento','inauguración','lanzamiento','desfile','gala','premios','alfombra','fiesta','celebración','apertura','debut','presentación','festival','show'],
  LIFESTYLE:  ['café','restaurante','viaje','fitness','bienestar','salud','yoga','meditación','hogar','decoración','gastronomía','experiencia','wellness','brunch'],
  EXCLUSIVAS: ['exclusiva','primicia','secreto','detrás','entrevista','especial','íntimo','confidencial','revelación','historia'],
};

const EMOTION_MAP         = { MODA:'aspiración', BELLEZA:'confianza', TALENTO:'inspiración', EVENTOS:'celebración', LIFESTYLE:'bienestar', EXCLUSIVAS:'intriga' };
const EDITORIAL_STYLE_MAP = { MODA:'high fashion editorial — Vogue, minimal luxury', BELLEZA:'beauty editorial — íntimo, luminoso, sensorial', TALENTO:'portrait editorial — poderoso, auténtico, aspiracional', EVENTOS:'event editorial — dinámico, celebratorio, social', LIFESTYLE:'lifestyle editorial — cálido, cotidiano, sofisticado', EXCLUSIVAS:'cover story — dramático, exclusivo, cinematográfico' };
const VISUAL_DIRECTION_MAP = { MODA:'fondo neutro o arquitectónico, iluminación directa', BELLEZA:'primer plano, piel iluminada, fondo oscuro', TALENTO:'retrato ambiental, mirada directa a cámara', EVENTOS:'espacio amplio, ambiente festivo', LIFESTYLE:'escena cotidiana estilizada, paleta cálida', EXCLUSIVAS:'composición cinematográfica, alto contraste' };
const AUDIENCE_SIGNALS    = { profesional:['academia','agencia','casting','carrera','modelo','industria','negocio'], aspiracional:['lujo','exclusiva','gala','alfombra','premio','desfile'], comunidad:['dallas','carrollton','texas','latina','hispana','comunidad','local'], general:[] };
const INTENT_SIGNALS_TE   = { anuncio:['inauguramos','abrimos','lanzamos','presentamos','anunciamos','debut','apertura','nuevo','nueva'], celebración:['celebramos','cumpleaños','aniversario','ganamos','logramos','éxito'], inspiración:['tips','cómo','aprende','guía','secreto','transforma','mejora'], cobertura:['estuvo','fue','asistió','participó','desfiló','se presentó'] };

class ThinkingEngine {
  understandIdea(idea) {
    const text = norm(idea);
    const STOPWORDS = new Set(['el','la','los','las','un','una','de','del','en','y','a','que','se','es','hoy','con','por','para','al']);
    const topic = idea.split(/\s+/).filter(w => !STOPWORDS.has(w.toLowerCase())).slice(0, 6).join(' ');
    let intent = 'editorial';
    for (const [key, signals] of Object.entries(INTENT_SIGNALS_TE)) {
      if (signals.some(s => text.includes(s))) { intent = key; break; }
    }
    let audience = 'general';
    for (const [key, signals] of Object.entries(AUDIENCE_SIGNALS)) {
      if (key === 'general') continue;
      if (signals.some(s => text.includes(s))) { audience = key; break; }
    }
    return { topic, intent, audience };
  }

  classifyIdea(idea) {
    const text = norm(idea);
    const scores = {};
    for (const [cat, signals] of Object.entries(CATEGORY_SIGNALS)) {
      scores[cat] = signals.filter(s => text.includes(s)).length;
    }
    const category = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
    const finalCategory = scores[category] === 0 ? 'EXCLUSIVAS' : category;
    return { category: finalCategory, emotion: EMOTION_MAP[finalCategory], editorialStyle: EDITORIAL_STYLE_MAP[finalCategory], visualDirection: VISUAL_DIRECTION_MAP[finalCategory] };
  }

  analyze(idea) {
    if (!idea || typeof idea !== 'string' || !idea.trim()) throw new Error('ThinkingEngine: idea inválida');
    const { topic, intent, audience }                            = this.understandIdea(idea);
    const { category, emotion, editorialStyle, visualDirection } = this.classifyIdea(idea);
    const { hero, heroCandidates }                               = detectHero(idea, category);
    return { originalIdea: idea.trim(), topic, intent, audience, category, emotion, editorialStyle, visualDirection, hero, heroCandidates };
  }
}

module.exports = { ThinkingEngine };