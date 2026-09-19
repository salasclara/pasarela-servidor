'use strict';

const { createFancyAnalyticsReader } = require('./FancyAnalyticsReader');

function createFancyAnalyticsSummaryHandler(pool) {
  const reader = createFancyAnalyticsReader(pool);

  return async function handleFancyAnalyticsSummary(req, res) {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8', 'Allow': 'GET' });
      res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }));
      return true;
    }
    try {
      const summary = await reader.getSummary();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: true, ...summary }));
    } catch (error) {
      console.error('[Fancy Analytics Summary] Error:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'Fancy Analytics summary unavailable' }));
    }
    return true;
  };
}

module.exports = { createFancyAnalyticsSummaryHandler };
