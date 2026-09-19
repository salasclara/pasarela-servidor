'use strict';
const assert = require('assert');
const { createFancyPublicationObserver } = require('../src/services/FancyPublicationObserver');

(async () => {
  let inserted = null;
  const pool = { query: async (sql, values) => {
    if (/INSERT INTO fancy_analytics_observations/.test(sql)) {
      inserted = { sql, values };
      return { rows: [{ id: 2, created_at: '2026-09-19T01:00:00.000Z' }] };
    }
    return { rows: [] };
  }};
  const observer = createFancyPublicationObserver(pool);
  const saved = await observer.observeFacebookPublication({
    tipoEditorial: 'HOME_FIND',
    category: 'home decor',
    intention: 'organizar',
    visualStrategy: 'NO_MODEL',
    headline: 'TU ESPACIO, MÁS FANCY',
    microtext: 'detalles que transforman',
    externalPostId: 'fb-test-1',
    affiliateUrlPresent: true,
  });
  assert.strictEqual(saved.id, 2);
  assert(inserted);
  const json = inserted.values[23];
  assert.strictEqual(typeof json, 'string');
  const observation = JSON.parse(json);
  assert.strictEqual(observation.schemaVersion, 'fancy.analytics.observation.v1');
  assert.strictEqual(observation.mode, 'OBSERVATION');
  assert.strictEqual(observation.publication.channel, 'facebook');
  assert.strictEqual(observation.publication.status, 'published');
  assert.strictEqual(observation.publication.externalPostId, 'fb-test-1');
  assert.strictEqual(observation.safeguards.learningEnabled, false);
  console.log('Fancy real publication observer validation: OK');
})().catch(e => { console.error(e); process.exit(1); });
