/**
 * Contribution Scoring API Routes
 *
 * Provides endpoints to compute and retrieve MSTS scores for GitHub users.
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import {
    computeMSTS,
    computeTemporalDecay,
    computeBlastRadius,
    computeCodeSurvival,
    computeIssueVelocity,
    computePortabilityIndex,
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

// ─────────────────────────────────────────────────────────────
//  Full MSTS Score
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/contribution/score/:username
 * Compute the full MSTS score for any GitHub user (public endpoint).
 */
router.get('/score/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const githubToken = req.query.token || process.env.GITHUB_PAT || null;
        const proofOfBuild = req.query.proofOfBuild !== 'false';

        console.log(`\n📊 Computing MSTS for @${username}...`);
        const result = await computeMSTS(username, githubToken, { proofOfBuild });
        console.log(`✅ MSTS for @${username}: ${result.finalScore} (${result.meta.computeTimeMs}ms)`);

        res.json({ success: true, ...result });
    } catch (error) {
        console.error(`❌ MSTS computation failed for @${req.params.username}:`, error.message);
        res.status(500).json({ error: 'Score computation failed', message: error.message });
    }
});

/**
 * GET /api/contribution/score/me
 * Compute MSTS score for the authenticated user (JWT required).
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const githubToken = process.env.GITHUB_PAT || null;
        const proofOfBuild = req.query.proofOfBuild !== 'false';

        console.log(`\n📊 Computing MSTS for authenticated user @${req.user.github}...`);
        const result = await computeMSTS(req.user.github, githubToken, { proofOfBuild });

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('❌ MSTS computation failed:', error.message);
        res.status(500).json({ error: 'Score computation failed', message: error.message });
    }
});

// ─────────────────────────────────────────────────────────────
//  Individual Layer Endpoints (for granular debugging/display)
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/contribution/layer/temporal/:username
 * Compute only the Temporal Decay score for a user.
 */
router.get('/layer/temporal/:username', async (req, res) => {
    try {
        const token = req.query.token || process.env.GITHUB_PAT || null;
        const result = await computeTemporalDecay(req.params.username, token);
        res.json({ success: true, layer: 'temporalDecay', ...result });
    } catch (error) {
        res.status(500).json({ error: 'Layer computation failed', message: error.message });
    }
});

/**
 * GET /api/contribution/layer/blast/:username
 * Compute only the Blast Radius score for a user.
 */
router.get('/layer/blast/:username', async (req, res) => {
    try {
        const token = req.query.token || process.env.GITHUB_PAT || null;
        const result = await computeBlastRadius(req.params.username, token);
        res.json({ success: true, layer: 'blastRadius', ...result });
    } catch (error) {
        res.status(500).json({ error: 'Layer computation failed', message: error.message });
    }
});

/**
 * GET /api/contribution/layer/survival/:username
 * Compute only the Code Survival Rate for a user.
 */
router.get('/layer/survival/:username', async (req, res) => {
    try {
        const token = req.query.token || process.env.GITHUB_PAT || null;
        const result = await computeCodeSurvival(req.params.username, token);
        res.json({ success: true, layer: 'codeSurvival', ...result });
    } catch (error) {
        res.status(500).json({ error: 'Layer computation failed', message: error.message });
    }
});

/**
 * GET /api/contribution/layer/velocity/:username
 * Compute only the Issue Resolution Velocity for a user.
 */
router.get('/layer/velocity/:username', async (req, res) => {
    try {
        const token = req.query.token || process.env.GITHUB_PAT || null;
        const result = await computeIssueVelocity(req.params.username, token);
        res.json({ success: true, layer: 'issueVelocity', ...result });
    } catch (error) {
        res.status(500).json({ error: 'Layer computation failed', message: error.message });
    }
});

/**
 * GET /api/contribution/layer/portability/:username
 * Compute only the Cross-Ecosystem Portability Index for a user.
 */
router.get('/layer/portability/:username', async (req, res) => {
    try {
        const token = req.query.token || process.env.GITHUB_PAT || null;
        const result = await computePortabilityIndex(req.params.username, token);
        res.json({ success: true, layer: 'portability', ...result });
    } catch (error) {
        res.status(500).json({ error: 'Layer computation failed', message: error.message });
    }
});

// ─────────────────────────────────────────────────────────────
//  Compare Users
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/contribution/compare?users=user1,user2,user3
 * Compare MSTS scores across multiple users (max 5).
 */
router.get('/compare', async (req, res) => {
    try {
        const usersParam = req.query.users;
        if (!usersParam) {
            return res.status(400).json({ error: 'users query param required (comma-separated)' });
        }

        const usernames = usersParam.split(',').map(u => u.trim()).filter(Boolean).slice(0, 5);
        const token = req.query.token || process.env.GITHUB_PAT || null;

        console.log(`\n📊 Comparing MSTS for: ${usernames.join(', ')}`);

        const results = await Promise.allSettled(
            usernames.map(u => computeMSTS(u, token))
        );

        const comparison = usernames.map((username, i) => {
            if (results[i].status === 'fulfilled') {
                return results[i].value;
            }
            return { username, finalScore: 0, error: results[i].reason?.message };
        });

        // Sort by final score descending
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
