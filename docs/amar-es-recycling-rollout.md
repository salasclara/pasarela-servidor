# Amar Es recycling — safe integration checklist

Status: **WIRED BUT NOT ENABLED**. The branch connects the weekday gate to `server.js`, but the flag defaults to off; no production changes have been merged.

## Existing deployment behavior
- Shared scheduler runs at 09:00, 15:00 and 21:00 Dallas time.
- Existing code limits Amar Es, Maravillas del Reino and Pasarela to the 09:00 cycle.
- Other page schedules remain unchanged.

## Wiring implemented in `server.js` (on this branch only)
1. Implemented: after creating `pool`, initialize `createAmarEsWeekdayGate(pool)` from `./src/services/AmarEsWeekdayGate`.
2. Implemented: at the very start of `publicarCoverParaPagina` (inside its `try`, **before any Claude or image API call**), execute `if (await handleAmarEsWeekday(pageConfig)) return;`.
3. Keep `AMAR_ES_REUSE_ENABLED` unset or `false` until all tests pass.
4. Do not use `/test-amar-es` as a dry run: that endpoint actually publishes.

## Before enabling
- Run `node src/tests/amarEsRecycler.test.js`
- Run `node src/tests/amarEsWeekdayGate.test.js`
- Run `node src/tests/amarEsRecyclerTransactions.test.js`
- Confirm the existing `PASARELA_PG` connection and table permissions.
- Confirm Facebook Page token supports reading posts and publishing photos.
- Verify that imported photo URLs remain accessible to Facebook for republishing; if not, use durable media storage or re-fetch media.
- Test import and selection without publishing to Facebook.
- Ensure the database contains at least 90 eligible distinct photos to guarantee daily recycling without repeats over 90 days. With fewer items, weekdays may intentionally skip.
- Review logging to ensure Page access tokens are never emitted.
- Verify Railway deploys are functioning and the scheduler runs only once per intended day.

## Safety and limitations
- Recycling republishes previous images and captions; it does not generate new AI content on weekdays.
- Existing imported posts may have expiring image URLs. Publishing by URL requires validation.
- On a Facebook publish failure, the DB reservation is rolled back. A network failure after Facebook accepts the post can still lead to duplicate retries; add an idempotency reconciliation strategy before production. A database daily lock prevents ordinary concurrent duplicate runs, but cannot prove Facebook did not publish after a timeout.
- The initial import only runs automatically when the table is empty; a refresh mechanism is needed as the library grows.
- This is not yet production-ready. The integration exists on the branch; do not merge this PR until tests and Facebook read/publish behavior are verified.
