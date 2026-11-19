import { jest } from '@jest/globals';

// Mock Helia native WebRTC binary modules before importing app
jest.unstable_mockModule('helia', () => ({
  createHelia: jest.fn().mockResolvedValue({}),
}));

jest.unstable_mockModule('@helia/json', () => ({
  json: jest.fn().mockReturnValue({}),
}));

const request = (await import('supertest')).default;
const crypto = (await import('crypto')).default;

// server.js validates its configuration as soon as it is imported, so set a complete test configuration first.
const randomSecret = () => crypto.randomBytes(32).toString('hex');
process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/kinetic_test';
process.env.GITHUB_CLIENT_ID = 'test-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
process.env.SESSION_SECRET = randomSecret();
process.env.JWT_SECRET = randomSecret();
process.env.DID_SEED_SECRET = randomSecret();
process.env.GITHUB_WEBHOOK_SECRET = randomSecret();

const app = (await import('../server.js')).default;

describe('SEC-01: GitHub Webhook Signature Verification', () => {
  const secret = 'test_webhook_secret_key';

  beforeAll(() => {
    process.env.GITHUB_WEBHOOK_SECRET = secret;
  });

  const generateSignature = (payload, customSecret = secret) => {
    const hmac = crypto.createHmac('sha256', customSecret);
    return `sha256=${hmac.update(JSON.stringify(payload)).digest('hex')}`;
  };

  test('Valid signature -> 200 OK', async () => {
    const payload = { action: 'opened' };
    const signature = generateSignature(payload);

    const res = await request(app)
      .post('/api/webhook/github')
      .set('X-Hub-Signature-256', signature)
      .set('X-GitHub-Event', 'issues')
      .send(payload);

    expect(res.status).toBe(200);
  });

  test('Missing X-Hub-Signature-256 header -> 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/webhook/github')
      .set('X-GitHub-Event', 'pull_request')
      .send({ action: 'opened' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Missing X-Hub-Signature-256 header.');
  });

  test('Invalid signature -> 401 Unauthorized', async () => {
    const invalidSig = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';

    const res = await request(app)
      .post('/api/webhook/github')
      .set('X-Hub-Signature-256', invalidSig)
      .set('X-GitHub-Event', 'pull_request')
      .send({ action: 'opened' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid webhook signature.');
  });
});