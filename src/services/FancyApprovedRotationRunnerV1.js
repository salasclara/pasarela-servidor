'use strict';

const { getNextProduct } = require('./FancyRotationV1');
const { getFancyRotationState, saveFancyRotationState } = require('./FancyRotationStateV1');
const { publishApprovedFancyProduct } = require('./FancyApprovedFacebookPublisherV1');

/**
 * Fancy approved rotation runner.
 * Advances persistent state ONLY after Facebook confirms a successful publish.
 * No scheduler, AI generation, Instagram, or Amazon API calls.
 */
async function previewNextApprovedFancyProduct({ pool, products }) {
  const state = await getFancyRotationState(pool);
  const selection = getNextProduct(products, state);
  return {
    ok: true,
    publish: false,
    state,
    next: selection.product ? {
      id: selection.product.id,
      name: selection.product.name,
      category: selection.product.category,
      position: selection.position,
      total: selection.total
    } : null,
    nextStateAfterSuccess: selection.nextState
  };
}

async function publishNextApprovedFancyProduct({ pool, products, pageId, pageToken, repoRoot }) {
  const state = await getFancyRotationState(pool);
  const selection = getNextProduct(products, state);
  if (!selection.product) throw new Error('No hay productos Fancy activos en la rotación');

  const published = await publishApprovedFancyProduct({
    products,
    productId: selection.product.id,
    pageId,
    pageToken,
    repoRoot
  });

  if (!published || published.ok !== true || !published.facebookPostId) {
    throw new Error('Facebook no confirmó la publicación; el cursor Fancy no avanzó');
  }

  const saved = await saveFancyRotationState(
    pool,
    selection.nextState,
    selection.product.id
  );

  return {
    ...published,
    rotation: {
      publishedPosition: selection.position,
      total: selection.total,
      nextIndex: Number(saved.next_index),
      cycle: Number(saved.cycle),
      lastProductId: Number(saved.last_product_id)
    }
  };
}

module.exports = {
  previewNextApprovedFancyProduct,
  publishNextApprovedFancyProduct
};
