/**
 * MaterializeScreen.tsx
 * PASARELA AI ENGINE™
 * Pantalla standalone — pegar en app/materialize.tsx o screens/MaterializeScreen.tsx
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
} from 'react-native';

const BACKEND = 'https://pasarela-servidor-production.up.railway.app';

const CAT_COLORS: Record<string, string> = {
  MODA:       '#FF1493',
  BELLEZA:    '#FFD60A',
  TALENTO:    '#00AEEF',
  EVENTOS:    '#7A3FF2',
  LIFESTYLE:  '#00B67A',
  EXCLUSIVAS: '#F4C430',
};

const EDITORIAL_IMAGES = [
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80',
  'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=80',
  'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=80',
  'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=800&q=80',
  'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800&q=80',
];

const STEPS = [
  'Comprendiendo idea...',
  'Construyendo narrativa...',
  'Diseñando portada...',
  'Aplicando identidad PASARELA...',
  'Listo.',
];

type View = 'form' | 'progress' | 'result';

interface Editorial {
  categoria: string;
  titular:   string;
  gancho:    string;
  hero:      string;
  pdpId:     string;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width - 32, 420);

export default function MaterializeScreen() {
  const [view, setView]           = useState<View>('form');
  const [idea, setIdea]           = useState('');
  const [currentStep, setStep]    = useState(-1);
  const [editorial, setEditorial] = useState<Editorial | null>(null);
  const [errorMsg, setErrorMsg]   = useState('');
  const [imgUrl, setImgUrl]       = useState('');

  const progressAnim = useRef(new Animated.Value(0)).current;
  const resultAnim   = useRef(new Animated.Value(0)).current;

  function animateProgress(toStep: number) {
    setStep(toStep);
    Animated.timing(progressAnim, {
      toValue: (toStep + 1) / STEPS.length,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }

  async function materializar() {
    const trimmed = idea.trim();
    if (!trimmed) return;

    setErrorMsg('');
    setView('progress');
    setStep(0);
    progressAnim.setValue(0);
    resultAnim.setValue(0);

    let apiData: Editorial | null = null;
    let apiError = '';
    let apiDone  = false;
    let stepsDone = false;

    function tryRender() {
      if (!apiDone || !stepsDone) return;
      if (apiError) {
        setErrorMsg(apiError);
        setView('form');
        return;
      }
      setEditorial(apiData);
      setImgUrl(EDITORIAL_IMAGES[Math.floor(Math.random() * EDITORIAL_IMAGES.length)]);
      Animated.timing(resultAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      setView('result');
    }

    // Animación de pasos
    STEPS.forEach((_, i) => {
      setTimeout(() => {
        animateProgress(i);
        if (i === STEPS.length - 1) {
          setTimeout(() => { stepsDone = true; tryRender(); }, 400);
        }
      }, i * 700);
    });

    // Llamada al backend
    try {
      const res = await fetch(`${BACKEND}/api/materialize`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ idea: trimmed }),
      });

      const raw = await res.text();

      if (!raw || !raw.trim()) {
        throw new Error(`El backend respondió vacío (HTTP ${res.status})`);
      }

      let json: any;
      try {
        json = JSON.parse(raw);
      } catch {
        throw new Error(`Respuesta no es JSON. Body: ${raw.slice(0, 100)}`);
      }

      if (!res.ok) {
        throw new Error(json.message || json.error || `Error HTTP ${res.status}`);
      }

      if (!json.success || !json.data) {
        throw new Error(json.message || json.error || 'Respuesta inesperada del backend');
      }

      apiData = json.data;
    } catch (e: any) {
      apiError = e.message;
    }

    apiDone = true;
    tryRender();
  }

  function resetear() {
    setIdea('');
    setEditorial(null);
    setErrorMsg('');
    setStep(-1);
    progressAnim.setValue(0);
    setView('form');
  }

  const barWidth = progressAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '100%'],
  });

  // ── FORM VIEW ──────────────────────────────────────────────
  if (view === 'form') return (
    <ScrollView style={s.root} contentContainerStyle={s.formContainer} keyboardShouldPersistTaps="handled">
      <View style={s.header}>
        <Text style={s.logo}>PASARELA</Text>
        <View style={s.logoDivider} />
      </View>

      <Text style={s.question}>¿Qué quieres materializar hoy?</Text>
      <Text style={s.subquestion}>Escribe una idea, noticia o mensaje y PASARELA lo convertirá en un activo visual.</Text>

      <TextInput
        style={s.input}
        value={idea}
        onChangeText={setIdea}
        placeholder="Ejemplo: Hoy inauguramos Pasarela Café en Carrollton"
        placeholderTextColor="#6b5560"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      {!!errorMsg && (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>⚠ {errorMsg}</Text>
        </View>
      )}

      <TouchableOpacity style={s.btnMat} onPress={materializar} activeOpacity={0.85}>
        <Text style={s.btnMatText}>✨ MATERIALIZAR</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ── PROGRESS VIEW ──────────────────────────────────────────
  if (view === 'progress') return (
    <View style={[s.root, s.progressContainer]}>
      <Text style={s.progressLogo}>PASARELA</Text>

      <View style={s.stepsList}>
        {STEPS.map((label, i) => (
          <View key={i}>
            <View style={s.stepRow}>
              <View style={[
                s.stepDot,
                i < currentStep  && s.stepDotDone,
                i === currentStep && s.stepDotActive,
              ]} />
              <Text style={[
                s.stepLabel,
                i === currentStep && s.stepLabelActive,
                i < currentStep  && s.stepLabelDone,
              ]}>{label}</Text>
            </View>
            {i < STEPS.length - 1 && <View style={s.stepLine} />}
          </View>
        ))}
      </View>

      <View style={s.progressBarWrap}>
        <Animated.View style={[s.progressBar, { width: barWidth }]} />
      </View>
    </View>
  );

  // ── RESULT VIEW ────────────────────────────────────────────
  const cat   = (editorial?.categoria || 'EXCLUSIVAS').toUpperCase();
  const color = CAT_COLORS[cat] || '#F4C430';

  return (
    <ScrollView style={s.root} contentContainerStyle={s.resultContainer}>
      <View style={s.header}>
        <Text style={s.logo}>PASARELA</Text>
        <View style={s.logoDivider} />
      </View>

      {/* PORTADA */}
      <View style={[s.pdpCard, { width: CARD_WIDTH }]}>
        {/* Header portada */}
        <View style={s.pdpHeader}>
          <Text style={s.pdpHeaderLogo}>PASARELA</Text>
          <View style={s.pdpHeaderLine} />
        </View>

        {/* Imagen + overlay + contenido */}
        <View style={s.pdpImageWrap}>
          <Image source={{ uri: imgUrl }} style={s.pdpImage} resizeMode="cover" />
          <View style={s.pdpOverlay} />
          <View style={s.pdpContent}>
            <Text style={[s.pdpCat, { color }]}>{cat}</Text>
            <Text style={s.pdpTitular}>{editorial?.titular}</Text>
            <Text style={s.pdpGancho}>{editorial?.gancho}</Text>
            <Text style={[s.pdpHero, { color }]}>{editorial?.hero}</Text>
          </View>
        </View>

        {/* Footer portada */}
        <View style={s.pdpFooter}>
          <Text style={s.pdpFooterBrand}>Pasarela Tu Revista</Text>
          <Text style={s.pdpFooterPdp}>{editorial?.pdpId}</Text>
        </View>
      </View>

      {/* Botones */}
      <View style={[s.resultBtns, { width: CARD_WIDTH }]}>
        <TouchableOpacity style={[s.rbtn, s.rbtnDl]} onPress={() => Alert.alert('Descarga', 'Integra expo-media-library para guardar la imagen.')} activeOpacity={0.85}>
          <Text style={[s.rbtnText, { color: '#FF1493' }]}>⬇ DESCARGAR</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.rbtn} onPress={resetear} activeOpacity={0.85}>
          <Text style={s.rbtnText}>↺ NUEVA IDEA</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.caption}>{editorial?.pdpId} · {cat}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:              { flex: 1, backgroundColor: '#0D0A0B' },
  formContainer:     { padding: 24, paddingTop: 48 },
  header:            { alignItems: 'center', marginBottom: 28 },
  logo:              { fontSize: 36, fontWeight: '700', color: '#FF1493', letterSpacing: 6, textTransform: 'uppercase' },
  logoDivider:       { width: '88%', height: 1, backgroundColor: '#FF1493', marginTop: 10, opacity: 0.85 },
  question:          { fontSize: 22, color: '#fff', marginBottom: 6, fontWeight: '300' },
  subquestion:       { fontSize: 13, color: '#8a7a7e', marginBottom: 18, fontWeight: '300', lineHeight: 19 },
  input:             { backgroundColor: '#1E1519', borderWidth: 1, borderColor: '#3a2530', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: '300', padding: 14, height: 110, marginBottom: 4 },
  errorBanner:       { backgroundColor: '#2a0e1a', borderWidth: 1, borderColor: '#FF149344', borderRadius: 8, padding: 10, marginTop: 8, marginBottom: 4 },
  errorText:         { color: '#FF1493', fontSize: 12, fontWeight: '400', lineHeight: 18 },
  btnMat:            { backgroundColor: '#FF1493', borderRadius: 10, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  btnMatText:        { color: '#fff', fontSize: 15, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' },
  progressContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  progressLogo:      { fontSize: 26, fontWeight: '700', color: '#FF1493', letterSpacing: 6, marginBottom: 36 },
  stepsList:         { width: '100%' },
  stepRow:           { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  stepDot:           { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3a2530' },
  stepDotActive:     { backgroundColor: '#FF1493' },
  stepDotDone:       { backgroundColor: '#5a3545' },
  stepLine:          { width: 1, height: 18, backgroundColor: '#2a1e23', marginLeft: 3 },
  stepLabel:         { fontSize: 13, fontWeight: '300', color: '#6b5560', letterSpacing: 1 },
  stepLabelActive:   { color: '#fff', fontWeight: '500' },
  stepLabelDone:     { color: '#5a3545' },
  progressBarWrap:   { width: '100%', height: 2, backgroundColor: '#1E1519', borderRadius: 2, marginTop: 32, overflow: 'hidden' },
  progressBar:       { height: 2, backgroundColor: '#FF1493' },
  resultContainer:   { alignItems: 'center', padding: 16, paddingTop: 40, paddingBottom: 40 },
  pdpCard:           { backgroundColor: '#0D0A0B', borderWidth: 1, borderColor: '#2a1e23', borderRadius: 4, overflow: 'hidden' },
  pdpHeader:         { backgroundColor: '#0D0A0B', padding: 10, alignItems: 'center' },
  pdpHeaderLogo:     { fontSize: 18, fontWeight: '700', color: '#FF1493', letterSpacing: 5, textTransform: 'uppercase' },
  pdpHeaderLine:     { width: '90%', height: 0.5, backgroundColor: '#FF1493', marginTop: 5, opacity: 0.8 },
  pdpImageWrap:      { height: 340, position: 'relative' },
  pdpImage:          { width: '100%', height: '100%' },
  pdpOverlay:        { position: 'absolute', inset: 0, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(13,10,11,0.38)' },
  pdpContent:        { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14 },
  pdpCat:            { fontSize: 9, fontWeight: '500', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 5 },
  pdpTitular:        { fontSize: 18, fontWeight: '700', color: '#fff', lineHeight: 22, marginBottom: 5, textShadowColor: 'rgba(0,0,0,0.95)', textShadowOffset: {width:0, height:1}, textShadowRadius: 8 },
  pdpGancho:         { fontSize: 11, fontWeight: '300', fontStyle: 'italic', color: '#e8d0d8', lineHeight: 17, marginBottom: 7, textShadowColor: 'rgba(0,0,0,0.90)', textShadowOffset: {width:0, height:1}, textShadowRadius: 6 },
  pdpHero:           { fontSize: 34, fontWeight: '700', lineHeight: 32, marginBottom: 4, textShadowColor: 'rgba(0,0,0,0.95)', textShadowOffset: {width:0, height:2}, textShadowRadius: 10 },
  pdpFooter:         { backgroundColor: '#0D0A0B', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8, paddingHorizontal: 14, borderTopWidth: 0.5, borderTopColor: '#1a1015' },
  pdpFooterBrand:    { fontSize: 9, color: '#9a8a8e', letterSpacing: 2, textTransform: 'uppercase', fontWeight: '300' },
  pdpFooterPdp:      { fontSize: 9, color: '#FF1493', fontWeight: '500', letterSpacing: 1 },
  resultBtns:        { flexDirection: 'row', gap: 10, marginTop: 14 },
  rbtn:              { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#3a2530', backgroundColor: '#1E1519', alignItems: 'center' },
  rbtnDl:            { borderColor: '#FF1493' },
  rbtnText:          { fontSize: 12, fontWeight: '500', color: '#e0c8d0', letterSpacing: 1, textTransform: 'uppercase' },
  caption:           { fontSize: 11, color: '#5a4a50', fontWeight: '300', letterSpacing: 1, marginTop: 10 },
});