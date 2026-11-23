/**
 * Contribution Scoring API Routes
 *
 * Provides endpoints to compute and retrieve contribution scores
 * for GitHub users.
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';

import {
    computeContributionScore
} from '../services/contributionService.js';

import {
    validateGithubUsernameParam,
    validateCompareUsers
} from '../middleware/validate.js';

const router = express.Router();

// GET /api/contribution/score/:username
// Public endpoint: compute the contribution score for any GitHub user.
router.get(
    '/score/:username',
    validateGithubUsernameParam('username'),
    async (req, res) => {
        try {
            const { username } = req.params;
            const githubToken =
                req.query.token || process.env.GITHUB_PAT || null;

            console.log(`\nComputing Contribution Score for @${username}...`);

            const result = await computeContributionScore(
                username,
                githubToken,
                { startTime: Date.now() }
            );

            console.log(`Score for @${username}: ${result.finalScore}`);

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

// GET /api/contribution/me
// JWT authentication required.
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

// GET /api/contribution/compare?users=user1,user2
// Compare up to five users.
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
