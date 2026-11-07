import express from 'express';
import { verifyProofOfBuild, calculateQuadraticFunding } from '../services/kineticMechanisms.js';
import { validateProofOfBuild, validateQuadraticFunding } from '../middleware/validate.js';

const router = express.Router();

/**
 * Endpoint 1: Verify Proof-of-Build (CI/CD trace)
 * Prevent Sybil attacks and verify real executions.
 *
 * GET /api/kinetic/proof-of-build?repo=owner/repo&runId=1234
 */
router.get('/proof-of-build', validateProofOfBuild, async (req, res) => {
    try {
        const repo = req.normalizedRepo || req.query.repo;
        const runId = req.query.runId;
        const token = process.env.GITHUB_PAT;

        const verified = await verifyProofOfBuild(repo, runId, token);

        res.json({
            success: true,
            repo,
            runId,
            verifiedStatus: verified ? "✅ Valid (Execution Proven)" : "❌ Invalid (Execution Failed or Forged)",
            creditsGenerated: verified ? 1 : 0
        });
    } catch (err) {
        res.status(500).json({ error: 'Proof-of-build verification failed', message: err.message });
    }
});

/**
 * Endpoint 2: Dependency-Weighted Quadratic Funding
 * Give fair payouts based on user reach, completely shutting out whales.
 *
 * POST /api/kinetic/quadratic-funding
 */
router.post('/quadratic-funding', validateQuadraticFunding, (req, res) => {
    try {
        const { poolAmount, projects } = req.body;

        const payoutDistribution = calculateQuadraticFunding(poolAmount, projects);

        res.json({
            success: true,
            totalPoolAmount: poolAmount,
            distribution: payoutDistribution
        });
    } catch (err) {
        res.status(500).json({ error: 'Quadratic funding calculation failed', message: err.message });
    }
});

export default router;
