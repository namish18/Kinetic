/**
 * Passport GitHub OAuth Strategy
 *
 * Contributor-Controlled Identity (DID-01):
 * On first login:
 *  1. Creates user account in MongoDB bound to GitHub profile
 *  2. Contributor retains exclusive control over private keys; server does NOT
 *     generate or derive contributor private keys.
 *  3. Contributor subsequently registers their client-generated DID key via
 *     POST /api/auth/register-did with cryptographic proof of possession.
 *
 * Returning users are looked up by githubId — no re-processing needed.
 */

// ⚠️  MUST be first: loads .env before GitHubStrategy reads process.env
import 'dotenv/config';

import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import User from '../models/User.js';

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

passport.use(
    new GitHubStrategy(
        {
            clientID: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            callbackURL:
                process.env.GITHUB_CALLBACK_URL ||
                'http://localhost:5000/api/auth/github/callback',
            scope: ['user:email'],
            passReqToCallback: true,  // ← gives us access to req.session inside the verify fn
        },
        async (req, accessToken, refreshToken, profile, done) => {
            try {
                // Role comes from the session set in GET /api/auth/github?role=…
                const sessionRole = req.session?.role || 'contributor';

                // ── Returning user ──────────────────────────────────────────
                let user = await User.findOne({ githubId: profile.id });
                if (user) {
                    // Allow role upgrade if they explicitly re-authenticated with a different role
                    if (sessionRole && user.role !== sessionRole) {
                        user = await User.findByIdAndUpdate(
                            user._id,
                            { role: sessionRole },
                            { new: true }
                        );
                        console.log(`🔄 Existing user @${user.github} role updated → ${sessionRole}`);
                    } else {
                        console.log(`✅ Existing user: @${user.github}  DID: ${user.did}`);
                    }
                    return done(null, user);
                }

                // ── New user: create record without server-derived private keys (DID-01) ──
                console.log(`\n🆕 New user: @${profile.username} — created under Contributor-Controlled Identity`);

                user = await User.create({
                    githubId: profile.id,
                    github: profile.username,
                    displayName: profile.displayName || profile.username,
                    email: profile.emails?.[0]?.value || null,
                    avatarUrl: profile.photos?.[0]?.value || null,
                    did: null,
                    ipfsCID: null,
                    didDocument: null,
                    role: sessionRole,
                });
                console.log(`   ✅ MongoDB record created for @${user.github} as ${sessionRole} (DID pending contributor registration)\n`);

                return done(null, user);
            } catch (error) {
                console.error('❌ GitHub OAuth / DID pipeline error:', error);
                return done(error, null);
            }
        }
    )
);

export default passport;
