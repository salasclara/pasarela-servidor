'use strict';

const {
  PRIME_BIG_DEAL_DAYS,
  inferFamilyFromCategory,
  validateEditorialAlignment,
  buildAlignmentPreview
} = require('../src/services/FancyEditorialAlignment');

const cases = [
  { name: 'HOME decor valid', input: { family: 'HOME', intention: 'UPGRADE', productFamily: 'home_decor', environment: 'living_room' }, expect: true },
  { name: 'BEAUTY skincare valid', input: { family: 'BEAUTY', intention: 'DISCOVERY', productFamily: 'skincare', environment: 'vanity' }, expect: true },
  { name: 'STYLE shoes valid', input: { family: 'STYLE', intention: 'TREND', productFamily: 'fashion_shoes', environment: 'city' }, expect: true },
  { name: 'TECH accessory valid', input: { family: 'TECH', intention: 'PROBLEM_SOLVER', productFamily: 'tech_accessory', environment: 'home_office' }, expect: true },
  { name: 'HOME handbag blocked', input: { family: 'HOME', intention: 'UPGRADE', productFamily: 'structured_handbag', environment: 'living_room' }, expect: false, reason: 'INCOMPATIBLE_PRODUCT_FAMILY' },
  { name: 'HOME makeup blocked', input: { family: 'HOME', intention: 'DISCOVERY', productFamily: 'makeup', environment: 'bathroom' }, expect: false, reason: 'INCOMPATIBLE_PRODUCT_FAMILY' },
  { name: 'BEAUTY home decor blocked', input: { family: 'BEAUTY', intention: 'UPGRADE', productFamily: 'home_decor', environment: 'vanity' }, expect: false, reason: 'INCOMPATIBLE_PRODUCT_FAMILY' },
  { name: 'TECH jewelry blocked', input: { family: 'TECH', intention: 'GIFT', productFamily: 'jewelry', environment: 'desk' }, expect: false, reason: 'INCOMPATIBLE_PRODUCT_FAMILY' },
  { name: 'Prime DEAL remains blocked', input: { family: 'HOME', intention: 'DEAL', productFamily: 'home_decor', environment: 'living_room' }, expect: false, reason: 'INCOMPATIBLE_INTENTION' }
];

const results = cases.map(test => {
  const result = validateEditorialAlignment(test.input);
  const pass = result.ok === test.expect && (!test.reason || result.reason === test.reason);
  return { name: test.name, pass, expectedOk: test.expect, result };
});

const preview = buildAlignmentPreview();
const inference = {
  home: inferFamilyFromCategory('organización del hogar'),
  beauty: inferFamilyFromCategory('skincare y rutina de piel'),
  style: inferFamilyFromCategory('tacones y zapatos de tendencia'),
  tech: inferFamilyFromCategory('tecnología útil y accesorios digitales'),
  giftForHer: inferFamilyFromCategory('regalo para ella')
};

const report = {
  ok: results.every(r => r.pass) && preview.ok && PRIME_BIG_DEAL_DAYS.enabled === false && inference.giftForHer === null,
  version: '1.0',
  safety: {
    writesCatalog: false,
    connectedToScheduler: false,
    publishesContent: false,
    callsAmazon: false
  },
  primeModeEnabled: PRIME_BIG_DEAL_DAYS.enabled,
  inference,
  tests: results,
  previewOk: preview.ok,
  previewDecisions: preview.decisions.length
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
