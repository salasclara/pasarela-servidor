'use strict';
const { createFancyAnalyticsHistoryReader } = require('./FancyAnalyticsHistory');

function createFancyAnalyticsHistoryHandler(pool) {
  const reader = createFancyAnalyticsHistoryReader(pool);
  return async function handleFancyAnalyticsHistory(req, res) {
    if (req.method !== 'GET') {
      res.writeHead(405, {'Content-Type':'application/json; charset=utf-8','Allow':'GET'});
      res.end(JSON.stringify({ok:false,error:'Method Not Allowed'}));
      return true;
    }
    try {
      const url = new URL(req.url, 'http://localhost');
      const history = await reader.getHistory({
        days: Number(url.searchParams.get('days')) || 30,
        limit: Number(url.searchParams.get('limit')) || 50
      });
      res.writeHead(200, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
      res.end(JSON.stringify({ok:true,...history}));
    } catch (error) {
      console.error('[Fancy Analytics History] Error:', error.message);
      res.writeHead(500, {'Content-Type':'application/json; charset=utf-8'});
      res.end(JSON.stringify({ok:false,error:'Fancy Analytics history unavailable'}));
    }
    return true;
  };
}
module.exports={createFancyAnalyticsHistoryHandler};
