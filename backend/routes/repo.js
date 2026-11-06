import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { computeOrgContributors } from '../services/contributionService.js';
import {
    approvePayout as approvePayoutOnFlow,
    executePayout as executePayoutOnFlow,
    getPayout as getPayoutFromFlow,
    getRequiredApprovals,
    getTreasuryBalance,
    proposePayouts,
} from '../services/flowService.js';
import {
    calculatePayoutAllocations,
    formatFlowUnits,
    sumConfiguredBountyPools,
    toFlowUnits,
} from '../services/payoutAllocationService.js';
import {
    canApprovePayout,
    canExecutePayout,
    derivePayoutStatus,
} from '../services/payoutLifecycleService.js';

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

function isValidPayoutId(value) {
    return /^\d+$/.test(String(value)) && BigInt(String(value)) >= 1n;
}

function payoutPayload(record, requiredApprovals) {
    return {
        payoutId: record.id,
        status: derivePayoutStatus(record, requiredApprovals),
        totalAmount: record.totalAmount,
        approvalCount: record.approvals.length,
        approvals: record.approvals,
        requiredApprovals,
        executed: record.executed,
        amounts: record.amounts,
    };
}

async function requireOrganization(req, res) {
    const organization = await User.findById(req.user.id);
    if (!organization) {
        res.status(404).json({ error: "Organization account not found" });
        return null;
    }
    if (organization.role !== "organization") {
        res.status(403).json({ error: "Only organization accounts can manage payout proposals" });
        return null;
    }
    return organization;
}

/**
 * POST /api/org/payout/propose
 * Allocate the available funding pool by contributor score and create one
 * on-chain proposal containing all recipient amounts.
 */
router.post('/payout/propose', authenticateToken, async (req, res) => {
    try {
        const organization = await requireOrganization(req, res);
        if (!organization) return;

        if (!Array.isArray(organization.repositories) || organization.repositories.length === 0) {
            return res.status(400).json({ error: "No tracked repositories have a configured funding pool" });
        }

        const configuredPool = sumConfiguredBountyPools(organization.repositories);
        const configuredPoolUnits = toFlowUnits(configuredPool);
        if (configuredPoolUnits <= 0n) {
            return res.status(400).json({ error: "The configured repository funding pools total zero FLOW" });
        }

        const treasuryBalance = await getTreasuryBalance();
        const treasuryUnits = toFlowUnits(treasuryBalance);
        const availableUnits = configuredPoolUnits < treasuryUnits ? configuredPoolUnits : treasuryUnits;
        if (availableUnits <= 0n) {
            return res.status(409).json({
                error: "The Flow treasury has no available balance for a payout proposal",
                configuredPool,
                treasuryBalance,
            });
        }

        const { contributors } = await computeOrgContributors(req.user.id, process.env.GITHUB_PAT);
        if (!Array.isArray(contributors) || contributors.length === 0) {
            return res.status(400).json({ error: "No eligible contributors were found for allocation" });
        }

        const allocation = calculatePayoutAllocations(contributors, formatFlowUnits(availableUnits));
        const usernames = allocation.recipientAllocations.map(item => item.username);
        const users = await User.find({ github: { $in: usernames } }).select("github wallet");
        const userByName = new Map(users.map(user => [user.github, user]));

        const missingWallets = usernames.filter(username => !userByName.get(username)?.wallet);
        if (missingWallets.length > 0) {
            return res.status(409).json({
                error: "Every allocated contributor must link a Flow wallet before a payout proposal can be created",
                missingWallets,
                pendingAllocation: allocation.recipientAllocations,
            });
        }

        const amountsByAddress = {};
        const recipientAllocations = allocation.recipientAllocations.map(item => {
            const wallet = String(userByName.get(item.username).wallet).trim().toLowerCase();
            const amountUnits = toFlowUnits(item.amount);
            amountsByAddress[wallet] = formatFlowUnits(
                (amountsByAddress[wallet] ? toFlowUnits(amountsByAddress[wallet]) : 0n) + amountUnits
            );
            return { username: item.username, wallet, amount: item.amount, score: contributors.find(c => c.username === item.username)?.totalScore ?? 0 };
        });

        const proposal = await proposePayouts(amountsByAddress);
        const [record, requiredApprovals] = await Promise.all([
            getPayoutFromFlow(proposal.payoutId),
            getRequiredApprovals(),
        ]);
        if (!record) {
            return res.status(502).json({
                error: "The proposal transaction sealed, but its payout record could not be read from the Flow contract",
                transactionId: proposal.transactionId,
                payoutId: proposal.payoutId,
            });
        }

        return res.status(201).json({
            success: true,
            ...payoutPayload(record, requiredApprovals),
            transactionId: proposal.transactionId,
            configuredPool,
            treasuryBalance,
            availablePool: allocation.totalPool,
            totalProposed: allocation.totalAllocated,
            recipientAllocations,
        });
    } catch (error) {
        console.error("Payout proposal error:", error);
        return res.status(500).json({ error: "Payout proposal failed", message: error.message });
    }
});

/**
 * GET /api/org/payout/:payoutId
 * Read proposal status directly from the Flow treasury contract.
 */
router.get('/payout/:payoutId', authenticateToken, async (req, res) => {
    try {
        const organization = await requireOrganization(req, res);
        if (!organization) return;
        if (!isValidPayoutId(req.params.payoutId)) {
            return res.status(400).json({ error: "Payout ID must be a positive integer" });
        }

        const [record, requiredApprovals] = await Promise.all([
            getPayoutFromFlow(req.params.payoutId),
            getRequiredApprovals(),
        ]);
        if (!record) return res.status(404).json({ error: "Payout proposal not found" });

        return res.json({ success: true, ...payoutPayload(record, requiredApprovals) });
    } catch (error) {
        console.error("Payout status error:", error);
        return res.status(500).json({ error: "Unable to retrieve payout status", message: error.message });
    }
});

/**
 * POST /api/org/payout/:payoutId/approve
 * Record the configured treasury signer approval for an existing proposal.
 */
router.post('/payout/:payoutId/approve', authenticateToken, async (req, res) => {
    try {
        const organization = await requireOrganization(req, res);
        if (!organization) return;
        if (!isValidPayoutId(req.params.payoutId)) {
            return res.status(400).json({ error: "Payout ID must be a positive integer" });
        }

        const current = await getPayoutFromFlow(req.params.payoutId);
        if (!current) return res.status(404).json({ error: "Payout proposal not found" });
        if (current.executed) return res.status(409).json({ error: "This payout has already been executed" });

        const requiredApprovals = await getRequiredApprovals();
        if (!canApprovePayout(current, requiredApprovals)) {
            return res.status(409).json({ error: "The payout has already reached its approval threshold" });
        }

        const transaction = await approvePayoutOnFlow(req.params.payoutId);
        const [updated, threshold] = await Promise.all([
            getPayoutFromFlow(req.params.payoutId),
            getRequiredApprovals(),
        ]);
        if (!updated) {
            return res.status(502).json({ error: "Approval transaction sealed but payout state could not be refreshed", transactionId: transaction.transactionId });
        }

        return res.json({
            success: true,
            ...payoutPayload(updated, threshold),
            transactionId: transaction.transactionId,
        });
    } catch (error) {
        console.error("Payout approval error:", error);
        return res.status(500).json({ error: "Payout approval failed", message: error.message });
    }
});

/**
 * POST /api/org/payout/:payoutId/execute
 * Execute a payout only after the on-chain approval threshold is reached.
 */
router.post('/payout/:payoutId/execute', authenticateToken, async (req, res) => {
    try {
        const organization = await requireOrganization(req, res);
        if (!organization) return;
        if (!isValidPayoutId(req.params.payoutId)) {
            return res.status(400).json({ error: "Payout ID must be a positive integer" });
        }

        const [current, requiredApprovals] = await Promise.all([
            getPayoutFromFlow(req.params.payoutId),
            getRequiredApprovals(),
        ]);
        if (!current) return res.status(404).json({ error: "Payout proposal not found" });
        if (current.executed) return res.status(409).json({ error: "This payout has already been executed" });
        if (!canExecutePayout(current, requiredApprovals)) {
            return res.status(409).json({
                error: "Payout cannot be executed before the required approvals are collected",
                approvalCount: current.approvals.length,
                requiredApprovals,
            });
        }

        const transaction = await executePayoutOnFlow(req.params.payoutId);
        const [updated, threshold] = await Promise.all([
            getPayoutFromFlow(req.params.payoutId),
            getRequiredApprovals(),
        ]);
        if (!updated || !updated.executed) {
            return res.status(502).json({
                error: "Execution transaction sealed but the contract does not report the payout as executed",
                transactionId: transaction.transactionId,
            });
        }

        return res.json({
            success: true,
            ...payoutPayload(updated, threshold),
            transactionId: transaction.transactionId,
        });
    } catch (error) {
        console.error("Payout execution error:", error);
        return res.status(500).json({ error: "Payout execution failed", message: error.message });
    }
});

/**
 * Reject the legacy one-step endpoint instead of proposing payouts immediately.
 */
router.post('/payout/execute', authenticateToken, (req, res) => {
    return res.status(400).json({
        error: "A payout ID is required. Use POST /api/org/payout/propose, then approve and execute the returned proposal.",
    });
});
