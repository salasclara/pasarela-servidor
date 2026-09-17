'use strict';

const { publishInstagramImage, validateInstagramConfig } = require('./FancyInstagramPublisher');

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function handleFancyInstagramTestEndpoint(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (req.method !== 'GET' || url.pathname !== '/test-fancy-instagram-publish') return false;

  const check = validateInstagramConfig();
  if (!check.ok) {
    json(res, 200, { ok: false, stage: 'CONFIG', missing: check.missing, publishesAutomatically: false });
    return true;
  }

  const imageUrl = url.searchParams.get('image');
  if (!imageUrl) {
    json(res, 200, {
      ok: true,
      ready: true,
      stage: 'READY',
      instagramUserId: check.config.instagramUserId,
      requiresImage: true,
      publishesAutomatically: false,
      schedulerConnected: false
    });
    return true;
  }

  const caption = url.searchParams.get('caption') || 'Prueba controlada de publicación — Fancy by Roxette ✨';
  try {
    const result = await publishInstagramImage({ imageUrl, caption });
    json(res, result.ok ? 200 : 400, { ...result, controlledTest: true, schedulerConnected: false });
  } catch (error) {
    json(res, 502, {
      ok: false,
      stage: 'META',
      error: error.message,
      meta: error.meta || null,
      controlledTest: true,
      schedulerConnected: false
    });
  }
  return true;
}

module.exports = { handleFancyInstagramTestEndpoint };
