/**
 * Contribution Scoring API Routes
 *
 * Provides endpoints to compute and retrieve Contribution scores for GitHub users.
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import {
    computeContributionScore
} from '../services/contributionService.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────
//  JWT Middleware
// ─────────────────────────────────────────────────────────────

function authenticateToken(req, res, next) {
    const auth = req.headers['authorization'];
    const token = auth && auth.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        res.status(403).json({ error: 'Invalid or expired token' });
    }
}

/**
 * GET /api/contribution/score/:username
 * Compute the full Contribution score for any GitHub user (public endpoint).
 */
router.get('/score/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const githubToken = req.query.token || process.env.GITHUB_PAT || null;
        
        console.log(`\n📊 Computing Contribution Score for @${username}...`);
        const result = await computeContributionScore(username, githubToken, { startTime: Date.now() });
        console.log(`✅ Score for @${username}: ${result.finalScore}`);

        res.json({ success: true, ...result });
    } catch (error) {
        console.error(`❌ Score computation failed for @${req.params.username}:`, error.message);
        res.status(500).json({ error: 'Score computation failed', message: error.message });
    }
});

/**
 * GET /api/contribution/me
 * Compute Contribution score for the authenticated user (JWT required).
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const githubToken = process.env.GITHUB_PAT || null;

        console.log(`\n📊 Computing Contribution Score for authenticated user @${req.user.github}...`);
        const result = await computeContributionScore(req.user.github, githubToken, { startTime: Date.now() });

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('❌ Score computation failed:', error.message);
        res.status(500).json({ error: 'Score computation failed', message: error.message });
    }
});

/**
 * GET /api/contribution/compare?users=user1,user2,user3
 * Compare Contribution scores across multiple users (max 5).
 */
router.get('/compare', async (req, res) => {
    try {
        const usersParam = req.query.users;
        if (!usersParam) {
            return res.status(400).json({ error: 'users query param required (comma-separated)' });
        }

        const usernames = usersParam.split(',').map(u => u.trim()).filter(Boolean).slice(0, 5);
        const token = req.query.token || process.env.GITHUB_PAT || null;

        console.log(`\n📊 Comparing Scores for: ${usernames.join(', ')}`);

        const results = await Promise.allSettled(
            usernames.map(u => computeContributionScore(u, token))
        );

        const comparison = usernames.map((username, i) => {
            if (results[i].status === 'fulfilled') {
                return results[i].value;
            }
            return { username, finalScore: 0, error: results[i].reason?.message };
        });

        comparison.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

        res.json({
            success: true,
            comparison,
            rankedBy: 'finalScore',
        });
    } catch (error) {
        res.status(500).json({ error: 'Comparison failed', message: error.message });
    }
});

export default router;
