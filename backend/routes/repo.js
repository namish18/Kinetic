import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import User from '../models/User.js';
import { proposePayout } from '../services/flowService.js';
 feature/payout-idempotency-epoch
import { computeOrgContributors } from '../services/contributionService.js';
 feature/payout-idempotency-epoch
import Payout from '../models/Payout.js';


 fix/remove-fallback-wallet-repo

import { computeOrgContributors, DEFAULT_REPUTATION_WEIGHTS } from '../services/contributionService.js';
main

import {
    validateAddRepository,
    validateRepoIdParam,
    validateUpdateBranches,
    validateRepoConfig,
    normalizeRepoName
} from '../middleware/validate.js';
feature/payout-idempotency-epoch
 main
 main

main

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
                weights: { impact: 0.2, complexity: 0.2, quality: 0.2, review: 0.2, priority: 0.2 },
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
 * POST /api/org/payout/execute
 * Propose payouts with idempotency guard per contribution and epoch
 */
router.post('/payout/execute', authenticateToken, async (req, res) => {
    try {
        const { epochId = 'epoch-default' } = req.body;
        const { contributors } = await computeOrgContributors(req.user.id, process.env.GITHUB_PAT);

        if (!contributors || contributors.length === 0) {
            return res.status(400).json({ error: 'No contributors found to payout.' });
        }

        const results = [];

        for (const c of contributors) {
            const amount = c.totalScore * 5;
            if (amount <= 0) continue;

            // Generate unique contribution key
            const contributionId = `${c.username}_${c.totalScore}`;

            // Idempotency check: check for existing payout execution
            const existingPayout = await Payout.findOne({ contributionId, epochId });
            if (existingPayout) {
                console.log(`Repo Payout: Idempotency triggered for ${c.username} (${contributionId}) in epoch ${epochId}`);
                results.push({
                    username: c.username,
                    amount: existingPayout.amount,
                    status: 'already_processed',
                    message: 'Payout already processed for this contribution and epoch.',
                    txResult: existingPayout.txResult
                });
                continue;
            }

            const userDoc = await User.findOne({ github: c.username });

            if (!userDoc?.wallet) {
                const pendingRecord = await Payout.create({
                    contributionId,
                    epochId,
                    username: c.username,
                    wallet: 'unlinked',
                    amount,
                    status: 'pending_wallet'
                });
                results.push({
                    username: c.username,
                    amount,
                    status: 'pending_wallet',
                    message: 'Contributor wallet is not linked. Payout marked as pending.'
                });
                continue;
            }

            // Propose transaction on Flow blockchain
            const txResult = await proposePayout(userDoc.wallet, amount);
            const payoutStatus = txResult.success ? 'success' : 'failed';

            await Payout.create({
                contributionId,
                epochId,
                username: c.username,
                wallet: userDoc.wallet,
                amount,
                status: payoutStatus,
                txResult
            });

            results.push({
                username: c.username,
                amount,
                status: payoutStatus,
                txResult
            });
        }

        res.json({ success: true, results });
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

        if (targetBranches) repo.targetBranches = targetBranches;
        if (weights) {
            repo.weights = {
                impact: weights.impact ?? repo.weights.impact,
                complexity: weights.complexity ?? repo.weights.complexity,
                quality: weights.quality ?? repo.weights.quality,
                review: weights.review ?? repo.weights.review,
                priority: weights.priority ?? repo.weights.priority
            };
        }
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
