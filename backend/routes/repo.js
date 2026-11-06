import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { proposePayout } from '../services/flowService.js';
import { getTreasuryBalance } from '../services/flowTreasuryService.js';
import {
    calculatePayoutAllocations,
    formatFlowUnits,
    sumConfiguredBountyPools,
    toFlowUnits,
} from '../services/payoutAllocationService.js';

const router = express.Router();

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

import { computeOrgContributors } from '../services/contributionService.js';

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
 * Normalize a repo identifier to "owner/repo" format.
 * Accepts full GitHub URLs, github.com/owner/repo, or plain owner/repo.
 */
function normalizeRepoName(input) {
    // Strip protocol and domain if present
    let cleaned = input.trim();
    cleaned = cleaned.replace(/^https?:\/\//i, '');   // remove https:// or http://
    cleaned = cleaned.replace(/^github\.com\//i, ''); // remove github.com/
    cleaned = cleaned.replace(/\.git$/i, '');          // remove trailing .git
    cleaned = cleaned.replace(/\/+$/, '');             // remove trailing slashes
    // Now should be "owner/repo" — take only first two path segments
    const parts = cleaned.split('/').filter(Boolean);
    if (parts.length < 2) return cleaned; // can't normalize, return as-is
    return `${parts[0]}/${parts[1]}`;
}

/**
 * POST /api/org/repositories
 */
router.post('/repositories', authenticateToken, async (req, res) => {
    try {
        const { repository } = req.body;
        if (!repository) return res.status(400).json({ error: 'Repository name required' });

        const repoName = normalizeRepoName(repository); // always store as owner/repo

        const user = await User.findById(req.user.id);
        const exists = user.repositories.find(r => r.name === repoName);
        if (!exists) {
            user.repositories.push({
                name: repoName,
                targetBranches: ['main'],
                weights: { impact: 0.2, complexity: 0.2, quality: 0.2, review: 0.2, priority: 0.2 }
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
router.get('/repositories/:repoId/branches', authenticateToken, async (req, res) => {
    try {
        // Normalize in case old records were stored as full URLs
        const repoName = normalizeRepoName(decodeURIComponent(req.params.repoId));
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

router.put('/repositories/:repoId/branches', authenticateToken, async (req, res) => {
    try {
        const repoName = normalizeRepoName(decodeURIComponent(req.params.repoId));
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
router.put('/repositories/:repoId/config', authenticateToken, async (req, res) => {
    try {
        const repoName = decodeURIComponent(req.params.repoId);
        const { targetBranches, weights, bountyPool } = req.body;

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
        if (typeof bountyPool === 'number') repo.bountyPool = bountyPool;

        await user.save();
        res.json({ success: true, repositories: user.repositories });
    } catch (error) {
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

export default router;

/**
 * POST /api/org/payout/propose
 * Calculate proportional allocations against configured repository pools
 * and the live Flow treasury balance, then submit per-wallet proposals.
 */
router.post('/payout/propose', authenticateToken, async (req, res) => {
    try {
        const organization = await User.findById(req.user.id);
        if (!organization) return res.status(404).json({ error: "Organization account not found" });
        if (organization.role !== "organization") {
            return res.status(403).json({ error: "Only organization accounts can propose payouts" });
        }
        if (!Array.isArray(organization.repositories) || organization.repositories.length === 0) {
            return res.status(400).json({ error: "No tracked repositories have configured funding pools" });
        }

        const configuredPool = sumConfiguredBountyPools(organization.repositories);
        const configuredPoolUnits = toFlowUnits(configuredPool);
        if (configuredPoolUnits <= 0n) {
            return res.status(400).json({ error: "Configured funding pools total zero FLOW" });
        }

        const treasuryBalance = await getTreasuryBalance();
        const treasuryUnits = toFlowUnits(treasuryBalance);
        const availableUnits = configuredPoolUnits < treasuryUnits ? configuredPoolUnits : treasuryUnits;
        if (availableUnits <= 0n) {
            return res.status(409).json({
                error: "The Flow treasury has no available balance",
                configuredPool,
                treasuryBalance,
            });
        }

        const { contributors } = await computeOrgContributors(req.user.id, process.env.GITHUB_PAT);
        if (!Array.isArray(contributors) || contributors.length === 0) {
            return res.status(400).json({ error: "No eligible contributors were found" });
        }

        const allocation = calculatePayoutAllocations(contributors, formatFlowUnits(availableUnits));
        const usernames = allocation.recipientAllocations.map(item => item.username);
        const users = await User.find({ github: { $in: usernames } }).select("github wallet");
        const userByName = new Map(users.map(user => [user.github, user]));
        const missingWallets = usernames.filter(username => !userByName.get(username)?.wallet);
        if (missingWallets.length > 0) {
            return res.status(409).json({
                error: "Every allocated contributor must link a Flow wallet before proposals can be created",
                missingWallets,
                pendingAllocation: allocation.recipientAllocations,
            });
        }

        const byWallet = new Map();
        for (const item of allocation.recipientAllocations) {
            const wallet = String(userByName.get(item.username).wallet).trim().toLowerCase();
            if (!/^0x[0-9a-f]{16}$/.test(wallet)) {
                return res.status(409).json({
                    error: "A contributor has an invalid Flow wallet address",
                    username: item.username,
                });
            }
            const existing = byWallet.get(wallet) || { wallet, usernames: [], amountUnits: 0n };
            existing.usernames.push(item.username);
            existing.amountUnits += toFlowUnits(item.amount);
            byWallet.set(wallet, existing);
        }

        const results = [];
        for (const entry of byWallet.values()) {
            const amount = formatFlowUnits(entry.amountUnits);
            const txResult = await proposePayout(entry.wallet, Number(amount));
            const payoutEvent = (txResult?.details?.events || []).find(event =>
                String(event.type || "").endsWith(".PayoutProposed")
            );
            const payoutId = payoutEvent?.data?.id == null ? null : String(payoutEvent.data.id);
            results.push({
                payoutId,
                wallet: entry.wallet,
                usernames: entry.usernames,
                amount,
                txResult,
            });
        }

        const successful = results.filter(item => item.txResult?.success);
        const failed = results.filter(item => !item.txResult?.success);
        return res.status(failed.length ? 207 : 201).json({
            success: failed.length === 0,
            message: failed.length
                ? "Some funding-pool payout proposals failed; inspect the per-wallet results"
                : "Funding-pool payout proposals were submitted successfully",
            configuredPool,
            treasuryBalance,
            availablePool: allocation.totalPool,
            totalAllocated: allocation.totalAllocated,
            recipientAllocations: allocation.recipientAllocations,
            results,
            successfulProposals: successful.length,
            failedProposals: failed.length,
        });
    } catch (error) {
        console.error("Funding-pool payout proposal error:", error);
        return res.status(500).json({ error: "Funding-pool allocation failed", message: error.message });
    }
});

// The old endpoint name implied that it executed transfers. Keep it explicit
// that proposals must now be created first and executed through the lifecycle API.
router.post('/payout/execute', authenticateToken, (req, res) => {
    return res.status(400).json({
        error: "This endpoint no longer creates or executes payouts. Use POST /api/org/payout/propose to create proposals.",
    });
});
