import 'dotenv/config'; // ← must be first so all modules see env vars

// ─── Promise.withResolvers Polyfill for Node v20 ─────────────
if (!Promise.withResolvers) {
    Promise.withResolvers = function () {
        let resolve, reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };
}

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import session from 'express-session';
import passport from './config/passport.js';
import connectDB from './config/connectdb.js';
import authRoutes from './routes/auth.js';
import contributionRoutes from './routes/contribution.js';
import kineticRoutes from './routes/kinetic.js';
import { stopHelia } from './services/didService.js';

// (env vars loaded via import 'dotenv/config' at top)

// ESM __dirname shim
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to database
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ──────────────────────────────────────────────
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(express.json());

// Session (required for Passport OAuth flow)
app.use(session({
    secret: process.env.SESSION_SECRET || 'kinetic-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 24 hours
}));

app.use(passport.initialize());
app.use(passport.session());

// ─── API Routes ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/contribution', contributionRoutes);
app.use('/api/kinetic', kineticRoutes);

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
            ipfsStorage: 'Helia in-process IPFS node (Protocol Labs) — no account needed',
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

// ─── SPA fallback ────────────────────────────────────────────
app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n🚀 Kinetic API running on http://localhost:${PORT}`);
    console.log(`   🔗 Start login: http://localhost:${PORT}/api/auth/github`);
    console.log(`   📖 API info:    http://localhost:${PORT}/api`);
    console.log(`   📦 IPFS:        Helia in-process node (Protocol Labs)\n`);
});

// ─── Graceful shutdown ───────────────────────────────────────
async function shutdown(signal) {
    console.log(`\n${signal} received — shutting down gracefully...`);
    await stopHelia();
    process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
