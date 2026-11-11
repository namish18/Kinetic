import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import User from '../models/User.js';
import { proposePayout } from '../services/flowService.js';
import { computeOrgContributors, DEFAULT_REPUTATION_WEIGHTS } from '../services/contributionService.js';
import {
    DEFAULT_SCORING_WEIGHTS,
    mergeScoringWeights,
    validateScoringWeights
} from '../config/scoringWeights.js';

import {
    validateAddRepository,
    validateRepoIdParam,
    validateUpdateBranches,
    validateRepoConfig,
    sendValidationError,
    normalizeRepoName
} from '../middleware/validate.js';

const router = express.Router();


/**
 * GET /api/org/all
 * Public endpoint to get all repositories across the platform.
 */
router.get('/all', async (req, res) => {
    try {
        const users = await User.find({ "repositories.0": { "$exists": true } });
        const allRepos = [];
        users.forEach(u => {
            u.repositories.forEach(r => {
                allRepos.push({
                    name: r.name,
                    owner: u.github,
                    ownerAvatar: u.avatarUrl || `https://github.com/${u.github}.png`,
                    weights: r.weights,
                    reputationWeights: r.reputationWeights || DEFAULT_REPUTATION_WEIGHTS,
                    totalPool: 1000 + (r.name.length * 50), // Semi-stable pool
                    activePRs: 5 + (r.name.length % 5)
                });
            });
        });
        res.json({ success: true, repositories: allRepos });
    } catch (error) {
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

/**
 * GET /api/org/contributors
 * Get real contributors for the repositories of the current organization.
 */
router.get('/contributors', authenticateToken, async (req, res) => {
    try {
        const { contributors, recentEvents } = await computeOrgContributors(req.user.id, process.env.GITHUB_PAT);
        res.json({ success: true, contributors, recentEvents });
    } catch (error) {
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

/**
 * GET /api/org/info
 * Get current user's repositories
 */
router.get('/info', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json({ success: true, repositories: user.repositories || [] });
    } catch (error) {
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

/**
 * POST /api/org/repositories
 */
router.post('/repositories', authenticateToken, validateAddRepository, async (req, res) => {
    try {
        const repoName = req.normalizedRepo; // validated & normalized "owner/repo"

        const user = await User.findById(req.user.id);
        const exists = user.repositories.find(r => r.name === repoName);
        if (!exists) {
            user.repositories.push({
                name: repoName,
                targetBranches: ['main'],
                weights: { ...DEFAULT_SCORING_WEIGHTS },
                reputationWeights: DEFAULT_REPUTATION_WEIGHTS
            });
            await user.save();
        }
        res.json({ success: true, repositories: user.repositories });
    } catch (error) {
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

/**
 * GET /api/org/repositories/:repoId/branches
 * Fetch all branches for a repository from GitHub API
 */
router.get('/repositories/:repoId/branches', authenticateToken, validateRepoIdParam('repoId'), async (req, res) => {
    try {
        const repoName = req.normalizedRepoId;
        const pat = process.env.GITHUB_PAT;

        const headers = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'Kinetic-App' };
        if (pat) headers['Authorization'] = `Bearer ${pat}`;

        let allBranches = [];
        let page = 1;
        while (true) {
            const ghRes = await fetch(
                `https://api.github.com/repos/${repoName}/branches?per_page=100&page=${page}`,
                { headers }
            );
            if (!ghRes.ok) {
                const err = await ghRes.json().catch(() => ({}));
                return res.status(ghRes.status).json({ error: err.message || 'GitHub API error' });
            }
            const data = await ghRes.json();
            if (!Array.isArray(data) || data.length === 0) break;
            allBranches = allBranches.concat(data.map(b => b.name));
            if (data.length < 100) break;
            page++;
        }

        res.json({ success: true, branches: allBranches });
    } catch (error) {
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

/**
 * PUT /api/org/repositories/:repoId/branches
 */
router.put('/repositories/:repoId/branches', authenticateToken, validateRepoIdParam('repoId'), validateUpdateBranches, async (req, res) => {
    try {
        const repoName = req.normalizedRepoId;
        const { targetBranches } = req.body;

        const user = await User.findById(req.user.id);
        const repo = user.repositories.find(r => r.name === repoName);
        if (!repo) return res.status(404).json({ error: 'Repository not found' });
        
        repo.targetBranches = targetBranches;
        await user.save();
        res.json({ success: true, repositories: user.repositories });
    } catch (error) {
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

/**
 * PUT /api/org/repositories/:repoId/config
 * Update multiple repo settings at once
 */
router.put('/repositories/:repoId/config', authenticateToken, validateRepoIdParam('repoId'), validateRepoConfig, async (req, res) => {
    try {
        const repoName = req.normalizedRepoId;
        const { targetBranches, weights, bountyPool, reputationWeights } = req.body;

        const user = await User.findById(req.user.id);
        const repo = user.repositories.find(r => r.name === repoName);
        if (!repo) return res.status(404).json({ error: 'Repository not found' });

        // Validate the final merged weights before mutating the repository.
        let nextWeights = null;
        if (weights) {
            nextWeights = mergeScoringWeights(repo.weights, weights);
            const { valid, errors } = validateScoringWeights(nextWeights);
            if (!valid) return sendValidationError(res, errors);
        }

        if (targetBranches) repo.targetBranches = targetBranches;
        if (nextWeights) repo.weights = nextWeights;
        if (reputationWeights) {
            repo.reputationWeights = {
                alpha: reputationWeights.alpha ?? repo.reputationWeights?.alpha ?? DEFAULT_REPUTATION_WEIGHTS.alpha,
                beta: reputationWeights.beta ?? repo.reputationWeights?.beta ?? DEFAULT_REPUTATION_WEIGHTS.beta,
                gamma: reputationWeights.gamma ?? repo.reputationWeights?.gamma ?? DEFAULT_REPUTATION_WEIGHTS.gamma,
                delta: reputationWeights.delta ?? repo.reputationWeights?.delta ?? DEFAULT_REPUTATION_WEIGHTS.delta
            };
        }
        if (typeof bountyPool === 'number') repo.bountyPool = bountyPool;

        await user.save();
        res.json({ success: true, repositories: user.repositories });
    } catch (error) {
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

/**
 * POST /api/org/payout/execute
 * Propose payouts on the Flow blockchain for all contributors 
 */
router.post('/payout/execute', authenticateToken, async (req, res) => {
    try {
        const { contributors } = await computeOrgContributors(req.user.id, process.env.GITHUB_PAT);
        
        if (!contributors || contributors.length === 0) {
            return res.status(400).json({ error: 'No contributors found to payout.' });
        }

        const results = [];
        
        for (const c of contributors) {
            const amount = c.totalScore * 5; // 5 FLOW per pt (as defined in frontend)
            if (amount <= 0) continue;

            const userDoc = await User.findOne({ github: c.username });

            // If wallet is missing, mark as pending without triggering smart contract execution
            if (!userDoc?.wallet) {
                console.log(`Repo Payout: Contributor ${c.username} has no linked wallet. Setting status to pending.`);
                results.push({ 
                    username: c.username, 
                    amount, 
                    status: 'pending_wallet',
                    message: 'Contributor wallet is not linked. Payout marked as pending.'
                });
                continue;
            }

            const txResult = await proposePayout(userDoc.wallet, amount);
            results.push({ 
                username: c.username, 
                amount, 
                status: txResult.success ? 'success' : 'failed',
                txResult 
            });
        }

        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

export default router;
