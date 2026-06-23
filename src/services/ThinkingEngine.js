/**
 * ThinkingEngine.js — v4 FINAL
 * PASARELA Editorial Intelligence™
 * Includes: HeroDetector v2 + EmotionEngine v1
 * All modules embedded — zero external dependencies.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// EMOTION ENGINE v1.0
// ═══════════════════════════════════════════════════════════════════════════════

const EMOTION_PROFILES = [
  { id:'urgencia',       signals:['huracan','terremoto','alerta','emergencia','catastrofe','tormenta','peligro','evacuacion','crisis','desastre'], primary:'urgencia',      secondary:'miedo',       intensity:98, tone:'directo, alarmante, informativo',            reason:'La idea comunica una amenaza o emergencia que requiere atención inmediata.' },
  { id:'celebracion',    signals:['inaugura','inauguramos','inauguracion','abre sus puertas','gran apertura','apertura','lanzamiento','lanzamos','lanzo','celebra','celebramos','fiesta','festeja','brindis'], primary:'celebración', secondary:'orgullo',      intensity:88, tone:'positivo, cálido, aspiracional',            reason:'La idea comunica una apertura o lanzamiento que debe sentirse como logro y celebración.' },
  { id:'orgullo',        signals:['graduacion','graduamos','graduados','promoci','titulacion','logro','logramos','exito','ganamos','gano','gana','campeon','premio','triunfo'], primary:'orgullo',      secondary:'inspiración', intensity:90, tone:'emotivo, aspiracional, celebratorio',        reason:'La idea comunica un logro personal o colectivo que debe resonar con orgullo.' },
  { id:'inspiracion',    signals:['transforma','cambia','revolucion','innovacion','futuro','posible','sueno','vision','nuevo camino','oportunidad','potencial'], primary:'inspiración',  secondary:'esperanza',   intensity:85, tone:'visionario, poderoso, motivador',           reason:'La idea apunta a transformación o cambio que debe despertar inspiración.' },
  { id:'solidaridad',    signals:['comunidad','unidos','juntos','ayuda','apoyo','donacion','voluntarios','familia','vecinos','colaboracion','se une','unen'], primary:'solidaridad',  secondary:'calidez',     intensity:82, tone:'humano, cercano, emotivo',                  reason:'La idea habla de unión comunitaria que debe transmitir solidaridad y pertenencia.' },
  { id:'calma',          signals:['bienestar','rutina','meditacion','yoga','mindfulness','equilibrio','paz','descanso','relax','salud mental','respiracion','serenidad'], primary:'calma',        secondary:'bienestar',   intensity:72, tone:'suave, contemplativo, sanador',             reason:'La idea evoca bienestar y cuidado personal que debe transmitir calma y equilibrio.' },
  { id:'lujo',           signals:['lujo','exclusivo','premium','haute couture','alta costura','gala','alfombra roja','vip','coleccion','disenador','fashion week'], primary:'aspiración',   secondary:'deseo',       intensity:88, tone:'sofisticado, elegante, exclusivo',           reason:'La idea evoca el mundo del lujo y la moda de alto nivel.' },
  { id:'nostalgia',      signals:['aniversario','anos de','historia','trayectoria','legado','recordamos','memoria','clasico','tradicion','desde'], primary:'nostalgia',    secondary:'orgullo',     intensity:78, tone:'evocador, cálido, respetuoso',              reason:'La idea evoca historia o legado que debe transmitir nostalgia y respeto.' },
  { id:'intriga',        signals:['secreto','detras de','exclusiva','primicia','intimo','confesion','nunca antes','por primera vez'], primary:'intriga',      secondary:'curiosidad',  intensity:86, tone:'misterioso, seductor, cinematográfico',     reason:'La idea sugiere revelación o exclusividad que debe generar intriga y curiosidad.' },
  { id:'empoderamiento', signals:['mujer','latina','emprendedora','lider','fuerza','rompe','primera en','historico','barrera','representacion'], primary:'empoderamiento',secondary:'orgullo',    intensity:91, tone:'poderoso, afirmativo, inspirador',          reason:'La idea comunica un hito de representación o liderazgo que debe sentirse empoderador.' },
  { id:'tecnologia',     signals:['ia','inteligencia artificial','robot','tecnologia','innovacion digital','automatizacion','metaverso','lanza gpt','presenta vision','robotaxi'], primary:'asombro',      secondary:'curiosidad',  intensity:87, tone:'visionario, técnico-editorial, disruptivo', reason:'La idea presenta una innovación tecnológica que debe generar asombro y curiosidad.' },
  { id:'amor',           signals:['boda','matrimonio','amor','enamorados','romantico','pareja','compromiso','propuesta'], primary:'amor',         secondary:'ternura',     intensity:84, tone:'romántico, íntimo, luminoso',               reason:'La idea evoca amor y unión que debe transmitir calidez y emoción.' },
];

const CATEGORY_EMOTION_FALLBACK = {
  MODA:       { primary:'aspiración',  secondary:'deseo',       intensity:75, tone:'sofisticado, elegante, aspiracional' },
  BELLEZA:    { primary:'confianza',   secondary:'bienestar',   intensity:74, tone:'íntimo, luminoso, sensorial' },
  TALENTO:    { primary:'inspiración', secondary:'admiración',  intensity:78, tone:'poderoso, auténtico, aspiracional' },
  EVENTOS:    { primary:'emoción',     secondary:'expectativa', intensity:76, tone:'dinámico, celebratorio, social' },
  LIFESTYLE:  { primary:'bienestar',   secondary:'calma',       intensity:70, tone:'cálido, cotidiano, sofisticado' },
  EXCLUSIVAS: { primary:'intriga',     secondary:'curiosidad',  intensity:80, tone:'dramático, exclusivo, cinematográfico' },
};

function detectEmotion(idea, category = 'EXCLUSIVAS') {
  const text = idea.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let bestMatch = null, bestScore = 0;
  for (const profile of EMOTION_PROFILES) {
    const matchCount = profile.signals.filter(s => text.includes(s)).length;
    if (matchCount > 0 && matchCount > bestScore) { bestScore = matchCount; bestMatch = profile; }
  }
  if (bestMatch) {
    return { emotionProfile: { primaryEmotion: bestMatch.primary, secondaryEmotion: bestMatch.secondary, intensity: bestMatch.intensity, reason: bestMatch.reason, tone: bestMatch.tone, source: 'idea-specific' } };
  }
  const fallback = CATEGORY_EMOTION_FALLBACK[category] || CATEGORY_EMOTION_FALLBACK.EXCLUSIVAS;
  return { emotionProfile: { primaryEmotion: fallback.primary, secondaryEmotion: fallback.secondary, intensity: fallback.intensity, reason: `Emoción base de la categoría ${category}.`, tone: fallback.tone, source: 'category-fallback' } };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HERO DETECTOR v2.0
// ═══════════════════════════════════════════════════════════════════════════════

const CONCEPT_SIGNALS = [
  { signals:['transforma','revoluciona','cambia todo','redefine','reimagina'], hero:'REVOLUCIÓN', score:100 },
  { signals:['futuro de','el futuro','proxima generacion'],                    hero:'FUTURO',     score:98  },
  { signals:['disrupc','disruptiv'],                                           hero:'DISRUPCIÓN', score:97  },
  { signals:['huracan','terremoto','catastrofe','emergencia','alerta'],        hero:'ALERTA',     score:100 },
  { signals:['innovac'],                                                        hero:'INNOVACIÓN', score:95  },
  { signals:['crisis'],                                                         hero:'CRISIS',     score:96  },
];

const KNOWN_PRODUCTS = [
  { pattern:/robotaxi/i,              text:'ROBOTAXI',                                      score:94 },
  { pattern:/vision\s*pro\s*(\d+)?/i, text:(m)=>`VISION PRO${m[1]?' '+m[1]:''}`,           score:93 },
  { pattern:/gpt-?(\d+)/i,           text:(m)=>`GPT-${m[1]}`,                              score:93 },
  { pattern:/starlink/i,              text:'STARLINK',                                      score:91 },
  { pattern:/iphone\s*(\d+)?/i,      text:(m)=>`IPHONE${m[1]?' '+m[1]:''}`,               score:91 },
  { pattern:/cybertruck/i,            text:'CYBERTRUCK',                                    score:92 },
  { pattern:/neuralink/i,             text:'NEURALINK',                                     score:92 },
  { pattern:/gemini/i,                text:'GEMINI',                                        score:90 },
  { pattern:/chatgpt/i,               text:'CHATGPT',                                       score:90 },
  { pattern:/dall-?e/i,               text:'DALL-E',                                        score:89 },
  { pattern:/sora/i,                  text:'SORA',                                          score:89 },
];

const HIGH_IMPACT_NAMES = ['gabriela hearst','shakira','beyoncé','beyonce','jennifer lopez','rihanna','bad bunny','maluma','j balvin','karol g','rosalía','rosalia','zendaya','elon musk','taylor swift','madonna','kim kardashian'];
const BRAND_SIGNALS     = [{name:'tesla',score:74},{name:'apple',score:74},{name:'openai',score:74},{name:'meta',score:72},{name:'google',score:72},{name:'microsoft',score:72},{name:'amazon',score:71},{name:'samsung',score:70},{name:'netflix',score:71},{name:'dior',score:73},{name:'chanel',score:73},{name:'gucci',score:73},{name:'prada',score:72},{name:'versace',score:72},{name:'balenciaga',score:72},{name:'zara',score:70},{name:'louis vuitton',score:73}];

const INTENT_HEROES_HD = {
  inauguración:{text:'INAUGURACIÓN',score:88}, apertura:{text:'GRAN APERTURA',score:86},
  lanzamiento:{text:'LANZAMIENTO',score:75},   debut:{text:'DEBUT',score:82},
  celebración:{text:'CELEBRACIÓN',score:80},   graduación:{text:'GRADUACIÓN',score:88},
  aniversario:{text:'ANIVERSARIO',score:78},   premio:{text:'TRIUNFO',score:82},
  exclusiva:{text:'EXCLUSIVA',score:85},
  solidaridad:{text:'SOLIDARIDAD',score:83},
};

const INTENT_TRIGGERS_HD = {
  inauguración:['inaugura','inauguramos','inauguracion'], apertura:['abre sus puertas','abrimos','apertura','abrio','nuevo restaurante','nuevo cafe','nueva tienda','gran apertura'],
  lanzamiento:['lanzamos','lanzamiento','lanzo'],         debut:['debut','debuta','primera vez','estrena'],
  celebración:['celebra','celebramos','festeja','fiesta'],graduación:['graduacion','graduamos','graduados','promoci'],
  aniversario:['aniversario','anos de','cumpleanos'],     premio:['gano','ganamos','gana','triunfo','campeon','premio'],
  exclusiva:['exclusiva','primicia','detras de'],
  solidaridad:['se une','unen','juntos','solidaridad','ayudando'],
};

const CATEGORY_FALLBACK_HD = {MODA:'ESTILO',BELLEZA:'BELLEZA',TALENTO:'TALENTO',EVENTOS:'EVENTO',LIFESTYLE:'LIFESTYLE',EXCLUSIVAS:'EXCLUSIVA'};

function resolveLayout(text) {
  const w = text.trim().split(/\s+/).length;
  return w===1?'gigante':w===2?'dos-lineas':w===3?'tres-lineas':'compacto';
}

function normHD(str) { return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }

function extractCapProd(idea) {
  const GENERIC = new Set(['LA','EL','LOS','LAS','UN','UNA','DE','DEL','EN','Y','CON','POR','QUE','SE','ES','HOY','SU','AL','NO','SI']);
  const words = idea.split(/\s+/); const products = [];
  for (let i=1;i<words.length;i++) {
    const w = words[i].replace(/[.,!?]/g,'');
    if (/^[A-ZÁÉÍÓÚ][a-zA-Z0-9áéíóú\-]+/.test(w)&&w.length>2&&!GENERIC.has(w.toUpperCase())) {
      if (i+1<words.length){const next=words[i+1].replace(/[.,!?]/g,'');if(/^[A-ZÁÉÍÓÚ0-9]/.test(next)&&next.length>1&&!GENERIC.has(next.toUpperCase()))products.push({text:`${w} ${next}`.toUpperCase(),score:88});}
      products.push({text:w.toUpperCase(),score:85});
    }
  }
  return products;
}

function detectHero(idea, category='EXCLUSIVAS') {
  const text = normHD(idea); const candidates = [];
  let hasName=false;
  for (const {signals,hero,score} of CONCEPT_SIGNALS) { if(signals.some(s=>text.includes(s))) candidates.push({text:hero,type:'concept',score,reason:`Concepto: ${hero}`}); }
  for (const p of KNOWN_PRODUCTS) { const m=idea.match(p.pattern); if(m){const t=typeof p.text==='function'?p.text(m):p.text; candidates.push({text:t,type:'product',score:p.score,reason:`Producto: ${t}`});} }
  for (const name of HIGH_IMPACT_NAMES) { if(text.includes(normHD(name))){const f=name.split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join('\n').toUpperCase(); candidates.push({text:f,type:'person',score:92,reason:`Persona: ${name}`}); hasName=true; break;} }
  if(!hasName){const cp=extractCapProd(idea);for(const p of cp.slice(0,2))candidates.push({text:p.text,type:'product',score:p.score,reason:`Producto cap: ${p.text}`});}
  for (const b of BRAND_SIGNALS){if(text.includes(b.name))candidates.push({text:b.name.toUpperCase(),type:'brand',score:b.score,reason:`Marca: ${b.name}`});}
  for (const [intent,triggers] of Object.entries(INTENT_TRIGGERS_HD)){if(triggers.some(t=>text.includes(t))){const h=INTENT_HEROES_HD[intent];if(h)candidates.push({text:h.text,type:'event',score:h.score,reason:`Intent: ${intent}`,});}}
  candidates.push({text:CATEGORY_FALLBACK_HD[category]||'EXCLUSIVA',type:'fallback',score:50,reason:`Fallback: ${category}`});
  candidates.sort((a,b)=>b.score-a.score);
  const w=candidates[0];
  return { hero:{text:w.text,type:w.type,score:w.score,reason:w.reason,layout:resolveLayout(w.text)}, heroCandidates:candidates.map(c=>({text:c.text,type:c.type,score:c.score})) };
}

// ═══════════════════════════════════════════════════════════════════════════════
// THINKING ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORY_SIGNALS = {
  MODA:       ['moda','fashion','ropa','outfit','look','tendencia','colección','diseñador','pasarela','estilo','vestido','temporada','prenda','marca','lujo','zapatilla','bolso','accesorio'],
  BELLEZA:    ['belleza','maquillaje','skincare','piel','cabello','tratamiento','cosmético','perfume','rutina','labial','cuidado','spa','facial','serum','glam'],
  TALENTO:    ['modelo','modelaje','casting','agencia','talento','carrera','editorial','shooting','fotografía','artista','actor','cantante','influencer','creador','academia'],
  EVENTOS:    ['evento','inauguración','lanzamiento','desfile','gala','premios','alfombra','fiesta','celebración','apertura','debut','presentación','festival','show'],
  LIFESTYLE:  ['café','restaurante','viaje','fitness','bienestar','salud','yoga','meditación','hogar','decoración','gastronomía','experiencia','wellness','brunch','rutina','familia','comunidad','vecinos'],
  EXCLUSIVAS: ['exclusiva','primicia','secreto','detrás','entrevista','especial','íntimo','confidencial','revelación','historia'],
};

const EDITORIAL_STYLE_MAP = {MODA:'high fashion editorial — Vogue, minimal luxury',BELLEZA:'beauty editorial — íntimo, luminoso, sensorial',TALENTO:'portrait editorial — poderoso, auténtico, aspiracional',EVENTOS:'event editorial — dinámico, celebratorio, social',LIFESTYLE:'lifestyle editorial — cálido, cotidiano, sofisticado',EXCLUSIVAS:'cover story — dramático, exclusivo, cinematográfico'};
const VISUAL_DIRECTION_MAP = {MODA:'fondo neutro o arquitectónico, iluminación directa',BELLEZA:'primer plano, piel iluminada, fondo oscuro',TALENTO:'retrato ambiental, mirada directa a cámara',EVENTOS:'espacio amplio, ambiente festivo',LIFESTYLE:'escena cotidiana estilizada, paleta cálida',EXCLUSIVAS:'composición cinematográfica, alto contraste'};
const AUDIENCE_SIGNALS     = {profesional:['academia','agencia','casting','carrera','modelo','industria','negocio'],aspiracional:['lujo','exclusiva','gala','alfombra','premio','desfile'],comunidad:['dallas','carrollton','texas','latina','hispana','comunidad','local'],general:[]};
const INTENT_SIGNALS_TE    = {anuncio:['inauguramos','abrimos','lanzamos','presentamos','anunciamos','debut','apertura','nuevo','nueva'],celebración:['celebramos','cumpleaños','aniversario','ganamos','logramos','éxito'],inspiración:['tips','cómo','aprende','guía','secreto','transforma','mejora'],cobertura:['estuvo','fue','asistió','participó','desfiló','se presentó']};

function normTE(str){return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}

class ThinkingEngine {
  understandIdea(idea) {
    const text = normTE(idea);
    const STOP = new Set(['el','la','los','las','un','una','de','del','en','y','a','que','se','es','hoy','con','por','para','al']);
    const topic = idea.split(/\s+/).filter(w=>!STOP.has(w.toLowerCase())).slice(0,6).join(' ');
    let intent='editorial';
    for(const[k,s]of Object.entries(INTENT_SIGNALS_TE)){if(s.some(x=>text.includes(x))){intent=k;break;}}
    let audience='general';
    for(const[k,s]of Object.entries(AUDIENCE_SIGNALS)){if(k==='general')continue;if(s.some(x=>text.includes(x))){audience=k;break;}}
    return {topic,intent,audience};
  }

  classifyIdea(idea) {
    const text = normTE(idea);
    const scores={};
    for(const[cat,signals]of Object.entries(CATEGORY_SIGNALS)){scores[cat]=signals.filter(s=>text.includes(s)).length;}
    const category=Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0];
    const fc=scores[category]===0?'EXCLUSIVAS':category;
    return {category:fc,editorialStyle:EDITORIAL_STYLE_MAP[fc],visualDirection:VISUAL_DIRECTION_MAP[fc]};
  }

  analyze(idea) {
    if(!idea||typeof idea!=='string'||!idea.trim()) throw new Error('ThinkingEngine: idea inválida');
    const {topic,intent,audience}          = this.understandIdea(idea);
    const {category,editorialStyle,visualDirection} = this.classifyIdea(idea);
    const {hero,heroCandidates}            = detectHero(idea,category);
    const {emotionProfile}                 = detectEmotion(idea,category);
    return {originalIdea:idea.trim(),topic,intent,audience,category,editorialStyle,visualDirection,hero,heroCandidates,emotionProfile};
  }
}

module.exports = { ThinkingEngine };