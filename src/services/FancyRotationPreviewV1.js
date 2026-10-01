'use strict';

/**
 * Fancy Rotation Preview V1
 * Dry-run only. Never publishes.
 * Intentionally blocks readiness until an approved editorial copy is present.
 */

const { getNextProduct } = require('./FancyRotationV1');

function buildFancyPreview(products, state = {}) {
  const selection = getNextProduct(products, state);
  if (!selection.product) {
    return {
      ok: false,
      publish: false,
      readyToPublish: false,
      reason: 'EMPTY_CATALOG',
      nextState: selection.nextState
    };
  }

  const p = selection.product;
  const missing = [];
  if (!p.cardPath) missing.push('cardPath');
  if (!p.affiliateUrl) missing.push('affiliateUrl');
  if (!p.approvedCopy) missing.push('approvedCopy');

  return {
    ok: true,
    publish: false,
    readyToPublish: missing.length === 0,
    missing,
    rotation: {
      position: selection.position,
      total: selection.total,
      nextState: selection.nextState
    },
    product: {
      id: p.id,
      category: p.category,
      name: p.name || p.title || null,
      cardPath: p.cardPath || null,
      affiliateUrl: p.affiliateUrl || null,
      approvedCopy: p.approvedCopy || null
    }
  };
}

module.exports = { buildFancyPreview };
