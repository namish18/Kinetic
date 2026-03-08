const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/User');
const { createDIDDocument, uploadToIPFS } = require('../services/didService');

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
            callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:5000/api/auth/github/callback',
            scope: ['user:email'],
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Check if user already exists
                let user = await User.findOne({ githubId: profile.id });

                if (user) {
                    console.log(`✅ Existing user logged in: ${user.github} (DID: ${user.did})`);
                    return done(null, user);
                }

                // --- New user: Create DID and store on IPFS ---
                console.log(`🆕 New user: ${profile.username} — creating DID...`);

                // 1. Create the DID document
                const didDocument = createDIDDocument(profile);
                console.log(`📄 DID Document created: ${didDocument.id}`);

                // 2. Upload DID document to IPFS
                const ipfsCID = await uploadToIPFS(didDocument);
                console.log(`📌 Pinned to IPFS: ${ipfsCID}`);

                // 3. Save user to MongoDB with DID reference
                user = await User.create({
                    githubId: profile.id,
                    github: profile.username,
                    displayName: profile.displayName || profile.username,
                    email: profile.emails?.[0]?.value || null,
                    avatarUrl: profile.photos?.[0]?.value || null,
                    did: didDocument.id,
                    ipfsCID: ipfsCID,
                    didDocument: didDocument,
                });

                console.log(`✅ User saved to MongoDB: ${user.github} (DID: ${user.did}, CID: ${user.ipfsCID})`);
                return done(null, user);
            } catch (error) {
                console.error('❌ GitHub OAuth error:', error);
                return done(error, null);
            }
        }
    )
);

module.exports = passport;
