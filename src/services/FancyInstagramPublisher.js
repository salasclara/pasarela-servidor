'use strict';

// Fancy Instagram Publisher v1
// ISOLATED: not connected to server.js, scheduler, catalog, Amazon, or Facebook publisher.
// Uses the standard Instagram content-publishing flow: create media container, then publish it.

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v26.0';
const GRAPH_HOST = 'https://graph.facebook.com';

function getInstagramConfig() {
  return Object.freeze({
    instagramUserId: process.env.FANCY_INSTAGRAM_USER_ID || null,
    accessTokenPresent: Boolean(process.env.FANCY_BY_TOKEN),
    graphVersion: GRAPH_VERSION
  });
}

function validateInstagramConfig() {
  const config = getInstagramConfig();
  const missing = [];
  if (!config.instagramUserId) missing.push('FANCY_INSTAGRAM_USER_ID');
  if (!config.accessTokenPresent) missing.push('FANCY_BY_TOKEN');
  return Object.freeze({ ok: missing.length === 0, missing, config });
}

async function graphPost(path, params, fetchImpl = global.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('FETCH_UNAVAILABLE');
  const body = new URLSearchParams(params);
  const response = await fetchImpl(`${GRAPH_HOST}/${GRAPH_VERSION}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    const error = new Error(data?.error?.message || `META_HTTP_${response.status}`);
    error.meta = data?.error || data;
    error.status = response.status;
    throw error;
  }
  return data;
}

async function createImageContainer({ imageUrl, caption, fetchImpl } = {}) {
  const check = validateInstagramConfig();
  if (!check.ok) return { ok: false, stage: 'CONFIG', missing: check.missing };
  if (!imageUrl || !/^https:\/\//i.test(imageUrl)) {
    return { ok: false, stage: 'INPUT', error: 'PUBLIC_HTTPS_IMAGE_URL_REQUIRED' };
  }

  const data = await graphPost(`${check.config.instagramUserId}/media`, {
    image_url: imageUrl,
    caption: String(caption || ''),
    access_token: process.env.FANCY_BY_TOKEN
  }, fetchImpl);

  return { ok: true, stage: 'CONTAINER_CREATED', creationId: data.id };
}

async function publishContainer({ creationId, fetchImpl } = {}) {
  const check = validateInstagramConfig();
  if (!check.ok) return { ok: false, stage: 'CONFIG', missing: check.missing };
  if (!creationId) return { ok: false, stage: 'INPUT', error: 'CREATION_ID_REQUIRED' };

  const data = await graphPost(`${check.config.instagramUserId}/media_publish`, {
    creation_id: creationId,
    access_token: process.env.FANCY_BY_TOKEN
  }, fetchImpl);

  return { ok: true, stage: 'PUBLISHED', mediaId: data.id };
}

async function publishInstagramImage({ imageUrl, caption, fetchImpl } = {}) {
  const container = await createImageContainer({ imageUrl, caption, fetchImpl });
  if (!container.ok) return container;
  return publishContainer({ creationId: container.creationId, fetchImpl });
}

module.exports = {
  getInstagramConfig,
  validateInstagramConfig,
  createImageContainer,
  publishContainer,
  publishInstagramImage
};
