'use strict';

const assert = require('assert');
const products = require('../data/fancy-approved-products-v1.json');
const { buildRotation, getNextProduct, previewRotation } = require('../services/FancyRotationV1');

const expectedIds = [
  1, 6, 11, 16,
  2, 7, 12, 17,
  3, 8, 13, 18,
  4, 9, 14, 19,
  5, 10, 15, 20
];

const rotation = buildRotation(products);
assert.strictEqual(rotation.length, 20);
assert.deepStrictEqual(rotation.map(p => Number(p.id)), expectedIds);

let state = { index: 0, cycle: 0 };
const seen = [];
for (let i = 0; i < 20; i++) {
  const next = getNextProduct(products, state);
  seen.push(Number(next.product.id));
  state = next.nextState;
}
assert.deepStrictEqual(seen, expectedIds);
assert.deepStrictEqual(state, { index: 0, cycle: 1 });

const nextCycle = getNextProduct(products, state);
assert.strictEqual(Number(nextCycle.product.id), 1);

console.log(JSON.stringify({
  ok: true,
  publishesContent: false,
  productCount: products.length,
  firstCycle: previewRotation(products, 20),
  stateAfterFirstCycle: state,
  firstProductSecondCycle: nextCycle.product.id
}, null, 2));
