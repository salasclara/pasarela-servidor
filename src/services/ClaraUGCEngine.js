'use strict';

/**
 * CLARA UGC v1 — Fancy by Roxette
 * Real-content processor spec/prompt builder.
 * Clara is photographed with the real product; AI enhances presentation without recreating her.
 * No scheduler, publishing, DB writes or Commerce wiring.
 */

const SCENES = Object.freeze({
  BEAUTY_UGC: 'BEAUTY_UGC',
  STYLE_UGC: 'STYLE_UGC',
  HOME_LIFESTYLE_UGC: 'HOME_LIFESTYLE_UGC',
});

const PRIORITY = Object.freeze(['IDENTITY', 'REAL_PRODUCT', 'AUTHENTICITY', 'PRESENTATION']);

const GENERATION_STRATEGY = Object.freeze({
  BEAUTY_UGC: 'REAL_CLARA_PHOTO_PROCESSING',
  STYLE_UGC: 'REAL_CLARA_PHOTO_PROCESSING',
  HOME_LIFESTYLE_UGC: 'REAL_CLARA_PHOTO_PROCESSING',
});

const CLARA_IDENTITY_RULES = Object.freeze([
  'A real Clara photo is mandatory. Do not generate, reconstruct or replace Clara.',
  'Preserve Clara face, smile, teeth, eyes, nose, jawline, hair, skin texture, age and body proportions from the source photo.',
  'Do not beautify, rejuvenate, reshape, slim, face-swap or substitute a lookalike.',
  'Do not cosmetically perfect teeth, skin or facial asymmetry.',
  'Edits to Clara are limited to natural photographic corrections such as exposure, white balance and restrained color correction.',
  'If an enhancement risks changing Clara identity, keep the original pixels instead.',
]);

const PROCESSING_RULES = Object.freeze([
  'Start from a real photo of Clara with the real product.',
  'Keep Clara and the real product as the source of truth.',
  'Allowed: crop, straighten, exposure, white balance, restrained color correction, subtle sharpening, background cleanup and platform-safe resizing.',
  'Allowed when requested: non-destructive cover text/graphics placed away from Clara and the product.',
  'Do not replace the product with an AI recreation when the real product is already visible.',
  'Do not fabricate product features, labels, claims or results.',
  'Keep the finished content believable as smartphone UGC, not a catalog or studio advertisement.',
]);

const SCENE_RULES = Object.freeze({
  BEAUTY_UGC: [
    'Use a real Clara beauty/product photo in a bathroom, vanity or believable home setting.',
    'Prefer a clear product demonstration, opening, organization or use moment.',
  ],
  STYLE_UGC: [
    'Use a real Clara photo wearing or holding the real fashion product.',
    'Preserve her real body, pose and garment appearance; improve presentation rather than generating a new outfit/person.',
  ],
  HOME_LIFESTYLE_UGC: [
    'Use a real Clara photo naturally using the real product at home or in an everyday setting.',
    'Keep environmental cleanup subtle and believable.',
  ],
});

const OUTPUTS = Object.freeze({
  feed: '4:5',
  reelStory: '9:16',
  square: '1:1',
});

function normalizeScene(scene) {
  const key = String(scene || '').toUpperCase();
  if (!SCENES[key]) throw new Error('Invalid CLARA UGC scene: ' + scene);
  return SCENES[key];
}

function buildClaraUGCSpec({ scene, product = {}, notes = '' } = {}) {
  const normalizedScene = normalizeScene(scene);
  return {
    engine: 'CLARA_UGC',
    version: '1.0',
    role: 'REAL_CONTENT_PROCESSOR',
    mode: 'MANUAL_TEST_ONLY',
    generationStrategy: GENERATION_STRATEGY[normalizedScene],
    requiresRealClaraPhoto: true,
    requiresRealProduct: true,
    generateClaraFromScratch: false,
    publish: false,
    scheduler: false,
    priority: PRIORITY,
    scene: normalizedScene,
    identity: {
      sourceOfTruth: 'REAL_CLARA_PHOTO',
      rejectOnIdentityDrift: true,
      rules: CLARA_IDENTITY_RULES,
    },
    product: {
      title: product.title || '',
      category: product.category || '',
      imageUrl: product.imageUrl || '',
      asin: product.asin || '',
      sourceOfTruth: 'REAL_PRODUCT_IN_SOURCE_PHOTO',
      rules: [
        'Preserve the visible real product faithfully.',
        'Do not invent or replace product details.',
        'Do not make unsupported product claims.',
      ],
    },
    processingRules: PROCESSING_RULES,
    sceneRules: SCENE_RULES[normalizedScene],
    outputs: OUTPUTS,
    notes: String(notes || '').trim(),
  };
}

function buildClaraUGCPrompt(input = {}) {
  const spec = buildClaraUGCSpec(input);
  return [
    'Process authentic Clara UGC for Fancy by Roxette.',
    'This is PHOTO PROCESSING, not character generation.',
    'PRIORITY ORDER: ' + spec.priority.join(' > ') + '.',
    'SOURCE OF TRUTH: the uploaded real Clara photo and the real product visible in it.',
    'CLARA IDENTITY LOCK:',
    ...spec.identity.rules.map(x => '- ' + x),
    'PROCESSING RULES:',
    ...spec.processingRules.map(x => '- ' + x),
    'PRODUCT RULES:',
    ...spec.product.rules.map(x => '- ' + x),
    'SCENE:',
    ...spec.sceneRules.map(x => '- ' + x),
    spec.product.title ? 'Product: ' + spec.product.title : '',
    spec.notes ? 'Additional direction: ' + spec.notes : '',
    'IDENTITY GATE: if an edit changes Clara identity, discard that edit and preserve the original Clara pixels.',
    'Final result must remain believable real smartphone UGC.',
  ].filter(Boolean).join('\n');
}

module.exports = {
  SCENES,
  PRIORITY,
  CLARA_IDENTITY_RULES,
  PROCESSING_RULES,
  SCENE_RULES,
  OUTPUTS,
  GENERATION_STRATEGY,
  normalizeScene,
  buildClaraUGCSpec,
  buildClaraUGCPrompt,
};
