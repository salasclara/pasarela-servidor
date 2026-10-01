'use strict';

/**
 * Fancy Rotation V1
 * Pure/dry-run rotation engine. No Facebook/Instagram publishing, no scheduler,
 * no Amazon API calls and no production state mutations.
 */

const CATEGORY_ORDER = ['BEAUTY', 'HOME', 'WELLNESS', 'TECH_TRAVEL'];

function normalizeCatalog(products) {
  if (!Array.isArray(products)) return [];
  return products
    .filter(p => p && p.active !== false && p.id && p.category)
    .map(p => ({ ...p, category: String(p.category).toUpperCase() }));
}

function buildRotation(products) {
  const catalog = normalizeCatalog(products);
  const buckets = new Map(CATEGORY_ORDER.map(c => [c, []]));
  for (const product of catalog) {
    if (!buckets.has(product.category)) buckets.set(product.category, []);
    buckets.get(product.category).push(product);
  }
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => Number(a.id) - Number(b.id));
  }

  const rotation = [];
  let remaining = catalog.length;
  let row = 0;
  while (remaining > 0) {
    let added = 0;
    for (const category of CATEGORY_ORDER) {
      const product = (buckets.get(category) || [])[row];
      if (product) {
        rotation.push(product);
        remaining--;
        added++;
      }
    }
    // Preserve any future categories without blocking V1.
    for (const [category, bucket] of buckets.entries()) {
      if (CATEGORY_ORDER.includes(category)) continue;
      const product = bucket[row];
      if (product) {
        rotation.push(product);
        remaining--;
        added++;
      }
    }
    if (!added) break;
    row++;
  }
  return rotation;
}

function getNextProduct(products, state = {}) {
  const rotation = buildRotation(products);
  if (!rotation.length) return { product: null, nextState: { index: 0, cycle: 0 } };

  const rawIndex = Number.isInteger(state.index) && state.index >= 0 ? state.index : 0;
  const cycle = Number.isInteger(state.cycle) && state.cycle >= 0 ? state.cycle : 0;
  const index = rawIndex % rotation.length;
  const product = rotation[index];

  const wraps = index === rotation.length - 1;
  return {
    product,
    position: index + 1,
    total: rotation.length,
    nextState: {
      index: wraps ? 0 : index + 1,
      cycle: wraps ? cycle + 1 : cycle
    }
  };
}

function previewRotation(products, count = 20) {
  const rotation = buildRotation(products);
  if (!rotation.length) return [];
  const limit = Math.max(0, Number(count) || 0);
  return Array.from({ length: limit }, (_, i) => {
    const p = rotation[i % rotation.length];
    return {
      step: i + 1,
      id: p.id,
      category: p.category,
      name: p.name || p.title || null
    };
  });
}

module.exports = {
  CATEGORY_ORDER,
  buildRotation,
  getNextProduct,
  previewRotation
};
