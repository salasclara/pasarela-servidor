'use strict';

const assert = require('assert');
const publisher = require('../src/services/FancyInstagramPublisher');

async function run() {
  const oldId = process.env.FANCY_INSTAGRAM_USER_ID;
  const oldToken = process.env.FANCY_BY_TOKEN;

  try {
    delete process.env.FANCY_INSTAGRAM_USER_ID;
    delete process.env.FANCY_BY_TOKEN;
    const missing = publisher.validateInstagramConfig();
    assert.equal(missing.ok, false);
    assert(missing.missing.includes('FANCY_INSTAGRAM_USER_ID'));
    assert(missing.missing.includes('FANCY_BY_TOKEN'));

    process.env.FANCY_INSTAGRAM_USER_ID = '17841400000000000';
    process.env.FANCY_BY_TOKEN = 'test-token';

    const calls = [];
    const fakeFetch = async (url, options) => {
      calls.push({ url, body: String(options.body) });
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: calls.length === 1 ? 'creation-123' : 'media-456' })
      };
    };

    const invalid = await publisher.createImageContainer({ imageUrl: 'file:///tmp/image.png', caption: 'x', fetchImpl: fakeFetch });
    assert.equal(invalid.ok, false);
    assert.equal(invalid.error, 'PUBLIC_HTTPS_IMAGE_URL_REQUIRED');

    const result = await publisher.publishInstagramImage({
      imageUrl: 'https://example.com/fancy-test.png',
      caption: 'Fancy isolated test',
      fetchImpl: fakeFetch
    });

    assert.equal(result.ok, true);
    assert.equal(result.stage, 'PUBLISHED');
    assert.equal(result.mediaId, 'media-456');
    assert.equal(calls.length, 2);
    assert(calls[0].url.includes('/17841400000000000/media'));
    assert(calls[1].url.includes('/17841400000000000/media_publish'));

    console.log(JSON.stringify({
      ok: true,
      tests: 4,
      callsMeta: false,
      publishesInstagram: false,
      connectedToScheduler: false,
      changesServerJs: false
    }, null, 2));
  } finally {
    if (oldId === undefined) delete process.env.FANCY_INSTAGRAM_USER_ID; else process.env.FANCY_INSTAGRAM_USER_ID = oldId;
    if (oldToken === undefined) delete process.env.FANCY_BY_TOKEN; else process.env.FANCY_BY_TOKEN = oldToken;
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
