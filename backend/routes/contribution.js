
/**
 * Contribution Scoring API Routes
 *
 * Provides endpoints to compute and retrieve Contribution scores
 * for GitHub users.
 */

import express from 'express';
import jwt from 'jsonwebtoken';

import {
    computeContributionScore
} from '../services/contributionService.js';

import {
    validateGithubUsernameParam,
    validateCompareUsers
} from '../middleware/validate.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// JWT Authentication Middleware
// ─────────────────────────────────────────────────────────────

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Access token required'
        });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Access token required'
        });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (error) {
        return res.status(403).json({
            success: false,
            error: 'Invalid or expired token'
        });
    }
}

// ─────────────────────────────────────────────────────────────
// GET /api/contribution/score/:username
// Compute contribution score for any GitHub user.
// Public endpoint.
// ─────────────────────────────────────────────────────────────

router.get(
    '/score/:username',
    validateGithubUsernameParam('username'),
    async (req, res) => {
        try {
            const { username } = req.params;

            const githubToken =
                req.query.token || process.env.GITHUB_PAT || null;

            console.log(
                `\nComputing Contribution Score for @${username}...`
            );

            const result = await computeContributionScore(
                username,
                githubToken,
                { startTime: Date.now() }
            );

            console.log(
                `Score for @${username}: ${result.finalScore}`
            );

            return res.status(200).json({
                success: true,
                ...result
            });

        } catch (error) {
            console.error(
                `Score computation failed for @${req.params.username}:`,
                error.message
            );

            return res.status(500).json({
                success: false,
                error: 'Score computation failed',
                message: error.message
            });
        }
    }
);

// ─────────────────────────────────────────────────────────────
// GET /api/contribution/me
// Compute contribution score for authenticated user.
// JWT authentication required.
// ─────────────────────────────────────────────────────────────

router.get('/me', authenticateToken, async (req, res) => {
    try {
        const username = req.user.github;

        if (!username) {
            return res.status(400).json({
                success: false,
                error: 'GitHub username not found in authentication token'
            });
        }

        const githubToken = process.env.GITHUB_PAT || null;

        console.log(
            `\nComputing Contribution Score for authenticated user @${username}...`
        );

        const result = await computeContributionScore(
            username,
            githubToken,
            { startTime: Date.now() }
        );

        return res.status(200).json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error(
            'Contribution score computation failed:',
            error.message
        );

        return res.status(500).json({
            success: false,
            error: 'Score computation failed',
            message: error.message
        });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /api/contribution/compare?users=user1,user2
// Compare contribution scores across multiple users.
// Maximum 5 users.
// ─────────────────────────────────────────────────────────────

router.get('/compare', validateCompareUsers, async (req, res) => {
    try {
        const usernames = req.validatedUsers;

        const githubToken =
            req.query.token || process.env.GITHUB_PAT || null;

        console.log(
            `\nComparing Contribution Scores for: ${usernames.join(', ')}`
        );

        const results = await Promise.allSettled(
            usernames.map(username =>
                computeContributionScore(username, githubToken)
            )
        );

        const comparison = usernames.map((username, index) => {
            const result = results[index];

            if (result.status === 'fulfilled') {
                return result.value;
            }

            return {
                username,
                finalScore: 0,
                error: result.reason?.message || 'Score computation failed'
            };
        });

        comparison.sort(
            (a, b) => (b.finalScore || 0) - (a.finalScore || 0)
        );

        return res.status(200).json({
            success: true,
            comparison,
            rankedBy: 'finalScore'
        });

    } catch (error) {
        console.error(
            'Contribution comparison failed:',
            error.message
        );

        return res.status(500).json({
            success: false,
            error: 'Comparison failed',
            message: error.message
        });
    }
});

export default router;
