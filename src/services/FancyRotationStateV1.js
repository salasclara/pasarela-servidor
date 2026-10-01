'use strict';

/**
 * Fancy Rotation State V1
 * Persists only the cursor/cycle for the approved Fancy rotation.
 * It does not publish and is intentionally independent from the scheduler.
 */

const STATE_KEY = 'approved-products-v1';

async function ensureFancyRotationStateTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fancy_rotation_state (
      rotation_key TEXT PRIMARY KEY,
      next_index INTEGER NOT NULL DEFAULT 0 CHECK (next_index >= 0),
      cycle INTEGER NOT NULL DEFAULT 0 CHECK (cycle >= 0),
      last_product_id INTEGER,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getFancyRotationState(pool, rotationKey = STATE_KEY) {
  await ensureFancyRotationStateTable(pool);
  const { rows } = await pool.query(
    `SELECT rotation_key, next_index, cycle, last_product_id, updated_at
       FROM fancy_rotation_state
      WHERE rotation_key = $1`,
    [rotationKey]
  );
  if (!rows.length) {
    return { rotationKey, index: 0, cycle: 0, lastProductId: null, updatedAt: null };
  }
  const r = rows[0];
  return {
    rotationKey: r.rotation_key,
    index: Number(r.next_index),
    cycle: Number(r.cycle),
    lastProductId: r.last_product_id == null ? null : Number(r.last_product_id),
    updatedAt: r.updated_at
  };
}

async function saveFancyRotationState(pool, state, lastProductId, rotationKey = STATE_KEY) {
  await ensureFancyRotationStateTable(pool);
  const index = Number.isInteger(state?.index) && state.index >= 0 ? state.index : 0;
  const cycle = Number.isInteger(state?.cycle) && state.cycle >= 0 ? state.cycle : 0;
  const { rows } = await pool.query(
    `INSERT INTO fancy_rotation_state
       (rotation_key, next_index, cycle, last_product_id, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (rotation_key) DO UPDATE SET
       next_index = EXCLUDED.next_index,
       cycle = EXCLUDED.cycle,
       last_product_id = EXCLUDED.last_product_id,
       updated_at = NOW()
     RETURNING rotation_key, next_index, cycle, last_product_id, updated_at`,
    [rotationKey, index, cycle, lastProductId == null ? null : Number(lastProductId)]
  );
  return rows[0];
}

module.exports = {
  STATE_KEY,
  ensureFancyRotationStateTable,
  getFancyRotationState,
  saveFancyRotationState
};
