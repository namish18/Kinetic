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
import { encryptGitHubToken } from '../services/githubTokenService.js';

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
            // public_repo is the least-privilege default for Kinetic's public
            // repositories. Deployments supporting private repositories can
            // set GITHUB_OAUTH_SCOPES=user:email,repo.
            scope: (process.env.GITHUB_OAUTH_SCOPES || 'user:email,public_repo')
                .split(',')
                .map(scope => scope.trim())
                .filter(Boolean),
            passReqToCallback: true,  // ← gives us access to req.session inside the verify fn
        },
        async (req, accessToken, refreshToken, profile, done) => {
            try {
                let encryptedAccessToken;
                if (process.env.GITHUB_TOKEN_ENCRYPTION_KEY) {
                    encryptedAccessToken = encryptGitHubToken(accessToken);
                }

                // Role comes from the session set in GET /api/auth/github?role=…
                const sessionRole = req.session?.role || 'contributor';

                // ── Returning user ──────────────────────────────────────────
                let user = await User.findOne({ githubId: profile.id });
                if (user) {
                    // Refresh the encrypted token on every OAuth login so existing
                    // accounts receive the newly requested repository scope.
                    let changed = false;
                    if (encryptedAccessToken) {
                        user.githubAccessTokenEncrypted = encryptedAccessToken;
                        changed = true;
                    }
                    if (sessionRole && user.role !== sessionRole) {
                        user.role = sessionRole;
                        changed = true;
                        console.log(`🔄 Existing user @${user.github} role updated → ${sessionRole}`);
                    }
                    if (changed) await user.save();
                    if (!encryptedAccessToken) {
                        console.warn('GitHub token encryption is not configured; repository administration checks will remain unavailable.');
                    }
                    console.log(`✅ Existing user: @${user.github}  DID: ${user.did}`);
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
                    ...(encryptedAccessToken && { githubAccessTokenEncrypted: encryptedAccessToken }),
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
