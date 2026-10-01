'use strict';

const assert = require('assert');
const {
  getFancyRotationState,
  saveFancyRotationState
} = require('../services/FancyRotationStateV1');

function createMemoryPool() {
  let row = null;
  return {
    async query(sql, params = []) {
      if (/CREATE TABLE/i.test(sql)) return { rows: [] };
      if (/SELECT rotation_key/i.test(sql)) return { rows: row ? [row] : [] };
      if (/INSERT INTO fancy_rotation_state/i.test(sql)) {
        row = {
          rotation_key: params[0],
          next_index: params[1],
          cycle: params[2],
          last_product_id: params[3],
          updated_at: new Date().toISOString()
        };
        return { rows: [row] };
      }
      throw new Error('Unexpected SQL in test');
    }
  };
}

(async () => {
  const pool = createMemoryPool();

  const initial = await getFancyRotationState(pool);
  assert.strictEqual(initial.index, 0);
  assert.strictEqual(initial.cycle, 0);
  assert.strictEqual(initial.lastProductId, null);

  await saveFancyRotationState(pool, { index: 4, cycle: 0 }, 16);

  // Simulate a process restart: no in-memory cursor is reused.
  const afterRestart = await getFancyRotationState(pool);
  assert.strictEqual(afterRestart.index, 4);
  assert.strictEqual(afterRestart.cycle, 0);
  assert.strictEqual(afterRestart.lastProductId, 16);

  await saveFancyRotationState(pool, { index: 0, cycle: 1 }, 20);
  const nextCycle = await getFancyRotationState(pool);
  assert.strictEqual(nextCycle.index, 0);
  assert.strictEqual(nextCycle.cycle, 1);
  assert.strictEqual(nextCycle.lastProductId, 20);

  console.log(JSON.stringify({
    ok: true,
    persistenceSimulation: true,
    restartContinuesAtIndex: afterRestart.index,
    cycleWrapPersists: nextCycle.cycle,
    publishesContent: false
  }));
})().catch(err => {
  console.error(err);
  process.exit(1);
});
