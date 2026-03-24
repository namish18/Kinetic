import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

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

function requireOrg(req, res, next) {
    if (req.user.role !== 'organization') {
        return res.status(403).json({ error: 'Only organizations can perform this action' });
    }
    next();
}

/**
 * GET /api/org/info
 * Get org repositories (includes branches and weights)
 */
router.get('/info', authenticateToken, requireOrg, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json({ success: true, repositories: user.repositories });
    } catch (error) {
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

/**
 * POST /api/org/repositories
 * Add a repository
 */
router.post('/repositories', authenticateToken, requireOrg, async (req, res) => {
    try {
        const { repository } = req.body;
        if (!repository) return res.status(400).json({ error: 'Repository name required (e.g. owner/repo)' });

        const user = await User.findById(req.user.id);
        const exists = user.repositories.find(r => r.name === repository);
        if (!exists) {
            user.repositories.push({
                name: repository,
                targetBranches: ['main'], // default
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
 * PUT /api/org/repositories/:repoId/branches
 * Set target branches
 */
router.put('/repositories/:repoId/branches', authenticateToken, requireOrg, async (req, res) => {
    try {
        const repoName = decodeURIComponent(req.params.repoId);
        const { targetBranches } = req.body;

        const user = await User.findById(req.user.id);
        const repo = user.repositories.find(r => r.name === repoName);
        
        if (!repo) {
            return res.status(404).json({ error: 'Repository not found' });
        }
        
        repo.targetBranches = targetBranches;
        await user.save();

        res.json({ success: true, repositories: user.repositories });
    } catch (error) {
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

/**
 * PUT /api/org/repositories/:repoId/weights
 * Update algorithm weights for a specific repo
 */
router.put('/repositories/:repoId/weights', authenticateToken, requireOrg, async (req, res) => {
    try {
        const repoName = decodeURIComponent(req.params.repoId);
        const { impact, complexity, quality, review, priority } = req.body;
        
        const user = await User.findById(req.user.id);
        const repo = user.repositories.find(r => r.name === repoName);
        
        if (!repo) {
            return res.status(404).json({ error: 'Repository not found' });
        }
        
        repo.weights = {
            impact: impact !== undefined ? impact : repo.weights.impact,
            complexity: complexity !== undefined ? complexity : repo.weights.complexity,
            quality: quality !== undefined ? quality : repo.weights.quality,
            review: review !== undefined ? review : repo.weights.review,
            priority: priority !== undefined ? priority : repo.weights.priority
        };
        await user.save();

        res.json({ success: true, repositories: user.repositories });
    } catch (error) {
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

export default router;
