/**
 * ThinkingEngine.js — v3 COMBINED
 * PASARELA Editorial Intelligence™
 * 
 * HeroDetector incluido en el mismo archivo.
 * Sin dependencias externas. Un solo archivo.
 */

// ═══════════════════════════════════════════════════════
// HERO DETECTOR (embebido)
// ═══════════════════════════════════════════════════════

const INTENT_HEROES = {
  inauguración: { text: 'INAUGURACIÓN', score: 95 },
  apertura:     { text: 'GRAN APERTURA', score: 93 },
  lanzamiento:  { text: 'LANZAMIENTO',  score: 78 },
  debut:        { text: 'DEBUT',        score: 88 },
  presentación: { text: 'PRESENTACIÓN', score: 75 },
  celebración:  { text: 'CELEBRACIÓN',  score: 85 },
  graduación:   { text: 'GRADUACIÓN',   score: 95 },
  aniversario:  { text: 'ANIVERSARIO',  score: 84 },
  premio:       { text: 'TRIUNFO',      score: 87 },
  alerta:       { text: 'ALERTA',       score: 96 },
  emergencia:   { text: 'ALERTA',       score: 98 },
  revolución:   { text: 'REVOLUCIÓN',   score: 94 },
  exclusiva:    { text: 'EXCLUSIVA',    score: 91 },
};

const INTENT_TRIGGER_WORDS = {
  inauguración: ['inaugura', 'inauguramos', 'inauguración'],
  apertura:     ['abre sus puertas', 'abrimos', 'apertura', 'abrió', 'nuevo restaurante', 'nuevo café', 'nueva tienda', 'gran apertura'],
  lanzamiento:  ['lanzamos', 'lanzamiento', 'lanzó'],
  debut:        ['debut', 'debuta', 'primera vez', 'estrena'],
  presentación: ['presentación', 'muestra', 'exhibe'],
  celebración:  ['celebra', 'celebramos', 'festeja', 'fiesta'],
  graduación:   ['graduación', 'graduamos', 'se gradúa', 'graduados', 'graduacion', 'promoci'],
  aniversario:  ['aniversario', 'años de', 'cumpleaños'],
  premio:       ['premio', 'ganó', 'ganamos', 'gana', 'triunfo', 'campeón'],
  alerta:       ['huracán', 'terremoto', 'alerta', 'emergencia', 'catástrofe', 'tormenta'],
  revolución:   ['transforma', 'revoluciona', 'cambia todo', 'futuro de'],
  exclusiva:    ['exclusiva', 'primicia', 'detrás de', 'íntimo con'],
};

const PRESENTA_SOFT_TRIGGERS = ['presenta', 'presentamos', 'presenta la'];

const CATEGORY_FALLBACK_HEROES = {
  MODA:'ESTILO', BELLEZA:'BELLEZA', TALENTO:'TALENTO',
  EVENTOS:'EVENTO', LIFESTYLE:'LIFESTYLE', EXCLUSIVAS:'EXCLUSIVA',
};

const HIGH_IMPACT_NAMES = [
  'shakira','beyoncé','beyonce','jennifer lopez','j.lo','rihanna',
  'bad bunny','maluma','j balvin','karol g','rosalía','rosalia',
  'zendaya','gabriela hearst','valentino','balenciaga','givenchy',
];

const FASHION_BRANDS    = ['dior','chanel','gucci','prada','versace','zara','balenciaga','valentino','givenchy','louis vuitton','hermes','hermès'];
const TECH_SIGNALS      = ['ia', 'inteligencia artificial', 'robot', 'ai ', ' ai,', 'app', 'tecnología', 'innovación', 'digital', 'metaverso', 'automatización'];
const FINANCE_SIGNALS   = ['bolsa', 'mercado', 'inversión', 'acciones', 'bitcoin', 'cripto', 'economía', 'finanzas', 'banco'];
const EDUCATION_SIGNALS = ['academia', 'escuela', 'universidad', 'curso', 'taller', 'aprendizaje', 'educación', 'formación'];

function resolveLayout(text) {
  const words = text.trim().split(/\s+/).length;
  if (words === 1) return 'gigante';
  if (words === 2) return 'dos-lineas';
  if (words === 3) return 'tres-lineas';
  return 'compacto';
}

function extractProduct(idea) {
  const words = idea.split(/\s+/);
  const products = [];
  const GENERIC = new Set(['LA','EL','LOS','LAS','UN','UNA','DE','DEL','EN','Y','CON','POR']);
  for (let i = 0; i < words.length; i++) {
    const w = words[i].replace(/[.,!?]/g, '');
    if (i === 0) continue;
    if (/^[A-ZÁÉÍÓÚ][a-záéíóú]+/.test(w) && w.length > 2 && !GENERIC.has(w.toUpperCase())) {
      if (i + 1 < words.length) {
        const next = words[i + 1].replace(/[.,!?]/g, '');
        if (/^[A-ZÁÉÍÓÚ]/.test(next) && next.length > 1) {
          products.push({ text: `${w} ${next}`.toUpperCase(), score: 89 });
        }
      }
      products.push({ text: w.toUpperCase(), score: 86 });
    }
  }
  return products;
}

function detectHero(idea, category) {
  const text = idea.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const candidates = [];
  let hasHighImpactName = false;
  let hasProduct = false;

  for (const name of HIGH_IMPACT_NAMES) {
    if (text.includes(name.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
      const formatted = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('\n').toUpperCase();
      candidates.push({ text: formatted, score: 92, reason: `Personalidad: ${name}`, rule: 2 });
      hasHighImpactName = true;
      break;
    }
  }

  const products = extractProduct(idea);
  if (products.length > 0 && !hasHighImpactName) {
    candidates.push({ text: products[0].text, score: 89, reason: `Producto: ${products[0].text}`, rule: 3 });
    hasProduct = true;
  }

  for (const [intent, triggers] of Object.entries(INTENT_TRIGGER_WORDS)) {
    if (triggers.some(t => text.includes(t))) {
      const hero = INTENT_HEROES[intent];
      if (hero) candidates.push({ text: hero.text, score: hero.score, reason: `Intent: ${intent}`, rule: 1 });
    }
  }

  if (PRESENTA_SOFT_TRIGGERS.some(t => text.includes(t)) && !hasHighImpactName && !hasProduct) {
    candidates.push({ text: 'LANZAMIENTO', score: 78, reason: 'Intent suave: presenta', rule: 1 });
  }

  if (TECH_SIGNALS.some(s => text.includes(s))) {
    candidates.push({ text: 'REVOLUCIÓN', score: 85, reason: 'Señal tecnológica', rule: 3 });
  }

  if (category === 'MODA') {
    for (const brand of FASHION_BRANDS) {
      if (text.includes(brand)) {
        candidates.push({ text: brand.toUpperCase(), score: 89, reason: `Marca moda: ${brand}`, rule: 6 });
        break;
      }
    }
  }

  if (EDUCATION_SIGNALS.some(s => text.includes(s))) candidates.push({ text: 'FUTURO', score: 80, reason: 'Educación', rule: 7 });
  if (FINANCE_SIGNALS.some(s => text.includes(s)))   candidates.push({ text: 'INVERSIÓN', score: 84, reason: 'Finanzas', rule: 8 });

  candidates.push({ text: CATEGORY_FALLBACK_HEROES[category] || 'EXCLUSIVA', score: 60, reason: `Fallback: ${category}`, rule: 0 });
  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0];

  return {
    hero: { text: winner.text, reason: winner.reason, priority: winner.score, layout: resolveLayout(winner.text), rule: winner.rule },
    heroCandidates: candidates.map(c => ({ text: c.text, score: c.score })),
  };
}

// ═══════════════════════════════════════════════════════
// THINKING ENGINE
// ═══════════════════════════════════════════════════════

const CATEGORY_SIGNALS = {
  MODA:       ['moda','fashion','ropa','outfit','look','tendencia','colección','diseñador','pasarela','estilo','vestido','temporada','prenda','marca','lujo','zapatilla','bolso','accesorio'],
  BELLEZA:    ['belleza','maquillaje','skincare','piel','cabello','tratamiento','cosmético','perfume','rutina','labial','cuidado','spa','facial','serum','glam'],
  TALENTO:    ['modelo','modelaje','casting','agencia','talento','carrera','editorial','shooting','fotografía','artista','actor','cantante','influencer','creador','academia'],
  EVENTOS:    ['evento','inauguración','lanzamiento','desfile','gala','premios','alfombra','fiesta','celebración','apertura','debut','presentación','festival','show'],
  LIFESTYLE:  ['café','restaurante','viaje','fitness','bienestar','salud','yoga','meditación','hogar','decoración','gastronomía','experiencia','wellness','brunch'],
  EXCLUSIVAS: ['exclusiva','primicia','secreto','detrás','entrevista','especial','íntimo','confidencial','revelación','historia'],
};

const EMOTION_MAP        = { MODA:'aspiración', BELLEZA:'confianza', TALENTO:'inspiración', EVENTOS:'celebración', LIFESTYLE:'bienestar', EXCLUSIVAS:'intriga' };
const EDITORIAL_STYLE_MAP = { MODA:'high fashion editorial — Vogue, minimal luxury', BELLEZA:'beauty editorial — íntimo, luminoso, sensorial', TALENTO:'portrait editorial — poderoso, auténtico, aspiracional', EVENTOS:'event editorial — dinámico, celebratorio, social', LIFESTYLE:'lifestyle editorial — cálido, cotidiano, sofisticado', EXCLUSIVAS:'cover story — dramático, exclusivo, cinematográfico' };
const VISUAL_DIRECTION_MAP = { MODA:'fondo neutro o arquitectónico, iluminación directa', BELLEZA:'primer plano, piel iluminada, fondo oscuro', TALENTO:'retrato ambiental, mirada directa a cámara', EVENTOS:'espacio amplio, ambiente festivo', LIFESTYLE:'escena cotidiana estilizada, paleta cálida', EXCLUSIVAS:'composición cinematográfica, alto contraste' };
const AUDIENCE_SIGNALS   = { profesional:['academia','agencia','casting','carrera','modelo','industria','negocio'], aspiracional:['lujo','exclusiva','gala','alfombra','premio','desfile'], comunidad:['dallas','carrollton','texas','latina','hispana','comunidad','local'], general:[] };
const INTENT_SIGNALS     = { anuncio:['inauguramos','abrimos','lanzamos','presentamos','anunciamos','debut','apertura','nuevo','nueva'], celebración:['celebramos','cumpleaños','aniversario','ganamos','logramos','éxito'], inspiración:['tips','cómo','aprende','guía','secreto','transforma','mejora'], cobertura:['estuvo','fue','asistió','participó','desfiló','se presentó'] };

class ThinkingEngine {
  understandIdea(idea) {
    const text = idea.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const STOPWORDS = new Set(['el','la','los','las','un','una','de','del','en','y','a','que','se','es','hoy','con','por','para','al']);
    const topic = idea.split(/\s+/).filter(w => !STOPWORDS.has(w.toLowerCase())).slice(0, 6).join(' ');
    let intent = 'editorial';
    for (const [key, signals] of Object.entries(INTENT_SIGNALS)) {
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
    const text = idea.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const scores = {};
    for (const [cat, signals] of Object.entries(CATEGORY_SIGNALS)) {
      scores[cat] = signals.filter(s => text.includes(s)).length;
    }
    const category = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
    const finalCategory = scores[category] === 0 ? 'EXCLUSIVAS' : category;
    return {
      category: finalCategory,
      emotion: EMOTION_MAP[finalCategory],
      editorialStyle: EDITORIAL_STYLE_MAP[finalCategory],
      visualDirection: VISUAL_DIRECTION_MAP[finalCategory],
    };
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