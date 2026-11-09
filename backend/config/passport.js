/**
 * Passport GitHub OAuth Strategy
 *
 * SEC-04 Fix:
 * 1. Existing users retain their database role and cannot be overwritten via session/query inputs.
 * 2. New users strictly default to the 'contributor' role.
 * 3. Preserves Ed25519 DID generation and IPFS publishing pipeline.
 */

import 'dotenv/config';

import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import User from '../models/User.js';
import {
    authenticateDID,
    buildIdentityDocument,
    uploadToIPFS,
} from '../services/didService.js';

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
            passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
            try {
                // ── Returning user ──────────────────────────────────────────
                let user = await User.findOne({ githubId: profile.id });
                if (user) {
                    // SEC-04 FIX: Ignore untrusted sessionRole updates and preserve existing DB role
                    console.log(`✅ Existing user logged in: @${user.github} | Role: ${user.role} | DID: ${user.did}`);
                    return done(null, user);
                }

                // ── New user: full DID + IPFS flow ──────────────────────────
                console.log(`\n🆕 New user: @${profile.username} — running DID + IPFS pipeline`);

                // Step 1 & 2: Generate did:key from Ed25519 keypair
                const { didString, didDocument } = authenticateDID(profile.id);
                console.log(`   🔑 did:key: ${didString}`);

                // Step 3: Build enriched identity document
                const identityDoc = buildIdentityDocument(profile, didString, didDocument);
                console.log(`   📄 Identity document built`);

                // Step 4: Upload to IPFS
                const ipfsCID = await uploadToIPFS(identityDoc);
                console.log(`   📌 Stored on IPFS — CID: ${ipfsCID}`);

                // SEC-04 FIX: Always assign default 'contributor' role to new OAuth users
                const defaultRole = 'contributor';

                // Step 5: Persist in MongoDB with safe default role
                user = await User.create({
                    githubId: profile.id,
                    github: profile.username,
                    displayName: profile.displayName || profile.username,
                    email: profile.emails?.[0]?.value || null,
                    avatarUrl: profile.photos?.[0]?.value || null,
                    did: didString,
                    ipfsCID,
                    didDocument: identityDoc,
                    role: defaultRole,
                });
                console.log(`   ✅ MongoDB record created for @${user.github} with role: ${defaultRole}\n`);

                return done(null, user);
            } catch (error) {
                console.error('❌ GitHub OAuth / DID pipeline error:', error);
                return done(error, null);
            }
        }
    )
);

export default passport;