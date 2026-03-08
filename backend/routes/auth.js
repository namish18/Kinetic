const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getFromIPFS } = require('../services/didService');

const router = express.Router();

/**
 * @route   GET /api/auth/github
 * @desc    Redirect to GitHub OAuth
 */
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

/**
 * @route   GET /api/auth/github/callback
 * @desc    GitHub OAuth callback — creates DID, uploads to IPFS, saves to MongoDB
 */
router.get(
    '/github/callback',
    passport.authenticate('github', { failureRedirect: '/login?error=auth_failed' }),
    (req, res) => {
        // Generate JWT token
        const token = jwt.sign(
            {
                id: req.user._id,
                github: req.user.github,
                did: req.user.did,
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Redirect to frontend with token
        const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendURL}/dashboard?token=${token}`);
    }
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile (requires JWT)
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-__v');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                github: user.github,
                displayName: user.displayName,
                email: user.email,
                avatarUrl: user.avatarUrl,
                did: user.did,
                ipfsCID: user.ipfsCID,
                wallet: user.wallet,
                didDocument: user.didDocument,
                createdAt: user.createdAt,
            },
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * @route   GET /api/auth/did/:username
 * @desc    Resolve a DID by GitHub username
 */
router.get('/did/:username', async (req, res) => {
    try {
        const user = await User.findOne({ github: req.params.username });
        if (!user) {
            return res.status(404).json({ error: 'DID not found for this user' });
        }

        // Try to fetch the DID document from IPFS
        let ipfsDocument = null;
        if (user.ipfsCID) {
            ipfsDocument = await getFromIPFS(user.ipfsCID);
        }

        res.json({
            success: true,
            did: user.did,
            ipfsCID: user.ipfsCID,
            didDocument: ipfsDocument || user.didDocument,
            mongoRecord: {
                github: user.github,
                did: user.did,
                ipfsCID: user.ipfsCID,
                wallet: user.wallet,
            },
        });
    } catch (error) {
        console.error('Error resolving DID:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * @route   PUT /api/auth/wallet
 * @desc    Update wallet address for a user
 */
router.put('/wallet', authenticateToken, async (req, res) => {
    try {
        const { wallet } = req.body;
        if (!wallet) {
            return res.status(400).json({ error: 'Wallet address is required' });
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { wallet },
            { new: true }
        );

        res.json({
            success: true,
            message: 'Wallet address updated',
            user: {
                github: user.github,
                did: user.did,
                wallet: user.wallet,
            },
        });
    } catch (error) {
        console.error('Error updating wallet:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * @route   GET /api/auth/logout
 * @desc    Logout user
 */
router.get('/logout', (req, res) => {
    req.logout(() => {
        res.json({ success: true, message: 'Logged out' });
    });
});

/**
 * Middleware to authenticate JWT tokens
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}

module.exports = router;
