'use strict';
const assert=require('node:assert/strict');
const {slotKey}=require('../src/services/FancySlotReservationPreviewV1');
assert.equal(slotKey(new Date('2026-11-18T15:05:00Z')),'fancy:2026-11-18:09');
assert.equal(slotKey(new Date('2026-07-18T14:05:00Z')),'fancy:2026-07-18:09');
assert.equal(slotKey(new Date('2026-11-19T03:05:00Z')),'fancy:2026-11-18:21');
assert.throws(()=>slotKey(new Date('2026-11-18T15:10:00Z')),/window/);
assert.throws(()=>slotKey(new Date('2026-11-18T16:05:00Z')),/window/);
console.log('Horarios centrales y horario de verano verificados');

