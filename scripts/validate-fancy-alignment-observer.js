'use strict';

const { observeFancyAlignment } = require('../src/services/FancyAlignmentObserver');

const tests = [
  {
    name: 'HOME coherent category is valid',
    input: { tipoEditorial: 'HOME_FIND', category: 'organización del hogar', productFamily: 'home_storage', environment: 'kitchen' },
    expectedBlock: false
  },
  {
    name: 'Historic HOME gift mismatch is observed',
    input: { tipoEditorial: 'HOME_FIND', category: 'regalo para ella' },
    expectedBlock: true,
    expectedReason: 'AMBIGUOUS_CATEGORY'
  },
  {
    name: 'HOME handbag is observed as incompatible',
    input: { tipoEditorial: 'HOME_FIND', category: 'organización del hogar', productFamily: 'structured_handbag', environment: 'living_room' },
    expectedBlock: true,
    expectedReason: 'INCOMPATIBLE_PRODUCT_FAMILY'
  },
  {
    name: 'BEAUTY skincare is valid',
    input: { tipoEditorial: 'BEAUTY_FIND', category: 'skincare y rutina de piel', productFamily: 'skincare', environment: 'vanity' },
    expectedBlock: false
  },
  {
    name: 'STYLE shoes are valid',
    input: { tipoEditorial: 'FASHION_PICK', category: 'tacones y zapatos de tendencia', productFamily: 'fashion_shoes', environment: 'city' },
    expectedBlock: false
  },
  {
    name: 'Observer never blocks publishing itself',
    input: { tipoEditorial: 'HOME_FIND', category: 'regalo para ella' },
    expectedBlock: true,
    assertNoSideEffects: true
  }
];

const results = tests.map(test => {
  const observation = observeFancyAlignment(test.input);
  const reasonOk = !test.expectedReason || observation.validation.reason === test.expectedReason;
  const sideEffectsOk = !test.assertNoSideEffects || (
    observation.sideEffects.blocksPublishing === false &&
    observation.sideEffects.writesCatalog === false &&
    observation.sideEffects.writesDatabase === false &&
    observation.sideEffects.callsAmazon === false &&
    observation.sideEffects.callsFacebook === false
  );
  return {
    name: test.name,
    pass: observation.wouldBlock === test.expectedBlock && reasonOk && sideEffectsOk,
    observation
  };
});

const report = {
  ok: results.every(result => result.pass),
  mode: 'OBSERVE',
  tests: results
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
