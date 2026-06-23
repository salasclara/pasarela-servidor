/**
 * ThinkingEngine.js — v5 FINAL
 * PASARELA Editorial Intelligence™
 * HeroDetector v2 + EmotionEngine v1 + VisualDirectionEngine v1
 * Zero external dependencies.
 */

// ═══════════════════════════════════════════════════════════════════════
// VISUAL DIRECTION ENGINE v1.0
// ═══════════════════════════════════════════════════════════════════════

const MOOD_MAP_VD = {
  'celebración':    { mood:'festive warm',        lighting:'golden hour',            colorPalette:'warm golds and whites',     camera:'editorial celebratory',   atmosphere:'bright movement'     },
  'orgullo':        { mood:'inspiring',            lighting:'dramatic inspirational', colorPalette:'deep golds and warm tones', camera:'portrait editorial',      atmosphere:'triumphant focus'    },
  'solidaridad':    { mood:'warm human',           lighting:'natural warm',           colorPalette:'warm earth tones',          camera:'documentary editorial',   atmosphere:'connected people'    },
  'urgencia':       { mood:'tense alarming',       lighting:'dramatic contrast',      colorPalette:'dark greys and reds',       camera:'news editorial cinematic',atmosphere:'dark tension'        },
  'inspiración':    { mood:'visionary hopeful',    lighting:'bright optimistic',      colorPalette:'clean whites and blues',    camera:'cinematic editorial',     atmosphere:'open possibility'    },
  'asombro':        { mood:'futuristic wonder',    lighting:'neon blue',              colorPalette:'electric blue and black',   camera:'cinematic tech editorial',atmosphere:'tech innovation'     },
  'aspiración':     { mood:'luxury elegant',       lighting:'luxury studio',          colorPalette:'blacks creams and gold',    camera:'magazine cover fashion',  atmosphere:'sophisticated'       },
  'calma':          { mood:'serene peaceful',      lighting:'soft diffused',          colorPalette:'soft neutrals and greens',  camera:'lifestyle documentary',   atmosphere:'quiet stillness'     },
  'intriga':        { mood:'mysterious dramatic',  lighting:'chiaroscuro',            colorPalette:'deep blacks and golds',     camera:'cinematic noir editorial',atmosphere:'cinematic suspense'  },
  'empoderamiento': { mood:'powerful affirming',   lighting:'bold dramatic',          colorPalette:'bold reds and blacks',      camera:'portrait empowerment',    atmosphere:'strong presence'     },
  'confianza':      { mood:'clean confident',      lighting:'bright clean',           colorPalette:'whites and soft pinks',     camera:'beauty editorial',        atmosphere:'clarity wellness'    },
  'bienestar':      { mood:'calm wellness',        lighting:'natural soft',           colorPalette:'earthy greens and neutrals',camera:'lifestyle wellness',      atmosphere:'peaceful balance'    },
  'amor':           { mood:'romantic intimate',    lighting:'soft romantic',          colorPalette:'soft pinks and creams',     camera:'intimate editorial',      atmosphere:'tender closeness'    },
  'nostalgia':      { mood:'warm nostalgic',       lighting:'warm golden tones',      colorPalette:'sepia warm tones',          camera:'documentary portrait',    atmosphere:'timeless'            },
};

const CATEGORY_RULES_VD = {
  MODA:       { scene:'fashion editorial studio',          style:'high fashion editorial',      keywords:['fashion','elegance','style','luxury','magazine']   },
  BELLEZA:    { scene:'beauty close-up portrait',          style:'beauty magazine',             keywords:['beauty','skin','glow','close-up','radiant']        },
  TALENTO:    { scene:'talent portrait editorial',         style:'talent showcase',             keywords:['talent','performer','authentic','powerful']         },
  EVENTOS:    { scene:'event atmosphere celebration',      style:'event coverage',              keywords:['event','celebration','people','energy','moment']    },
  LIFESTYLE:  { scene:'authentic lifestyle moment',        style:'lifestyle documentary',       keywords:['lifestyle','authentic','real','warm','human']       },
  EXCLUSIVAS: { scene:'exclusive cinematic portrait',      style:'cover story exclusive',       keywords:['exclusive','dramatic','cinematic','powerful','story']},
};

const HERO_AMP = {
  'ALERTA':        { sceneAdd:'stormy sky threatening clouds',     kw:['storm','danger','warning','dramatic sky'],         moodAdd:'alarming tense',     lightOver:'dark dramatic stormy'    },
  'REVOLUCIÓN':    { sceneAdd:'transformation movement change',    kw:['revolution','change','movement','transformation'],  moodAdd:'revolutionary',      lightOver:null                      },
  'INAUGURACIÓN':  { sceneAdd:'grand opening ribbon cutting',      kw:['opening','celebration','new beginning'],            moodAdd:'celebratory proud',  lightOver:'warm golden festive'     },
  'GRAN APERTURA': { sceneAdd:'grand opening celebration crowd',   kw:['grand opening','celebration','community'],          moodAdd:'festive proud',      lightOver:'warm golden festive'     },
  'ROBOTAXI':      { sceneAdd:'autonomous vehicle futuristic city',kw:['autonomous','vehicle','future mobility','tech'],    moodAdd:'futuristic',         lightOver:'neon city night'         },
  'GRADUACIÓN':    { sceneAdd:'graduation ceremony achievement',   kw:['graduation','achievement','milestone'],             moodAdd:'proud triumphant',   lightOver:'bright inspirational'    },
  'SOLIDARIDAD':   { sceneAdd:'people helping hands community',    kw:['helping','community','support','together'],         moodAdd:'warm human',         lightOver:'warm natural'            },
  'FUTURO':        { sceneAdd:'horizon possibility open sky',       kw:['horizon','future','possibility','light'],           moodAdd:'hopeful visionary',  lightOver:'golden sunrise'          },
  'TRIUNFO':       { sceneAdd:'victory moment triumph winner',     kw:['victory','triumph','winner','glory'],               moodAdd:'triumphant',         lightOver:'dramatic golden'         },
  'CELEBRACIÓN':   { sceneAdd:'joyful celebration people energy',  kw:['joy','celebration','energy','happiness'],           moodAdd:'joyful energetic',   lightOver:'warm bright festive'     },
  'DEBUT':         { sceneAdd:'first moment spotlight stage',       kw:['debut','first','spotlight','stage'],                moodAdd:'anticipation proud', lightOver:'dramatic spotlight'      },
  'SHAKIRA':       { sceneAdd:'iconic performer stage spotlight',  kw:['performer','icon','stage','energy'],                moodAdd:'iconic powerful',    lightOver:'dramatic stage lighting' },
  'DALLAS':        { sceneAdd:'community people warm gathering',   kw:['community','people','warmth','together'],           moodAdd:'warm community',     lightOver:'warm natural'            },
};


// ── VISUAL CONSTRAINTS™ ──────────────────────────────────────────────────────
// requiredElements: elementos que DEBEN aparecer en la imagen
// forbiddenElements: elementos que NO deben aparecer
const VISUAL_CONSTRAINTS = {
  // Por emoción
  emotions: {
    'urgencia':       { required:['storm clouds','strong wind','dramatic sky','tension','danger'],          forbidden:['smiling people','fashion poses','studio portrait','glamour','selfie'] },
    'solidaridad':    { required:['people together','hands helping','community warmth','human connection'],  forbidden:['solo person','empty space','fashion editorial','studio portrait','luxury'] },
    'celebración':    { required:['people celebrating','joy','festive atmosphere','warmth'],                 forbidden:['storm','empty space','danger','tension'] },
    'orgullo':        { required:['triumphant person','achievement moment','inspiring light'],               forbidden:['storm','disaster','empty background'] },
    'aspiración':     { required:['fashion editorial','luxury environment','elegant composition'],           forbidden:['disaster','crowd chaos','community gathering','storm'] },
    'calma':          { required:['peaceful scene','nature','soft light','stillness'],                       forbidden:['crowd','chaos','storm','dramatic contrast'] },
    'intriga':        { required:['mysterious atmosphere','dramatic shadows','cinematic depth'],             forbidden:['bright cheerful','crowd','community scene'] },
    'inspiración':    { required:['open horizon','bright light','possibility','upward movement'],            forbidden:['storm','disaster','closed space','darkness'] },
    'asombro':        { required:['futuristic elements','technology','innovation','scale'],                  forbidden:['vintage','natural landscape','community warmth'] },
    'empoderamiento': { required:['strong presence','direct gaze','powerful pose','bold light'],             forbidden:['weakness','crowd dependency','storm chaos'] },
    'nostalgia':      { required:['warm tones','timeless setting','soft focus','memory feel'],               forbidden:['futuristic','neon','harsh contrast'] },
    'amor':           { required:['intimate connection','soft light','closeness','tenderness'],              forbidden:['storm','crowd chaos','harsh lighting'] },
  },
  // Por categoría (se fusionan con los de emoción)
  categories: {
    MODA:       { required:['fashion editorial','luxury setting','elegant model','runway or studio'],        forbidden:['natural disaster','community scene','news event','chaos'] },
    BELLEZA:    { required:['close-up portrait','radiant skin','beauty lighting','clean background'],        forbidden:['storm','crowd','news editorial','disaster'] },
    TALENTO:    { required:['performer portrait','authentic expression','stage or editorial setting'],       forbidden:['empty landscape','disaster','crowd chaos'] },
    EVENTOS:    { required:['event atmosphere','people','energy','celebration space'],                       forbidden:['empty landscape','studio portrait alone','disaster'] },
    LIFESTYLE:  { required:['authentic moment','real people','warm setting','human scale'],                  forbidden:['studio fashion','disaster','news event','cold corporate'] },
    EXCLUSIVAS: { required:['cinematic composition','dramatic lighting','exclusive feel'],                   forbidden:['mundane setting','harsh news','crowd chaos'] },
  },
  // Por hero type
  heroTypes: {
    concept:  { required:['symbolic visual','strong metaphor','impactful composition'],  forbidden:['literal interpretation','generic stock'] },
    product:  { required:['product hero shot','context environment','innovation feel'],  forbidden:['people posing with product as background','generic landscape'] },
    person:   { required:['portrait focus','authentic expression','personality'],        forbidden:['obscured face','crowd where person is lost'] },
    brand:    { required:['brand context','premium environment'],                         forbidden:['competitor branding','generic stock'] },
    event:    { required:['event energy','moment capture','atmosphere'],                  forbidden:['empty venue','post-event cleanup'] },
  },
};

function mergeConstraints(category, emotion, heroType) {
  const emoC   = VISUAL_CONSTRAINTS.emotions[emotion]   || { required:[], forbidden:[] };
  const catC   = VISUAL_CONSTRAINTS.categories[category] || { required:[], forbidden:[] };
  const heroC  = VISUAL_CONSTRAINTS.heroTypes[heroType]  || { required:[], forbidden:[] };

  // Fusionar sin duplicados
  const req = [...new Set([...emoC.required.slice(0,3), ...catC.required.slice(0,2), ...heroC.required.slice(0,1)])].slice(0,6);
  const forb = [...new Set([...emoC.forbidden.slice(0,3), ...catC.forbidden.slice(0,2)])].slice(0,5);

  return { requiredElements: req, forbiddenElements: forb };
}

function generateVisualDirection(category, heroText, emotion, heroType) {
  const catKey = (category || 'EXCLUSIVAS').toUpperCase();
  const catRule = CATEGORY_RULES_VD[catKey] || CATEGORY_RULES_VD.EXCLUSIVAS;
  const moodProfile = MOOD_MAP_VD[(emotion || '').toLowerCase()] || MOOD_MAP_VD['aspiración'];
  const heroKey = (heroText || '').toUpperCase().split('\n').join(' ');
  const amp = HERO_AMP[heroKey] || null;
  const scene    = amp ? amp.sceneAdd + ', ' + catRule.scene : catRule.scene;
  const lighting = (amp && amp.lightOver) ? amp.lightOver : moodProfile.lighting;
  const mood     = amp ? amp.moodAdd + ', ' + moodProfile.mood : moodProfile.mood;
  const keywords = [...catRule.keywords.slice(0,3), ...(amp ? amp.kw.slice(0,3) : [])].filter((v,i,a) => a.indexOf(v) === i).slice(0,6);
  const constraints = mergeConstraints(catKey, emotion || 'aspiración', heroType || 'event');
  return {
    scene, mood, lighting,
    camera:       moodProfile.camera,
    colorPalette: moodProfile.colorPalette,
    style:        catRule.style,
    atmosphere:   moodProfile.atmosphere,
    keywords,
    requiredElements:  constraints.requiredElements,
    forbiddenElements: constraints.forbiddenElements,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// EMOTION ENGINE v1.0
// ═══════════════════════════════════════════════════════════════════════

const EMOTION_PROFILES = [
  { signals:['huracan','terremoto','alerta','emergencia','catastrofe','tormenta','peligro','evacuacion','crisis','desastre'], primary:'urgencia',      secondary:'miedo',       intensity:98, tone:'directo, alarmante, informativo',            reason:'La idea comunica una amenaza o emergencia.' },
  { signals:['inaugura','inauguramos','inauguracion','abre sus puertas','gran apertura','apertura','lanzamiento','lanzamos','lanzo','celebra','celebramos','fiesta','brindis'], primary:'celebración', secondary:'orgullo', intensity:88, tone:'positivo, cálido, aspiracional', reason:'La idea comunica apertura o lanzamiento.' },
  { signals:['graduacion','graduamos','graduados','promoci','logro','logramos','exito','ganamos','gano','gana','campeon','premio','triunfo'], primary:'orgullo', secondary:'inspiración', intensity:90, tone:'emotivo, aspiracional, celebratorio', reason:'La idea comunica un logro personal o colectivo.' },
  { signals:['transforma','cambia','revolucion','innovacion','futuro','sueno','vision','oportunidad','potencial'], primary:'inspiración', secondary:'esperanza', intensity:85, tone:'visionario, poderoso, motivador', reason:'La idea apunta a transformación.' },
  { signals:['comunidad','unidos','juntos','ayuda','apoyo','donacion','voluntarios','familia','vecinos','colaboracion','se une','unen'], primary:'solidaridad', secondary:'calidez', intensity:82, tone:'humano, cercano, emotivo', reason:'La idea habla de unión comunitaria.' },
  { signals:['bienestar','rutina','meditacion','yoga','mindfulness','equilibrio','paz','descanso','relax','serenidad'], primary:'calma', secondary:'bienestar', intensity:72, tone:'suave, contemplativo, sanador', reason:'La idea evoca bienestar.' },
  { signals:['lujo','exclusivo','premium','haute couture','alta costura','gala','alfombra roja','vip','disenador','fashion week'], primary:'aspiración', secondary:'deseo', intensity:88, tone:'sofisticado, elegante, exclusivo', reason:'La idea evoca el mundo del lujo.' },
  { signals:['aniversario','anos de','historia','trayectoria','legado','recordamos','memoria','clasico','tradicion'], primary:'nostalgia', secondary:'orgullo', intensity:78, tone:'evocador, cálido, respetuoso', reason:'La idea evoca historia o legado.' },
  { signals:['secreto','detras de','exclusiva','primicia','intimo','nunca antes','por primera vez'], primary:'intriga', secondary:'curiosidad', intensity:86, tone:'misterioso, seductor, cinematográfico', reason:'La idea sugiere revelación.' },
  { signals:['mujer','latina','emprendedora','lider','fuerza','rompe','primera en','historico','representacion'], primary:'empoderamiento', secondary:'orgullo', intensity:91, tone:'poderoso, afirmativo, inspirador', reason:'La idea comunica liderazgo.' },
  { signals:['ia','inteligencia artificial','robot','tecnologia','innovacion digital','automatizacion','metaverso','robotaxi'], primary:'asombro', secondary:'curiosidad', intensity:87, tone:'visionario, técnico-editorial, disruptivo', reason:'La idea presenta innovación tecnológica.' },
  { signals:['boda','matrimonio','amor','enamorados','romantico','pareja','compromiso','propuesta'], primary:'amor', secondary:'ternura', intensity:84, tone:'romántico, íntimo, luminoso', reason:'La idea evoca amor.' },
];

const CAT_EMO_FALLBACK = {
  MODA:{primary:'aspiración',secondary:'deseo',intensity:75,tone:'sofisticado, elegante, aspiracional'},
  BELLEZA:{primary:'confianza',secondary:'bienestar',intensity:74,tone:'íntimo, luminoso, sensorial'},
  TALENTO:{primary:'inspiración',secondary:'admiración',intensity:78,tone:'poderoso, auténtico, aspiracional'},
  EVENTOS:{primary:'emoción',secondary:'expectativa',intensity:76,tone:'dinámico, celebratorio, social'},
  LIFESTYLE:{primary:'bienestar',secondary:'calma',intensity:70,tone:'cálido, cotidiano, sofisticado'},
  EXCLUSIVAS:{primary:'intriga',secondary:'curiosidad',intensity:80,tone:'dramático, exclusivo, cinematográfico'},
};

function detectEmotion(idea, category) {
  const text = idea.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let best = null, bestScore = 0;
  for (const p of EMOTION_PROFILES) {
    const n = p.signals.filter(s => text.includes(s)).length;
    if (n > 0 && n > bestScore) { bestScore = n; best = p; }
  }
  if (best) return { primaryEmotion:best.primary, secondaryEmotion:best.secondary, intensity:best.intensity, reason:best.reason, tone:best.tone, source:'idea-specific' };
  const fb = CAT_EMO_FALLBACK[category] || CAT_EMO_FALLBACK.EXCLUSIVAS;
  return { primaryEmotion:fb.primary, secondaryEmotion:fb.secondary, intensity:fb.intensity, reason:`Emoción base: ${category}`, tone:fb.tone, source:'category-fallback' };
}

// ═══════════════════════════════════════════════════════════════════════
// HERO DETECTOR v2.0
// ═══════════════════════════════════════════════════════════════════════

const CONCEPT_SIG = [
  { signals:['transforma','revoluciona','cambia todo','redefine'], hero:'REVOLUCIÓN', score:100 },
  { signals:['futuro de','el futuro','proxima generacion'],        hero:'FUTURO',     score:98  },
  { signals:['disrupc','disruptiv'],                               hero:'DISRUPCIÓN', score:97  },
  { signals:['huracan','terremoto','catastrofe','emergencia','alerta'], hero:'ALERTA',score:100 },
  { signals:['innovac'],                                           hero:'INNOVACIÓN', score:95  },
  { signals:['crisis'],                                            hero:'CRISIS',     score:96  },
];

const KNOWN_PROD = [
  { pattern:/robotaxi/i,              fn:(m)=>'ROBOTAXI',                                       score:94 },
  { pattern:/vision\s*pro\s*(\d+)?/i, fn:(m)=>`VISION PRO${m[1]?' '+m[1]:''}`,                 score:93 },
  { pattern:/gpt-?(\d+)/i,           fn:(m)=>`GPT-${m[1]}`,                                    score:93 },
  { pattern:/starlink/i,              fn:(m)=>'STARLINK',                                       score:91 },
  { pattern:/cybertruck/i,            fn:(m)=>'CYBERTRUCK',                                     score:92 },
  { pattern:/neuralink/i,             fn:(m)=>'NEURALINK',                                      score:92 },
  { pattern:/chatgpt/i,               fn:(m)=>'CHATGPT',                                        score:90 },
];

const HI_NAMES = ['gabriela hearst','shakira','beyoncé','beyonce','jennifer lopez','rihanna','bad bunny','maluma','j balvin','karol g','rosalía','rosalia','zendaya','elon musk','taylor swift','madonna','kim kardashian'];
const BRANDS   = [{n:'tesla',s:74},{n:'apple',s:74},{n:'openai',s:74},{n:'meta',s:72},{n:'google',s:72},{n:'dior',s:73},{n:'chanel',s:73},{n:'gucci',s:73},{n:'prada',s:72},{n:'zara',s:70}];

const INTENT_H = {
  inauguración:{t:'INAUGURACIÓN',s:88}, apertura:{t:'GRAN APERTURA',s:86}, lanzamiento:{t:'LANZAMIENTO',s:75},
  debut:{t:'DEBUT',s:82}, celebración:{t:'CELEBRACIÓN',s:80}, graduación:{t:'GRADUACIÓN',s:88},
  aniversario:{t:'ANIVERSARIO',s:78}, premio:{t:'TRIUNFO',s:82}, exclusiva:{t:'EXCLUSIVA',s:85},
  solidaridad:{t:'SOLIDARIDAD',s:83},
};
const INTENT_T = {
  inauguración:['inaugura','inauguramos','inauguracion'],
  apertura:['abre sus puertas','abrimos','apertura','abrio','nuevo restaurante','nuevo cafe','nueva tienda','gran apertura'],
  lanzamiento:['lanzamos','lanzamiento','lanzo'],
  debut:['debut','debuta','primera vez','estrena'],
  celebración:['celebra','celebramos','festeja','fiesta'],
  graduación:['graduacion','graduamos','graduados','promoci'],
  aniversario:['aniversario','anos de','cumpleanos'],
  premio:['gano','ganamos','gana','triunfo','campeon','premio'],
  exclusiva:['exclusiva','primicia','detras de'],
  solidaridad:['se une','unen','juntos','solidaridad','ayudando'],
};
const CAT_FB = {MODA:'ESTILO',BELLEZA:'BELLEZA',TALENTO:'TALENTO',EVENTOS:'EVENTO',LIFESTYLE:'LIFESTYLE',EXCLUSIVAS:'EXCLUSIVA'};

function rLayout(t){const w=t.trim().split(/\s+/).length;return w===1?'gigante':w===2?'dos-lineas':w===3?'tres-lineas':'compacto';}
function nrm(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function capProd(idea){
  const G=new Set(['LA','EL','LOS','LAS','UN','UNA','DE','DEL','EN','Y','CON','POR','QUE','SE','ES','HOY','SU','AL','NO','SI']);
  const words=idea.split(/\s+/);const p=[];
  for(let i=1;i<words.length;i++){
    const w=words[i].replace(/[.,!?]/g,'');
    if(/^[A-ZÁÉÍÓÚ][a-zA-Z0-9áéíóú\-]+/.test(w)&&w.length>2&&!G.has(w.toUpperCase())){
      if(i+1<words.length){const nx=words[i+1].replace(/[.,!?]/g,'');if(/^[A-ZÁÉÍÓÚ0-9]/.test(nx)&&nx.length>1&&!G.has(nx.toUpperCase()))p.push({t:`${w} ${nx}`.toUpperCase(),s:88});}
      p.push({t:w.toUpperCase(),s:85});
    }
  }
  return p;
}

function detectHero(idea, category) {
  const text=nrm(idea);const cands=[];let hasName=false;
  for(const{signals,hero,score}of CONCEPT_SIG){if(signals.some(s=>text.includes(s)))cands.push({text:hero,type:'concept',score,reason:`Concepto: ${hero}`});}
  for(const p of KNOWN_PROD){const m=idea.match(p.pattern);if(m)cands.push({text:p.fn(m),type:'product',score:p.score,reason:`Producto: ${p.fn(m)}`});}
  for(const name of HI_NAMES){if(text.includes(nrm(name))){const f=name.split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join('\n').toUpperCase();cands.push({text:f,type:'person',score:92,reason:`Persona: ${name}`});hasName=true;break;}}
  if(!hasName){const cp=capProd(idea);for(const p of cp.slice(0,2))cands.push({text:p.t,type:'product',score:p.s,reason:`Producto cap: ${p.t}`});}
  for(const b of BRANDS){if(text.includes(b.n))cands.push({text:b.n.toUpperCase(),type:'brand',score:b.s,reason:`Marca: ${b.n}`});}
  for(const[intent,triggers]of Object.entries(INTENT_T)){if(triggers.some(t=>text.includes(t))){const h=INTENT_H[intent];if(h)cands.push({text:h.t,type:'event',score:h.s,reason:`Intent: ${intent}`});}}
  cands.push({text:CAT_FB[category]||'EXCLUSIVA',type:'fallback',score:50,reason:`Fallback: ${category}`});
  cands.sort((a,b)=>b.score-a.score);
  const w=cands[0];
  return {hero:{text:w.text,type:w.type,score:w.score,reason:w.reason,layout:rLayout(w.text)},heroCandidates:cands.map(c=>({text:c.text,type:c.type,score:c.score}))};
}

// ═══════════════════════════════════════════════════════════════════════
// THINKING ENGINE
// ═══════════════════════════════════════════════════════════════════════

const CAT_SIG = {
  MODA:       ['moda','fashion','ropa','outfit','look','tendencia','colección','diseñador','pasarela','estilo','vestido','temporada','prenda','marca','lujo','zapatilla','bolso','accesorio'],
  BELLEZA:    ['belleza','maquillaje','skincare','piel','cabello','tratamiento','cosmético','perfume','rutina','labial','cuidado','spa','facial','serum','glam'],
  TALENTO:    ['modelo','modelaje','casting','agencia','talento','carrera','editorial','shooting','fotografía','artista','actor','cantante','influencer','creador','academia'],
  EVENTOS:    ['evento','inauguración','lanzamiento','desfile','gala','premios','alfombra','fiesta','celebración','apertura','debut','presentación','festival','show'],
  LIFESTYLE:  ['café','restaurante','viaje','fitness','bienestar','salud','yoga','meditación','hogar','decoración','gastronomía','experiencia','wellness','brunch','rutina','familia','comunidad','vecinos'],
  EXCLUSIVAS: ['exclusiva','primicia','secreto','detrás','entrevista','especial','íntimo','confidencial','revelación','historia'],
};

const ED_STYLE = {MODA:'high fashion editorial — Vogue, minimal luxury',BELLEZA:'beauty editorial — íntimo, luminoso, sensorial',TALENTO:'portrait editorial — poderoso, auténtico, aspiracional',EVENTOS:'event editorial — dinámico, celebratorio, social',LIFESTYLE:'lifestyle editorial — cálido, cotidiano, sofisticado',EXCLUSIVAS:'cover story — dramático, exclusivo, cinematográfico'};
const VIS_DIR  = {MODA:'fondo neutro o arquitectónico, iluminación directa',BELLEZA:'primer plano, piel iluminada, fondo oscuro',TALENTO:'retrato ambiental, mirada directa a cámara',EVENTOS:'espacio amplio, ambiente festivo',LIFESTYLE:'escena cotidiana estilizada, paleta cálida',EXCLUSIVAS:'composición cinematográfica, alto contraste'};
const AUD_SIG  = {profesional:['academia','agencia','casting','carrera','modelo','industria','negocio'],aspiracional:['lujo','exclusiva','gala','alfombra','premio','desfile'],comunidad:['dallas','carrollton','texas','latina','hispana','comunidad','local'],general:[]};
const INT_SIG  = {anuncio:['inauguramos','abrimos','lanzamos','presentamos','anunciamos','debut','apertura','nuevo','nueva'],celebración:['celebramos','cumpleaños','aniversario','ganamos','logramos','éxito'],inspiración:['tips','cómo','aprende','guía','secreto','transforma','mejora'],cobertura:['estuvo','fue','asistió','participó','desfiló','se presentó']};

class ThinkingEngine {
  understandIdea(idea) {
    const text=nrm(idea);
    const STOP=new Set(['el','la','los','las','un','una','de','del','en','y','a','que','se','es','hoy','con','por','para','al']);
    const topic=idea.split(/\s+/).filter(w=>!STOP.has(w.toLowerCase())).slice(0,6).join(' ');
    let intent='editorial';
    for(const[k,s]of Object.entries(INT_SIG)){if(s.some(x=>text.includes(x))){intent=k;break;}}
    let audience='general';
    for(const[k,s]of Object.entries(AUD_SIG)){if(k==='general')continue;if(s.some(x=>text.includes(x))){audience=k;break;}}
    return {topic,intent,audience};
  }

  classifyIdea(idea) {
    const text=nrm(idea);
    const scores={};
    for(const[cat,signals]of Object.entries(CAT_SIG)){scores[cat]=signals.filter(s=>text.includes(s)).length;}
    const category=Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0];
    const fc=scores[category]===0?'EXCLUSIVAS':category;
    return {category:fc,editorialStyle:ED_STYLE[fc],baseVisualDirection:VIS_DIR[fc]};
  }

  analyze(idea) {
    if(!idea||typeof idea!=='string'||!idea.trim()) throw new Error('ThinkingEngine: idea inválida');
    const {topic,intent,audience}                    = this.understandIdea(idea);
    const {category,editorialStyle,baseVisualDirection} = this.classifyIdea(idea);
    const {hero,heroCandidates}                       = detectHero(idea,category);
    const emotionProfile                              = detectEmotion(idea,category);
    const visualDirection                             = generateVisualDirection(category,hero.text,emotionProfile.primaryEmotion,hero.type);
    return {originalIdea:idea.trim(),topic,intent,audience,category,editorialStyle,baseVisualDirection,hero,heroCandidates,emotionProfile,visualDirection};
  }
}

module.exports = { ThinkingEngine };