import express from 'express';
import User from '../models/User.js';
import { extractPRMetrics, calculatePRScore } from '../services/contributionService.js';

const router = express.Router();

/**
 * POST /api/webhook/github
 * Listens for GitHub webhook events.
 * The moment a new PR gets merged to the target branch, the payout will be calculated.
 */
router.post('/github', async (req, res) => {
    try {
        const event = req.headers['x-github-event'];
        
        // We only care about pull requests
        if (event !== 'pull_request') {
            return res.status(200).send('Not a pull request event');
        }

        const payload = req.body;
        
        // Only trigger payout logic when PR is closed and actually merged
        if (payload.action === 'closed' && payload.pull_request.merged === true) {
            const repoFullName = payload.repository.full_name; // e.g. "owner/repo"
            const targetBranch = payload.pull_request.base.ref; // e.g. "main"
            const contributorUsername = payload.pull_request.user.login;

            console.log(`\nWebhook: Merged PR in ${repoFullName} to ${targetBranch} by ${contributorUsername}`);

            // Find an organization that tracks this repository
            const orgUser = await User.findOne({
                role: 'organization',
                'repositories.name': repoFullName
            });

            if (!orgUser) {
                console.log(`Webhook: Repository ${repoFullName} is not tracked by any organization.`);
                return res.status(200).send('Repository not tracked');
            }

            // Get the specific repository config
            const repoConfig = orgUser.repositories.find(r => r.name === repoFullName);
            
            // The organization will decide which branch will be the target branch, it can be of multiple branches.
            if (!repoConfig.targetBranches.includes(targetBranch)) {
                console.log(`Webhook: Branch ${targetBranch} is not a target branch for payouts in ${repoFullName}.`);
                return res.status(200).send('Merged to untracked branch');
            }

            console.log(`Webhook: Target branch matched! Calculating payout algorithm using org weights...`);

            // Calculate payout based on true PR dimensions
            const prMetrics = extractPRMetrics(payload.pull_request);
            
            // Execute the explicit algorithm from contribution_algo.md
            const result = calculatePRScore(prMetrics, repoConfig.weights, { 
                reputation: 100 // TODO: fetch real contributor reputation from DB
            });

            // result.score is in [0, ~1.5] range; map to 0-100 display score
            const finalScore = result.score ? Math.round(result.score * 100) : 0;
            
            console.log(`Webhook: Contribution ${contributorUsername} scored at ${finalScore}; it will be considered in the next funding-pool allocation.\\n`);

            return res.status(200).json({
                success: true,
                message: 'Contribution scored and made available for the next funding-pool allocation',
                score: finalScore,
                payout: null,
                contributor: contributorUsername,
                flowStatus: 'awaiting_funding_pool_allocation',
                transactionId: null
            });
        }

        res.status(200).send('Event unhandled but acknowledged');
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed', details: error.message });
    }
});

export default router;
