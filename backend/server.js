import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import passport from 'passport';
import session from 'express-session';
import connectDB from './config/connectdb.js';

import './config/passport.js';

import authRoutes from './routes/auth.js';
import contributionRoutes from './routes/contribution.js';
import kineticRoutes from './routes/kinetic.js';
import orgRoutes from './routes/repo.js';
import payoutLifecycleRoutes from './routes/payoutLifecycle.js';
import repoRoutes from './routes/repo.js';
import webhookRoutes from './routes/webhook.js';
import { stopHelia } from './services/didService.js';
import { ensureAlgorithmVersion } from './services/contributionService.js';

// (env vars loaded via import 'dotenv/config' at top)

connectDB();

// Seed the active scoring algorithm version
ensureAlgorithmVersion()
    .then(v => console.log(`🧮 Algorithm version active: ${v.version}`))
    .catch(e => console.error('Algorithm version seed failed:', e.message));

const app = express();

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev_session_secret',
    resave: false,
    saveUninitialized: false,
  })
);

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use('/api/auth', authRoutes);
app.use('/api/contribution', contributionRoutes);
app.use('/api/kinetic', kineticRoutes);
app.use('/api/org', orgRoutes);
app.use('/api/org/payouts', payoutLifecycleRoutes);
app.use('/api/org', repoRoutes);
app.use('/api/webhook', webhookRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Kinetic Backend is healthy' });
// ─── Static frontend ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ─── Health / Info ───────────────────────────────────────────
app.get('/health', (_req, res) => res.send('OK'));

app.get('/api', (_req, res) => {
    res.json({
        message: 'Kinetic DID Identity API',
        stack: {
            didGeneration: 'key-did-provider-ed25519 (Ceramic / Protocol Labs)',
            didResolution: 'key-did-resolver (Ceramic / Protocol Labs)',
            ipfsStorage: 'Helia in-process node (Protocol Labs) — no account needed',
        },
        endpoints: {
            'GET /api/auth/github': 'Begin GitHub OAuth flow',
            'GET /api/auth/github/callback': 'OAuth callback (creates DID on first login)',
            'GET /api/auth/me': 'Current user profile (JWT required)',
            'GET /api/auth/did/:username': 'Resolve DID by GitHub username (public)',
            'GET /api/auth/did-resolve/self': 'Re-resolve your DID live (JWT required)',
            'PUT /api/auth/wallet': 'Link Flow wallet address (JWT required)',
            'GET /api/auth/logout': 'Logout',
        },
    });
});

const PORT = process.env.PORT || 5000;

// Only start the HTTP listener if server.js is executed directly (prevents port conflicts during jest testing)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
}

export default app;
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
