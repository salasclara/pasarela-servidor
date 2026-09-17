'use strict';

// FANCY EDITORIAL ALIGNMENT v1
// Pure, isolated semantic layer. No HTTP, DB, scheduler, Amazon or publishing side effects.

const FAMILY_RULES = Object.freeze({
  STYLE: Object.freeze({
    intentions: ['DISCOVERY', 'TREND', 'UPGRADE', 'GIFT'],
    productFamilies: ['occasion_dress', 'fashion_shoes', 'structured_handbag', 'jewelry', 'casual_chic', 'work_bag'],
    environment: ['fashion_lifestyle', 'closet', 'city', 'boutique'],
    forbidden: ['home_storage', 'home_decor', 'skincare', 'makeup', 'tech_accessory']
  }),
  BEAUTY: Object.freeze({
    intentions: ['DISCOVERY', 'PROBLEM_SOLVER', 'UPGRADE', 'GIFT'],
    productFamilies: ['skincare', 'makeup', 'beauty_tool', 'beauty_set'],
    environment: ['vanity', 'bathroom', 'beauty_counter', 'bedroom'],
    forbidden: ['handbag', 'jewelry', 'home_storage', 'home_decor', 'tech_accessory']
  }),
  HOME: Object.freeze({
    intentions: ['DISCOVERY', 'PROBLEM_SOLVER', 'UPGRADE', 'GIFT'],
    productFamilies: ['home_storage', 'home_decor', 'lighting', 'textile', 'mirror', 'decorative_candle', 'kitchen_organization'],
    environment: ['living_room', 'bedroom', 'bathroom', 'kitchen', 'home_office'],
    forbidden: ['handbag', 'wallet', 'jewelry', 'makeup', 'skincare', 'fashion_shoes']
  }),
  TECH: Object.freeze({
    intentions: ['DISCOVERY', 'PROBLEM_SOLVER', 'UPGRADE', 'GIFT'],
    productFamilies: ['tech_accessory', 'productivity_gadget', 'charging', 'desk_tech', 'travel_tech'],
    environment: ['home_office', 'desk', 'travel', 'modern_lifestyle'],
    forbidden: ['handbag', 'jewelry', 'makeup', 'skincare', 'home_decor']
  })
});

const PRIME_BIG_DEAL_DAYS = Object.freeze({
  enabled: false,
  event: 'PRIME_BIG_DEAL_DAYS',
  eventDates: ['2026-10-06', '2026-10-07'],
  intentionsWhenEnabled: ['DEAL', 'DISCOVERY', 'PROBLEM_SOLVER', 'UPGRADE', 'GIFT'],
  note: 'Prepared only. Must remain disabled until Amazon Creators API is eligible and product/deal data is verified.'
});

const CATEGORY_FAMILY_MAP = Object.freeze([
  [/vestidos|looks de ocasi[oó]n|tacones|zapatos|bolsos|carteras|joyer[ií]a|ropa casual|trabajo y oficina|bolsos de trabajo/i, 'STYLE'],
  [/maquillaje|belleza|skincare|piel|cosm[eé]tic|beauty/i, 'BEAUTY'],
  [/hogar|home|decor|organizaci[oó]n del hogar|cocina|living|s[aá]bana|toalla|l[aá]mpara|espejo/i, 'HOME'],
  [/tecnolog[ií]a|tech|digital|gadget|aud[ií]fono|smart|cargador/i, 'TECH']
]);

function normalizeFamily(value) {
  const family = String(value || '').trim().toUpperCase();
  return FAMILY_RULES[family] ? family : null;
}

function inferFamilyFromCategory(category) {
  const text = String(category && category.tema ? category.tema : category || '').trim();
  for (const [pattern, family] of CATEGORY_FAMILY_MAP) {
    if (pattern.test(text)) return family;
  }
  return null;
}

function validateEditorialAlignment(input) {
  const family = normalizeFamily(input && input.family) || inferFamilyFromCategory(input && input.category);
  if (!family) return { ok: false, reason: 'UNKNOWN_FAMILY' };

  const rules = FAMILY_RULES[family];
  const intention = String((input && input.intention) || '').toUpperCase();
  const productFamily = String((input && input.productFamily) || '').toLowerCase();
  const environment = String((input && input.environment) || '').toLowerCase();

  if (intention && !rules.intentions.includes(intention) && !(PRIME_BIG_DEAL_DAYS.enabled && intention === 'DEAL')) {
    return { ok: false, family, reason: 'INCOMPATIBLE_INTENTION', intention };
  }
  if (productFamily && !rules.productFamilies.includes(productFamily)) {
    return { ok: false, family, reason: 'INCOMPATIBLE_PRODUCT_FAMILY', productFamily };
  }
  if (environment && !rules.environment.includes(environment)) {
    return { ok: false, family, reason: 'INCOMPATIBLE_ENVIRONMENT', environment };
  }
  return { ok: true, family, intention: intention || null, productFamily: productFamily || null, environment: environment || null };
}

function buildEditorialDecision(family, intention, index = 0) {
  const normalized = normalizeFamily(family);
  if (!normalized) throw new Error('Unknown Fancy family: ' + family);
  const rules = FAMILY_RULES[normalized];
  const selectedIntention = String(intention || rules.intentions[index % rules.intentions.length]).toUpperCase();
  if (!rules.intentions.includes(selectedIntention) && !(PRIME_BIG_DEAL_DAYS.enabled && selectedIntention === 'DEAL')) {
    throw new Error('Incompatible intention ' + selectedIntention + ' for ' + normalized);
  }
  return Object.freeze({
    family: normalized,
    intention: selectedIntention,
    productFamily: rules.productFamilies[index % rules.productFamilies.length],
    environment: rules.environment[index % rules.environment.length],
    forbidden: rules.forbidden.slice(),
    primeMode: PRIME_BIG_DEAL_DAYS.enabled
  });
}

function buildAlignmentPreview() {
  const rows = [];
  for (const family of Object.keys(FAMILY_RULES)) {
    FAMILY_RULES[family].intentions.forEach((intention, index) => {
      const decision = buildEditorialDecision(family, intention, index);
      rows.push({ ...decision, validation: validateEditorialAlignment(decision) });
    });
  }
  return {
    ok: rows.every(row => row.validation.ok),
    version: '1.0',
    writesCatalog: false,
    connectedToScheduler: false,
    publishesContent: false,
    callsAmazon: false,
    primeBigDealDays: PRIME_BIG_DEAL_DAYS,
    decisions: rows
  };
}

module.exports = {
  FAMILY_RULES,
  PRIME_BIG_DEAL_DAYS,
  inferFamilyFromCategory,
  validateEditorialAlignment,
  buildEditorialDecision,
  buildAlignmentPreview
};
