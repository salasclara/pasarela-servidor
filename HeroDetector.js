/**
 * HeroDetector.js
 * PASARELA Editorial Intelligence™ — TASK-TH-003
 * Hero Detector™ v1.1 — post-test fixes
 */

// ── INTENT HEROES ─────────────────────────────────────────────────────────────
const INTENT_HEROES = {
  inauguración: { text: 'INAUGURACIÓN', score: 95 },
  apertura:     { text: 'GRAN APERTURA', score: 93 },
  lanzamiento:  { text: 'LANZAMIENTO',  score: 78 }, // bajado para que producto específico gane
  debut:        { text: 'DEBUT',        score: 88 },
  presentación: { text: 'PRESENTACIÓN', score: 75 }, // bajado para que persona/producto gane
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

// "presenta" como trigger solo si NO hay nombre propio conocido ni producto capitalizado
const PRESENTA_SOFT_TRIGGERS = ['presenta', 'presentamos', 'presenta la'];

const CATEGORY_FALLBACK_HEROES = {
  MODA:       'ESTILO',
  BELLEZA:    'BELLEZA',
  TALENTO:    'TALENTO',
  EVENTOS:    'EVENTO',
  LIFESTYLE:  'LIFESTYLE',
  EXCLUSIVAS: 'EXCLUSIVA',
};

const EMOTION_MAP = { MODA:'aspiración', BELLEZA:'confianza', TALENTO:'inspiración', EVENTOS:'celebración', LIFESTYLE:'bienestar', EXCLUSIVAS:'intriga' };

const HIGH_IMPACT_NAMES = [
  'shakira','beyoncé','beyonce','jennifer lopez','j.lo','rihanna',
  'bad bunny','maluma','j balvin','karol g','rosalía','rosalia',
  'zendaya','gabriela hearst','valentino','balenciaga','givenchy',
];

const FASHION_BRANDS = ['dior','chanel','gucci','prada','versace','zara','balenciaga','valentino','givenchy','louis vuitton','hermes','hermès'];
const TECH_SIGNALS   = ['ia', 'inteligencia artificial', 'robot', 'ai ', ' ai,', 'app', 'tecnología', 'innovación', 'digital', 'metaverso', 'automatización'];
const FINANCE_SIGNALS = ['bolsa', 'mercado', 'inversión', 'acciones', 'bitcoin', 'cripto', 'economía', 'finanzas', 'banco'];
const EDUCATION_SIGNALS = ['academia', 'escuela', 'universidad', 'curso', 'taller', 'aprendizaje', 'educación', 'formación'];

function resolveLayout(text) {
  const words = text.trim().split(/\s+/).length;
  if (words === 1) return 'gigante';
  if (words === 2) return 'dos-lineas';
  if (words === 3) return 'tres-lineas';
  return 'compacto';
}

// Extrae productos capitalizados de la idea (ej: "Robotaxi", "Vision Pro")
function extractProduct(idea) {
  // Busca palabras o pares de palabras capitalizadas que no sean inicio de oración
  const words = idea.split(/\s+/);
  const products = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i].replace(/[.,!?]/g, '');
    // Ignorar primera palabra (inicio de oración) y artículos
    if (i === 0) continue;
    if (/^[A-ZÁÉÍÓÚ][a-záéíóú]+/.test(w) && w.length > 2) {
      // Intentar capturar dos palabras capitalizadas consecutivas
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

class HeroDetector {

  detectHero(idea, category = 'EXCLUSIVAS') {
    const text = idea.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const candidates = [];
    let hasHighImpactName = false;
    let hasProduct = false;

    // ── REGLA 2: Personalidad reconocida (score alto — gana sobre "presenta") ──
    for (const name of HIGH_IMPACT_NAMES) {
      if (text.includes(name.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
        const formatted = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('\n').toUpperCase();
        candidates.push({ text: formatted, score: 92, reason: `Personalidad de alto impacto: ${name}`, rule: 2 });
        hasHighImpactName = true;
        break;
      }
    }

    // ── REGLA 3: Producto capitalizado específico ─────────────────────────────
    const products = extractProduct(idea);
    if (products.length > 0 && !hasHighImpactName) {
      const best = products[0];
      // Solo agregar si no es una palabra genérica
      const GENERIC = new Set(['LA','EL','LOS','LAS','UN','UNA','DE','DEL','EN','Y','CON','POR']);
      if (!GENERIC.has(best.text)) {
        candidates.push({ text: best.text, score: 89, reason: `Producto/modelo específico detectado: ${best.text}`, rule: 3 });
        hasProduct = true;
      }
    }

    // ── REGLA 1, 4, 5: Intent triggers ───────────────────────────────────────
    for (const [intent, triggers] of Object.entries(INTENT_TRIGGER_WORDS)) {
      if (triggers.some(t => text.includes(t))) {
        const hero = INTENT_HEROES[intent];
        if (hero) {
          candidates.push({ text: hero.text, score: hero.score, reason: `Intent detectado: ${intent}`, rule: intent === 'alerta' || intent === 'emergencia' ? 4 : 1 });
        }
      }
    }

    // "presenta" como intent suave — solo si no hay nombre/producto fuerte
    if (PRESENTA_SOFT_TRIGGERS.some(t => text.includes(t)) && !hasHighImpactName && !hasProduct) {
      candidates.push({ text: 'LANZAMIENTO', score: 78, reason: 'Intent suave: presenta (sin persona ni producto conocido)', rule: 1 });
    }

    // ── REGLA 3: Tech — revolución como concepto ──────────────────────────────
    if (TECH_SIGNALS.some(s => text.includes(s))) {
      candidates.push({ text: 'REVOLUCIÓN', score: 85, reason: 'Señal tecnológica — el acontecimiento supera a la marca', rule: 3 });
    }

    // ── REGLA 6: Moda — marca ─────────────────────────────────────────────────
    if (category === 'MODA') {
      for (const brand of FASHION_BRANDS) {
        if (text.includes(brand)) {
          candidates.push({ text: brand.toUpperCase(), score: 89, reason: `Marca de moda: ${brand}`, rule: 6 });
          break;
        }
      }
    }

    // ── REGLA 7: Educación ────────────────────────────────────────────────────
    if (EDUCATION_SIGNALS.some(s => text.includes(s))) {
      candidates.push({ text: 'FUTURO', score: 80, reason: 'Contexto educativo', rule: 7 });
    }

    // ── REGLA 8: Finanzas ─────────────────────────────────────────────────────
    if (FINANCE_SIGNALS.some(s => text.includes(s))) {
      candidates.push({ text: 'INVERSIÓN', score: 84, reason: 'Contexto financiero', rule: 8 });
    }

    // ── FALLBACK ──────────────────────────────────────────────────────────────
    candidates.push({ text: CATEGORY_FALLBACK_HEROES[category] || 'EXCLUSIVA', score: 60, reason: `Fallback por categoría: ${category}`, rule: 0 });

    // ── SELECCIÓN ─────────────────────────────────────────────────────────────
    candidates.sort((a, b) => b.score - a.score);
    const winner = candidates[0];

    return {
      hero: {
        text:     winner.text,
        reason:   winner.reason,
        priority: winner.score,
        layout:   resolveLayout(winner.text),
        rule:     winner.rule,
      },
      heroCandidates: candidates.map(c => ({ text: c.text, score: c.score })),
    };
  }
}

module.exports = { HeroDetector };