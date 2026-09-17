'use strict';

// FANCY ALIGNMENT OBSERVER v1.1
// Observation only: never blocks, publishes, writes DB/catalog, or calls Amazon/Facebook.

const {
  inferFamilyFromCategory,
  validateEditorialAlignment
} = require('./FancyEditorialAlignment');

const TYPE_TO_FAMILY = Object.freeze({
  FASHION_PICK: 'STYLE',
  HOW_TO_STYLE: 'STYLE',
  BEAUTY_FIND: 'BEAUTY',
  HOME_FIND: 'HOME',
  TECH_FIND: 'TECH'
});

const INTENTION_MAP = Object.freeze({
  DISCOVER_FANCY: 'DISCOVERY',
  FASHION_PICK: 'TREND',
  HOW_TO_STYLE: 'UPGRADE',
  BEAUTY_FIND: 'DISCOVERY',
  HOME_FIND: 'PROBLEM_SOLVER',
  TECH_FIND: 'PROBLEM_SOLVER',
  GIFT_IDEA: 'GIFT',
  ESSENTIAL: 'UPGRADE'
});

function normalizeToken(value) {
  return String(value || '').trim();
}

function observeFancyAlignment(input = {}) {
  const tipoEditorial = normalizeToken(input.tipoEditorial).toUpperCase();
  const category = input.category || input.categoria || null;
  const inferredFromCategory = inferFamilyFromCategory(category);
  const expectedFamily = TYPE_TO_FAMILY[tipoEditorial] || inferredFromCategory || null;
  const categoryFamily = inferredFromCategory;
  const intention = normalizeToken(input.intention || INTENTION_MAP[tipoEditorial]).toUpperCase() || null;
  const productFamily = normalizeToken(input.productFamily).toLowerCase() || null;
  const environment = normalizeToken(input.environment).toLowerCase() || null;

  let validation;
  if (!expectedFamily) {
    validation = { ok: false, reason: 'UNKNOWN_FAMILY' };
  } else if (categoryFamily && TYPE_TO_FAMILY[tipoEditorial] && categoryFamily !== expectedFamily) {
    validation = {
      ok: false,
      family: expectedFamily,
      reason: 'CATEGORY_FAMILY_MISMATCH',
      categoryFamily
    };
  } else if (!categoryFamily && category && TYPE_TO_FAMILY[tipoEditorial]) {
    validation = {
      ok: false,
      family: expectedFamily,
      reason: 'AMBIGUOUS_CATEGORY'
    };
  } else {
    validation = validateEditorialAlignment({
      family: expectedFamily,
      intention,
      productFamily,
      environment
    });
  }

  return Object.freeze({
    mode: 'OBSERVE',
    wouldBlock: !validation.ok,
    tipoEditorial: tipoEditorial || null,
    category: category && category.tema ? category.tema : category,
    expectedFamily,
    categoryFamily,
    intention,
    productFamily,
    environment,
    validation,
    sideEffects: Object.freeze({
      blocksPublishing: false,
      writesCatalog: false,
      writesDatabase: false,
      callsAmazon: false,
      callsFacebook: false
    })
  });
}

function formatFancyAlignmentObservation(observation) {
  const status = observation.wouldBlock ? 'WOULD_BLOCK' : 'VALID';
  const reason = observation.validation && observation.validation.reason
    ? ` | reason=${observation.validation.reason}`
    : '';
  return `[FancyAlignment][OBSERVE] ${status} | tipo=${observation.tipoEditorial || '-'} | family=${observation.expectedFamily || '-'} | category=${observation.category || '-'} | intention=${observation.intention || '-'}${reason}`;
}

module.exports = {
  TYPE_TO_FAMILY,
  INTENTION_MAP,
  observeFancyAlignment,
  formatFancyAlignmentObservation
};
