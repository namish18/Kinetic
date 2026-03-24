import express from 'express';
import User from '../models/User.js';
import { computeMSTS } from '../services/contributionService.js';

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

            // Use the repository-specific weights passed down to MSTS or related logic
            const { impact, complexity, quality, review, priority } = repoConfig.weights;

            // In a real scenario, you'd pass these custom weights to the algorithm. 
            // We simulate it here by logging them and executing MSTS.
            console.log(`Webhook: Using custom weights - Impact: ${impact}, Complexity: ${complexity}, Quality: ${quality}, Review: ${review}, Priority: ${priority}`);

            const githubToken = process.env.GITHUB_PAT || null;
            const result = await computeMSTS(contributorUsername, githubToken, { proofOfBuild: false });

            const finalScore = result.finalScore || 0;
            
            // Example payout logic: BOUNTY_POOL * (finalScore / 100) or however you wish to map score -> payout
            const estPayoutFlow = (finalScore * 5); // arbitrarily scaling for illustration
            
            console.log(`Webhook: Payout calculated for ${contributorUsername} -> Score: ${finalScore}, Est payout: ${estPayoutFlow} FLOW\n`);

            // Next step would be executing a smart contract payload to transfer the FLOW 
            // from the Org wallet to the Contributor Wallet...

            return res.status(200).json({ 
                success: true, 
                message: 'Payout calculated', 
                score: finalScore,
                payout: estPayoutFlow,
                contributor: contributorUsername 
            });
        }

        res.status(200).send('Event unhandled but acknowledged');
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed', details: error.message });
    }
});

export default router;
