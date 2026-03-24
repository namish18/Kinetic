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
 * Get org repositories and weights
 */
router.get('/info', authenticateToken, requireOrg, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json({ success: true, repositories: user.repositories, weights: user.weights });
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
        if (!user.repositories.includes(repository)) {
            user.repositories.push(repository);
            await user.save();
        }

        res.json({ success: true, repositories: user.repositories });
    } catch (error) {
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

/**
 * DELETE /api/org/repositories
 * Remove a repository
 */
router.delete('/repositories', authenticateToken, requireOrg, async (req, res) => {
    try {
        const { repository } = req.body;
        if (!repository) return res.status(400).json({ error: 'Repository name required (e.g. owner/repo)' });

        const user = await User.findById(req.user.id);
        user.repositories = user.repositories.filter(r => r !== repository);
        await user.save();

        res.json({ success: true, repositories: user.repositories });
    } catch (error) {
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

/**
 * PUT /api/org/weights
 * Update algorithm weights
 */
router.put('/weights', authenticateToken, requireOrg, async (req, res) => {
    try {
        const { impact, complexity, quality, review, priority } = req.body;
        
        const user = await User.findById(req.user.id);
        
        user.weights = {
            impact: impact !== undefined ? impact : user.weights.impact,
            complexity: complexity !== undefined ? complexity : user.weights.complexity,
            quality: quality !== undefined ? quality : user.weights.quality,
            review: review !== undefined ? review : user.weights.review,
            priority: priority !== undefined ? priority : user.weights.priority
        };
        await user.save();

        res.json({ success: true, weights: user.weights });
    } catch (error) {
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

export default router;
