import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import dotenv from 'dotenv';
import session from 'express-session';
import passport from './config/passport.js';
import connectDB from './config/connectdb.js';
import authRoutes from './routes/auth.js';

// Load env vars
dotenv.config();

// ESM __dirname shim
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to database
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ──────────────────────────────────────────────
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5000',
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
            ipfsStorage: '@web3-storage/w3up-client (Storacha / Protocol Labs)',
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
    console.log(`   📖 API info:    http://localhost:${PORT}/api\n`);
});
