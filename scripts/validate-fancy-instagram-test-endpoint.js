'use strict';

const assert = require('assert');

process.env.FANCY_INSTAGRAM_USER_ID = '17841472188694897';
process.env.FANCY_BY_TOKEN = 'test-token';

const { handleFancyInstagramTestEndpoint } = require('../src/services/FancyInstagramTestEndpoint');

function mockRes() {
  return {
    status: null,
    headers: null,
    body: '',
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(body) { this.body = body || ''; }
  };
}

(async () => {
  const ignored = mockRes();
  assert.strictEqual(await handleFancyInstagramTestEndpoint({ method:'GET', url:'/other' }, ignored), false);

  const ready = mockRes();
  assert.strictEqual(await handleFancyInstagramTestEndpoint({ method:'GET', url:'/test-fancy-instagram-publish' }, ready), true);
  assert.strictEqual(ready.status, 200);
  const data = JSON.parse(ready.body);
  assert.strictEqual(data.ok, true);
  assert.strictEqual(data.ready, true);
  assert.strictEqual(data.stage, 'READY');
  assert.strictEqual(data.instagramUserId, '17841472188694897');
  assert.strictEqual(data.requiresImage, true);
  assert.strictEqual(data.publishesAutomatically, false);
  assert.strictEqual(data.schedulerConnected, false);

  console.log('Fancy Instagram controlled endpoint validation: PASS');
})().catch(err => { console.error(err); process.exit(1); });
