/**
 * Passport GitHub OAuth Strategy
 *
 * On first login:
 *  1. Derives Ed25519 seed from GitHub ID + DID_SEED_SECRET (HMAC-SHA256)
 *  2. Generates a real did:key (Ed25519) via tweetnacl + multiformats
 *  3. Uploads enriched identity document to IPFS via Helia (Protocol Labs)
 *  4. Persists the DID + CID reference in MongoDB
 *
 * Returning users are looked up by githubId — no re-processing needed.
 */

// ⚠️  MUST be first: loads .env before GitHubStrategy reads process.env
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
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // ── Returning user ──────────────────────────────────────────
                let user = await User.findOne({ githubId: profile.id });
                if (user) {
                    console.log(`✅ Existing user: @${user.github}  DID: ${user.did}`);
                    return done(null, user);
                }

                // ── New user: full DID + IPFS flow ──────────────────────────
                console.log(`\n🆕 New user: @${profile.username} — running DID + IPFS pipeline`);

                // Step 1 & 2: Generate did:key from Ed25519 keypair
                // (tweetnacl Ed25519 + multiformats base58btc — Protocol Labs stack)
                const { didString, didDocument } = authenticateDID(profile.id); // sync
                console.log(`   🔑 did:key: ${didString}`);

                // Step 3: Build enriched identity document
                const identityDoc = buildIdentityDocument(profile, didString, didDocument);
                console.log(`   📄 Identity document built`);

                // Step 4: Upload to IPFS via Storacha (Protocol Labs w3up-client)
                const ipfsCID = await uploadToIPFS(identityDoc);
                console.log(`   📌 Stored on IPFS — CID: ${ipfsCID}`);

                // Step 5: Persist in MongoDB
                user = await User.create({
                    githubId: profile.id,
                    github: profile.username,
                    displayName: profile.displayName || profile.username,
                    email: profile.emails?.[0]?.value || null,
                    avatarUrl: profile.photos?.[0]?.value || null,
                    did: didString,
                    ipfsCID,
                    didDocument: identityDoc,
                });
                console.log(`   ✅ MongoDB record created for @${user.github}\n`);

                return done(null, user);
            } catch (error) {
                console.error('❌ GitHub OAuth / DID pipeline error:', error);
                return done(error, null);
            }
        }
    )
);

export default passport;
