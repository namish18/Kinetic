const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');
const passport = require('./config/passport');
const connectDB = require('./config/connectdb');
const authRoutes = require('./routes/auth');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
    cors({
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
    })
);
app.use(express.json());

// Session (required for Passport OAuth flow)
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'kinetic-session-secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
        },
    })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// API Routes
app.use('/api/auth', authRoutes);

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Health check route
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// API info route
app.get('/api', (req, res) => {
    res.json({
        message: 'Kinetic Backend API is running',
        endpoints: {
            auth: {
                githubLogin: 'GET /api/auth/github',
                githubCallback: 'GET /api/auth/github/callback',
                currentUser: 'GET /api/auth/me',
                resolveDID: 'GET /api/auth/did/:username',
                updateWallet: 'PUT /api/auth/wallet',
                logout: 'GET /api/auth/logout',
            },
        },
    });
});

// SPA fallback — serve index.html for dashboard and other frontend routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`🔗 GitHub OAuth: http://localhost:${PORT}/api/auth/github`);
});
