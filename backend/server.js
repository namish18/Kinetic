import 'dotenv/config'; // Loads .env variables immediately before other imports

import express from 'express';
import cors from 'cors';
import passport from 'passport';
import session from 'express-session';
import connectDB from './config/connectdb.js';

// Passport config (now reads loaded env vars safely)
import './config/passport.js';

// Route Handlers
import authRoutes from './routes/auth.js';
import contributionRoutes from './routes/contribution.js';
import kineticRoutes from './routes/kinetic.js';
import repoRoutes from './routes/repo.js';
import webhookRoutes from './routes/webhook.js';

// Connect Database
connectDB();

const app = express();

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev_session_secret',
    resave: false,
    saveUninitialized: false,
  })
);

app.use(express.json());
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
app.use('/api/org', repoRoutes);
app.use('/api/webhook', webhookRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Kinetic Backend is healthy' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});