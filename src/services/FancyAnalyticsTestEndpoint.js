'use strict';

const { createFancyAnalyticsProduction } = require('./FancyAnalyticsProduction');

/**
 * Controlled manual endpoint for Fancy Analytics.
 *
 * GET  /test-fancy-analytics-persistence -> readiness only, NO write.
 * POST /test-fancy-analytics-persistence -> inserts ONE controlled test row.
 * GET  /test-fancy-analytics-persistence/write-once -> browser-friendly controlled insert.
 *
 * This handler is not connected to scheduler, Facebook, Instagram or Amazon.
 */
function createFancyAnalyticsTestHandler(pool) {
  const analytics = createFancyAnalyticsProduction(pool);

  return async function handleFancyAnalyticsTest(req, res) {
    const readinessPath = '/test-fancy-analytics-persistence';
    const writeOncePath = '/test-fancy-analytics-persistence/write-once';
    if (req.url !== readinessPath && req.url !== writeOncePath) return false;

    res.setHeader('Content-Type', 'application/json');

    try {
      if (req.method === 'GET' && req.url === writeOncePath) {
        const result = await analytics.saveControlledTest();
        res.writeHead(200);
        res.end(JSON.stringify({ ...result, browserControlledWrite: true }));
        return true;
      }

      if (req.method === 'GET') {
        await analytics.ensureReady();
        res.writeHead(200);
        res.end(JSON.stringify({
          ok: true,
          ready: true,
          table: 'fancy_analytics_observations',
          writesObservation: false,
          usePostToInsertControlledTest: true,
          schedulerConnected: false,
          publishesContent: false,
          amazonConnected: false,
          learningEnabled: false,
        }));
        return true;
      }

      if (req.method === 'POST') {
        const result = await analytics.saveControlledTest();
        res.writeHead(200);
        res.end(JSON.stringify(result));
        return true;
      }

      res.writeHead(405, { Allow: 'GET, POST' });
      res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
      return true;
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({
        ok: false,
        error: error.message,
        schedulerConnected: false,
        publishesContent: false,
        amazonConnected: false,
        learningEnabled: false,
      }));
      return true;
    }
  };
}

module.exports = { createFancyAnalyticsTestHandler };
