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
    product: { title: 'Test Product', category: 'BEAUTY', asin: 'B000TEST00' },
  });
  assert.strictEqual(spec.mode, 'MANUAL_TEST_ONLY');
  assert.strictEqual(spec.publish, false);
  assert.strictEqual(spec.scheduler, false);
  assert.strictEqual(spec.identity.referenceRequired, true);
  assert.deepStrictEqual(PRIORITY, ['IDENTITY', 'PRODUCT', 'SCENE', 'DECORATION']);
  assert.ok(buildClaraUGCPrompt({ scene }).includes('IDENTITY > PRODUCT > SCENE > DECORATION'));
}

const beauty = buildClaraUGCSpec({ scene: 'BEAUTY_UGC' });
assert.strictEqual(beauty.generationStrategy, 'REFERENCE_GUIDED_GENERATION');
assert.strictEqual(beauty.requiresRealBasePhoto, false);

const style = buildClaraUGCSpec({ scene: 'STYLE_UGC' });
assert.strictEqual(style.generationStrategy, 'REAL_PHOTO_EDIT_IDENTITY_PRESERVATION');
assert.strictEqual(style.requiresRealBasePhoto, true);
assert.ok(buildClaraUGCPrompt({ scene: 'STYLE_UGC' }).includes('REAL BASE PHOTO REQUIRED'));

assert.throws(() => buildClaraUGCSpec({ scene: 'INVALID' }), /Invalid CLARA UGC scene/);
console.log('CLARA UGC v1 validation OK');
