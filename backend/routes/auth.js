import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { getFromIPFS, authenticateDID } from '../services/didService.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────
//  GitHub OAuth
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/auth/github
 * Kick off the GitHub OAuth dance.
 * SEC-04 Fix: Removed session role setting from req.query to prevent privilege escalation.
 */
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

/**
 * GET /api/auth/github/callback
 * GitHub redirects back here after authorization.
 */
router.get(
    '/github/callback',
    passport.authenticate('github', { failureRedirect: '/?error=auth_failed' }),
    async (req, res) => {
        // Role is safely read directly from req.user (preserved DB role or default contributor)
        const finalRole = req.user.role || 'contributor';

        const token = jwt.sign(
            { id: req.user._id, github: req.user.github, did: req.user.did, role: finalRole },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
        const redirectPath = finalRole === 'organization' ? '/org-dashboard' : '/dashboard';

        console.log(`🔀 Redirecting @${req.user.github} (${finalRole}) → ${redirectPath}`);
        res.redirect(`${frontendURL}${redirectPath}?token=${token}`);
    }
);

// ─────────────────────────────────────────────────────────────
//  Profile
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/auth/me
 * Return the current user's profile (JWT required)
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-__v');
        if (!user) return res.status(404).json({ error: 'User not found' });

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
                role: user.role,
                repositories: user.repositories,
                didDocument: user.didDocument,
                createdAt: user.createdAt,
            },
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─────────────────────────────────────────────────────────────
//  DID Resolution
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/auth/did/:username
 * Public endpoint — resolve a did:key by GitHub username.
 */
router.get('/did/:username', async (req, res) => {
    try {
        const user = await User.findOne({ github: req.params.username });
        if (!user) {
            return res.status(404).json({ error: `No DID found for @${req.params.username}` });
        }

        let liveDocument = null;
        if (user.ipfsCID && !user.ipfsCID.startsWith('sha256-')) {
            liveDocument = await getFromIPFS(user.ipfsCID);
        }

        res.json({
            success: true,
            mongoRecord: {
                github: user.github,
                did: user.did,
                ipfsCID: user.ipfsCID,
                wallet: user.wallet,
            },
            didDocument: liveDocument || user.didDocument,
            gatewayUrl: user.ipfsCID && !user.ipfsCID.startsWith('sha256-')
                ? `https://w3s.link/ipfs/${user.ipfsCID}`
                : null,
        });
    } catch (error) {
        console.error('Error resolving DID:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/auth/did-resolve/self
 */
router.get('/did-resolve/self', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const { didString, didDocument } = await authenticateDID(user.githubId);

        res.json({
            success: true,
            did: didString,
            didDocument,
            mongoRecord: {
                github: user.github,
                did: user.did,
                ipfsCID: user.ipfsCID,
            },
        });
    } catch (error) {
        console.error('Error re-resolving DID:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─────────────────────────────────────────────────────────────
//  Wallet
// ─────────────────────────────────────────────────────────────

/**
 * PUT /api/auth/wallet
 */
router.put('/wallet', authenticateToken, async (req, res) => {
    try {
        const { wallet } = req.body;
        if (!wallet) return res.status(400).json({ error: 'Wallet address is required' });

        const user = await User.findByIdAndUpdate(req.user.id, { wallet }, { new: true });

        res.json({
            success: true,
            message: 'Wallet linked to DID',
            record: { github: user.github, did: user.did, wallet: user.wallet },
        });
    } catch (error) {
        console.error('Error linking wallet:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─────────────────────────────────────────────────────────────
//  Logout
// ─────────────────────────────────────────────────────────────

router.get('/logout', (req, res) => {
    req.logout(() => res.json({ success: true, message: 'Logged out' }));
});

// ─────────────────────────────────────────────────────────────
//  JWT Middleware
// ─────────────────────────────────────────────────────────────

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

export default router;