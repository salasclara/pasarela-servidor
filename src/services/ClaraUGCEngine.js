'use strict';

/**
 * CLARA UGC v1 — Fancy by Roxette
 * Pure prompt/spec builder. No scheduler, publishing, DB writes or Commerce wiring.
 */

const SCENES = Object.freeze({
  BEAUTY_UGC: 'BEAUTY_UGC',
  STYLE_UGC: 'STYLE_UGC',
  HOME_LIFESTYLE_UGC: 'HOME_LIFESTYLE_UGC',
});

const PRIORITY = Object.freeze(['IDENTITY', 'PRODUCT', 'SCENE', 'DECORATION']);

const GENERATION_STRATEGY = Object.freeze({
  BEAUTY_UGC: 'REFERENCE_GUIDED_GENERATION',
  STYLE_UGC: 'REAL_PHOTO_EDIT_IDENTITY_PRESERVATION',
  HOME_LIFESTYLE_UGC: 'REFERENCE_GUIDED_GENERATION',
});

const CLARA_IDENTITY_RULES = Object.freeze([
  'Use Clara Reference as the mandatory identity anchor.',
  'Preserve mature facial anatomy, eyes, nose, jawline, smile and natural teeth.',
  'Preserve natural skin texture and apparent age; do not rejuvenate.',
  'No beauty-filter skin, facial reshaping, artificial slimming or studio-glam retouching.',
  'Hair may be lightly styled while preserving its real cut, color and volume.',
  'Makeup must remain light, natural and camera-realistic.',
  'If scene complexity conflicts with identity fidelity, simplify the scene.',
  'IDENTITY LOCK: do not substitute a lookalike or reinterpret Clara as a generic mature Latina woman.',
  'Preserve the characteristic natural smile and real-looking tooth spacing/shape; never cosmetically perfect the teeth.',
  'Preserve facial width, cheek volume, under-eye structure, nasolabial lines and natural asymmetry.',
  'Do not make Clara younger, thinner-faced, more glamorous or more conventionally retouched than the references.',
]);

const SCENE_RULES = Object.freeze({
  BEAUTY_UGC: [
    'Candid beauty UGC in a believable vanity/bathroom or home setting.',
    'Show Clara naturally using, opening, organizing or demonstrating the product.',
    'Prefer phone-camera realism, ordinary daylight and minimal staging.',
  ],
  STYLE_UGC: [
    'Candid personal-style UGC in a believable home/dressing setting.',
    'STYLE must start from a real Clara photo as the base image; do not generate a new person from scratch.',
    'Preserve Clara head/face, body proportions, pose and recognizable anatomy from the base photo whenever possible.',
    'Edit primarily the garment/product and only the minimum surrounding pixels required for a natural fit.',
    'Show Clara naturally wearing, holding or styling the product.',
    'Avoid fashion-editorial posing unless explicitly requested.',
  ],
  HOME_LIFESTYLE_UGC: [
    'Candid home/lifestyle UGC in a believable everyday setting.',
    'Show Clara naturally using the product in context.',
    'Keep props secondary and the environment lived-in but tidy.',
  ],
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
    mode: 'MANUAL_TEST_ONLY',
    generationStrategy: GENERATION_STRATEGY[normalizedScene],
    requiresRealBasePhoto: normalizedScene === SCENES.STYLE_UGC,
    publish: false,
    scheduler: false,
    priority: PRIORITY,
    scene: normalizedScene,
    identity: {
      referenceRequired: true,
      masterReference: 'CLARA_REFERENCE_MASTER',
      approvedUgcReference: normalizedScene === SCENES.BEAUTY_UGC ? 'CLARA_BEAUTY_UGC_APPROVED_V1' : null,
      rejectOnIdentityDrift: true,
      rules: CLARA_IDENTITY_RULES,
    },
    product: {
      title: product.title || '',
      category: product.category || '',
      imageUrl: product.imageUrl || '',
      asin: product.asin || '',
      fidelity: 'HIGH',
      rules: [
        'Preserve the real product shape, color, proportions and recognizable details.',
        'Do not invent accessories, labels, compartments or product claims.',
        'Product fidelity is secondary only to Clara identity fidelity.',
      ],
    },
    sceneRules: SCENE_RULES[normalizedScene],
    notes: String(notes || '').trim(),
  };
}

function buildClaraUGCPrompt(input = {}) {
  const spec = buildClaraUGCSpec(input);
  return [
    'Create authentic UGC for Fancy by Roxette.',
    'PRIORITY ORDER: ' + spec.priority.join(' > ') + '.',
    'CLARA IDENTITY RULES:',
    ...spec.identity.rules.map(x => '- ' + x),
    'PRODUCT RULES:',
    ...spec.product.rules.map(x => '- ' + x),
    'GENERATION STRATEGY: ' + spec.generationStrategy + '.',
    spec.requiresRealBasePhoto ? 'REAL BASE PHOTO REQUIRED: preserve Clara identity/body and edit primarily the product or garment.' : '',
    'SCENE:',
    ...spec.sceneRules.map(x => '- ' + x),
    spec.product.title ? 'Product: ' + spec.product.title : '',
    spec.notes ? 'Additional direction: ' + spec.notes : '',
    'IDENTITY GATE: reject the result if Clara looks like a similar person rather than the reference person.',
    'Final result must feel like real creator content, not a polished catalog advertisement.',
  ].filter(Boolean).join('\n');
}

module.exports = {
  SCENES,
  PRIORITY,
  CLARA_IDENTITY_RULES,
  SCENE_RULES,
  GENERATION_STRATEGY,
  normalizeScene,
  buildClaraUGCSpec,
  buildClaraUGCPrompt,
};
