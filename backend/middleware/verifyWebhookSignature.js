import crypto from 'crypto';

export const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-hub-signature-256'];
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    console.error('GITHUB_WEBHOOK_SECRET is not configured.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  if (!signature) {
    return res.status(401).json({ error: 'Missing X-Hub-Signature-256 header.' });
  }

  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
  const hmac = crypto.createHmac('sha256', secret);
  const digest = `sha256=${hmac.update(rawBody).digest('hex')}`;

  const signatureBuffer = Buffer.from(signature);
  const digestBuffer = Buffer.from(digest);

  if (
    signatureBuffer.length !== digestBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, digestBuffer)
  ) {
    return res.status(401).json({ error: 'Invalid webhook signature.' });
  }

  next();
};

export default verifyWebhookSignature;