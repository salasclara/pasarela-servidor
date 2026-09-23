'use strict';

const assert = require('assert');
const {
  SCENES,
  PRIORITY,
  buildClaraUGCSpec,
  buildClaraUGCPrompt,
} = require('../src/services/ClaraUGCEngine');

for (const scene of Object.values(SCENES)) {
  const spec = buildClaraUGCSpec({
    scene,
    product: { title: 'Test Product', category: 'TEST', asin: 'B000TEST00' },
  });
  assert.strictEqual(spec.mode, 'MANUAL_TEST_ONLY');
  assert.strictEqual(spec.role, 'REAL_CONTENT_PROCESSOR');
  assert.strictEqual(spec.generationStrategy, 'REAL_CLARA_PHOTO_PROCESSING');
  assert.strictEqual(spec.requiresRealClaraPhoto, true);
  assert.strictEqual(spec.requiresRealProduct, true);
  assert.strictEqual(spec.generateClaraFromScratch, false);
  assert.strictEqual(spec.publish, false);
  assert.strictEqual(spec.scheduler, false);
  assert.strictEqual(spec.identity.sourceOfTruth, 'REAL_CLARA_PHOTO');
  assert.strictEqual(spec.identity.rejectOnIdentityDrift, true);
  assert.deepStrictEqual(PRIORITY, ['IDENTITY', 'REAL_PRODUCT', 'AUTHENTICITY', 'PRESENTATION']);
  const prompt = buildClaraUGCPrompt({ scene });
  assert.ok(prompt.includes('PHOTO PROCESSING, not character generation'));
  assert.ok(prompt.includes('uploaded real Clara photo'));
}

assert.throws(() => buildClaraUGCSpec({ scene: 'INVALID' }), /Invalid CLARA UGC scene/);
console.log('CLARA UGC v1 real-content processor validation OK');
