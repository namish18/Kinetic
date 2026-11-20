import { mock, after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// The webhook secret must be the same value used to sign the test requests.
const randomSecret = () => crypto.randomBytes(32).toString('hex');
const secret = randomSecret();

// server.js validates its configuration immediately on import.
// Give the test server a complete, isolated configuration first.
const mongoServer = await MongoMemoryServer.create();

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = mongoServer.getUri();
process.env.GITHUB_CLIENT_ID = 'kinetic-test-client-id';
process.env.GITHUB_CLIENT_SECRET = 'kinetic-test-client-secret';
process.env.SESSION_SECRET = randomSecret();
process.env.JWT_SECRET = randomSecret();
process.env.DID_SEED_SECRET = randomSecret();
process.env.GITHUB_WEBHOOK_SECRET = secret;

// Avoid starting a real Helia node during webhook route tests.
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

// server.js starts the database connection during import. Wait for the
// in-memory MongoDB connection before running requests.
await mongoose.connection.asPromise();

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

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
    const invalidSig =
      'sha256=0000000000000000000000000000000000000000000000000000000000000000';

    const res = await request(app)
      .post('/api/webhook/github')
      .set('X-Hub-Signature-256', invalidSig)
      .set('X-GitHub-Event', 'pull_request')
      .send({ action: 'opened' });

    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Invalid webhook signature.');
  });
});
