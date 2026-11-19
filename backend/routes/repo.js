import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import User from '../models/User.js';
import { computeOrgContributors, DEFAULT_REPUTATION_WEIGHTS } from '../services/contributionService.js';
import {
    DEFAULT_SCORING_WEIGHTS,
    mergeScoringWeights,
    validateScoringWeights
} from '../config/scoringWeights.js';
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
            return {
                username: item.username,
                wallet,
                amount: item.amount,
                score: contributors.find(c => c.username === item.username)?.totalScore ?? 0
            };
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
            return res.status(502).json({
                error: "Approval transaction sealed but payout state could not be refreshed",
                transactionId: transaction.transactionId
            });
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

export default router;
