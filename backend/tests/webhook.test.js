import { mock, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';

const secret = 'test_webhook_secret_key';

process.env.GITHUB_WEBHOOK_SECRET = secret;

mock.module('helia', {
  namedExports: {
    createHelia: async () => ({})
  }
});

mock.module('@helia/json', {
  namedExports: {
    json: () => ({})
  }
});

const app = (await import('../server.js')).default;

const generateSignature = (payload, customSecret = secret) => {
  const hmac = crypto.createHmac('sha256', customSecret);
  return `sha256=${hmac.update(JSON.stringify(payload)).digest('hex')}`;
};

describe('SEC-01: GitHub Webhook Signature Verification', () => {
  test('Valid signature -> 200 OK', async () => {
    const payload = { action: 'opened' };
    const signature = generateSignature(payload);

    const res = await request(app)
      .post('/api/webhook/github')
      .set('X-Hub-Signature-256', signature)
      .set('X-GitHub-Event', 'issues')
      .send(payload);

    assert.equal(res.status, 200);
  });

  test('Missing signature -> 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/webhook/github')
      .set('X-GitHub-Event', 'pull_request')
      .send({ action: 'opened' });

    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Missing X-Hub-Signature-256 header.');
  });

  test('Invalid signature -> 401 Unauthorized', async () => {
    const invalidSig = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';

    const res = await request(app)
      .post('/api/webhook/github')
      .set('X-Hub-Signature-256', invalidSig)
      .set('X-GitHub-Event', 'pull_request')
      .send({ action: 'opened' });

    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Invalid webhook signature.');
  });
});
