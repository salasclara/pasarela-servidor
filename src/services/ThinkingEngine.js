/**
 * ThinkingEngine.js — v2
 * PASARELA Editorial Intelligence™
 * 
 * REEMPLAZA el ThinkingEngine.js existente en salasclara/pasarela-servidor
 * Agrega detectHero() al flujo de analyze()
 */

const { HeroDetector } = require('./HeroDetector');

const CATEGORY_SIGNALS = {
  MODA:       ['moda', 'fashion', 'ropa', 'outfit', 'look', 'tendencia', 'colección', 'diseñador', 'pasarela', 'estilo', 'vestido', 'temporada', 'prenda', 'marca', 'lujo', 'zapatilla', 'bolso', 'accesorio'],
  BELLEZA:    ['belleza', 'maquillaje', 'skincare', 'piel', 'cabello', 'tratamiento', 'cosmético', 'perfume', 'rutina', 'labial', 'cuidado', 'spa', 'facial', 'serum', 'glam'],
  TALENTO:    ['modelo', 'modelaje', 'casting', 'agencia', 'talento', 'carrera', 'editorial', 'shooting', 'fotografía', 'artista', 'actor', 'cantante', 'influencer', 'creador', 'academia'],
  EVENTOS:    ['evento', 'inauguración', 'lanzamiento', 'desfile', 'gala', 'premios', 'alfombra', 'fiesta', 'celebración', 'apertura', 'debut', 'presentación', 'festival', 'show'],
  LIFESTYLE:  ['café', 'restaurante', 'viaje', 'fitness', 'bienestar', 'salud', 'yoga', 'meditación', 'hogar', 'decoración', 'gastronomía', 'experiencia', 'wellness', 'brunch'],
  EXCLUSIVAS: ['exclusiva', 'primicia', 'secreto', 'detrás', 'entrevista', 'especial', 'íntimo', 'confidencial', 'revelación', 'historia'],
};

const EMOTION_MAP       = { MODA:'aspiración', BELLEZA:'confianza', TALENTO:'inspiración', EVENTOS:'celebración', LIFESTYLE:'bienestar', EXCLUSIVAS:'intriga' };
const EDITORIAL_STYLE_MAP = { MODA:'high fashion editorial — Vogue, minimal luxury', BELLEZA:'beauty editorial — íntimo, luminoso, sensorial', TALENTO:'portrait editorial — poderoso, auténtico, aspiracional', EVENTOS:'event editorial — dinámico, celebratorio, social', LIFESTYLE:'lifestyle editorial — cálido, cotidiano, sofisticado', EXCLUSIVAS:'cover story — dramático, exclusivo, cinematográfico' };
const VISUAL_DIRECTION_MAP = { MODA:'fondo neutro o arquitectónico, iluminación directa, colores saturados o monocromáticos', BELLEZA:'primer plano, piel iluminada, fondo oscuro con bokeh suave', TALENTO:'retrato ambiental, mirada directa a cámara, luz natural o dramática', EVENTOS:'espacio amplio, ambiente festivo, detalles del lugar y las personas', LIFESTYLE:'escena cotidiana estilizada, paleta cálida, composición relajada', EXCLUSIVAS:'composición cinematográfica, alto contraste, atmósfera misteriosa' };
const AUDIENCE_SIGNALS  = { profesional:['academia','agencia','casting','carrera','modelo','industria','negocio'], aspiracional:['lujo','exclusiva','gala','alfombra','premio','desfile'], comunidad:['dallas','carrollton','texas','latina','hispana','comunidad','local'], general:[] };
const INTENT_SIGNALS    = { anuncio:['inauguramos','abrimos','lanzamos','presentamos','anunciamos','debut','apertura','nuevo','nueva'], celebración:['celebramos','cumpleaños','aniversario','ganamos','logramos','éxito'], inspiración:['tips','cómo','aprende','guía','secreto','transforma','mejora'], cobertura:['estuvo','fue','asistió','participó','desfiló','se presentó'] };

const detector = new HeroDetector();

class ThinkingEngine {

  understandIdea(idea) {
    const text  = idea.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
      category:        finalCategory,
      emotion:         EMOTION_MAP[finalCategory],
      editorialStyle:  EDITORIAL_STYLE_MAP[finalCategory],
      visualDirection: VISUAL_DIRECTION_MAP[finalCategory],
    };
  }

  analyze(idea) {
    if (!idea || typeof idea !== 'string' || !idea.trim()) {
      throw new Error('ThinkingEngine: idea inválida');
    }

    const { topic, intent, audience }                         = this.understandIdea(idea);
    const { category, emotion, editorialStyle, visualDirection } = this.classifyIdea(idea);
    const { hero, heroCandidates }                            = detector.detectHero(idea, category);

    return {
      originalIdea:    idea.trim(),
      topic,
      intent,
      audience,
      category,
      emotion,
      editorialStyle,
      visualDirection,
      hero,
      heroCandidates,
    };
  }
}

module.exports = { ThinkingEngine };