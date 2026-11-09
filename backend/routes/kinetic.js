import express from 'express';
import { calculateSpamPenalty, verifyProofOfBuild, calculateQuadraticFunding } from '../services/kineticMechanisms.js';
import { validateProofOfBuild, validateQuadraticFunding } from '../middleware/validate.js';
import ContributionEvent from '../models/ContributionEvent.js';
import { expectedShasForEvent, recordCiEvidence } from '../services/contributionIndex.js';

const router = express.Router();

// GET /api/kinetic/anti-gaming-score
router.post('/anti-gaming-score', (req, res) => {
  const { timestamps } = req.body;
  
  if (!Array.isArray(timestamps)) {
    return res.status(400).json({ error: 'timestamps array required' });
  }

  const penalty = calculateSpamPenalty(timestamps);
  res.status(200).json({
    penaltyMultiplier: penalty,
    status: penalty < 0.8 ? 'Velocity Penalty Applied' : 'Normal',
  });
});

/**
 * Endpoint 1: Verify Proof-of-Build (CI/CD trace)
 * Prevent Sybil attacks and verify real executions.
 *
 * GET /api/kinetic/proof-of-build?repo=owner/repo&runId=1234[&sha=<commit>][&pr=<number>]
 *
 * With `pr`, the run must have run on that indexed PR's head or merge commit,
 * and the GitHub-confirmed result is stored on the PR as ciEvidence. With
 * `sha`, the run must have run on that commit. Without either, only the run's
 * outcome is checked and evidence.matchedCommit is null.
 */
router.get('/proof-of-build', validateProofOfBuild, async (req, res) => {
    try {
        const repo = req.normalizedRepo || req.query.repo;
        const runId = req.query.runId;
        const token = process.env.GITHUB_PAT;

        let event = null;
        let expectedShas = [];
        if (req.prNumber) {
            event = await ContributionEvent.findOne({ repoKey: repo.toLowerCase(), prNumber: req.prNumber })
                .select('repoKey prNumber headSha mergeCommitSha')
                .lean();
            if (!event) {
                return res.status(404).json({ success: false, error: `PR #${req.prNumber} in ${repo} is not in the contribution index.` });
            }
            expectedShas = expectedShasForEvent(event);
            if (expectedShas.length === 0) {
                return res.status(409).json({ success: false, error: `PR #${req.prNumber} in ${repo} has no commit SHAs yet; its details have not been fetched.` });
            }
            if (req.expectedSha) {
                expectedShas = expectedShas.filter(e => e.sha.toLowerCase().startsWith(req.expectedSha));
                if (expectedShas.length === 0) {
                    return res.status(400).json({ success: false, error: `Commit ${req.expectedSha} is not the head or merge commit of PR #${req.prNumber}.` });
                }
            }
        } else if (req.expectedSha) {
            expectedShas = [{ sha: req.expectedSha, kind: 'commit' }];
        }

        const evidence = await verifyProofOfBuild(repo, runId, token, { expectedShas });
        const stored = event ? await recordCiEvidence(ContributionEvent, event, evidence) : false;

        res.json({
            success: true,
            repo,
            runId,
            verifiedStatus: evidence.verified ? "✅ Valid (Execution Proven)" : "❌ Invalid (Execution Failed or Forged)",
            creditsGenerated: evidence.verified ? 1 : 0,
            evidence: { ...evidence, stored }
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