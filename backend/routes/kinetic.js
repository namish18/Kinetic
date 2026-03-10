import express from 'express';
import { verifyProofOfBuild, calculateQuadraticFunding } from '../services/kineticMechanisms.js';

const router = express.Router();

/**
 * Endpoint 1: Verify Proof-of-Build (CI/CD trace)
 * Prevent Sybil attacks and verify real executions.
 *
 * GET /api/kinetic/proof-of-build?repo=owner/repo&runId=1234
 */
router.get('/proof-of-build', async (req, res) => {
    try {
        const { repo, runId } = req.query;
        const token = process.env.GITHUB_PAT;

        if (!repo || !runId) {
            return res.status(400).json({ error: "Required params: repo (owner/repo) and runId" });
        }

        const verified = await verifyProofOfBuild(repo, runId, token);

        res.json({
            success: true,
            repo,
            runId,
            verifiedStatus: verified ? "✅ Valid (Execution Proven)" : "❌ Invalid (Execution Failed or Forged)",
            creditsGenerated: verified ? 1 : 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Endpoint 2: Dependency-Weighted Quadratic Funding
 * Give fair payouts based on user reach, completely shutting out whales.
 *
 * POST /api/kinetic/quadratic-funding
 */
router.post('/quadratic-funding', (req, res) => {
    try {
        const { poolAmount, projects } = req.body;

        if (!poolAmount || !Array.isArray(projects)) {
            return res.status(400).json({ error: "Requires 'poolAmount' and 'projects' array" });
        }

        const payoutDistribution = calculateQuadraticFunding(poolAmount, projects);

        res.json({
            success: true,
            totalPoolAmount: poolAmount,
            distribution: payoutDistribution
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
