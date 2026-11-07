
import mongoose from 'mongoose';

const contributionScoreSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            index: true
        },

        repository: {
            type: String,
            required: true
        },

        prNumber: {
            type: Number,
            required: true
        },

        score: {
            type: Number,
            required: true
        },

        algorithmVersion: {
            type: String,
            required: true
        },

        configurationSnapshot: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },

        calculatedAt: {
            type: Date,
            default: Date.now
        },

        // CID of the IPFS evidence package for this contribution (null until stored)
        evidenceCID: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true
    }
);

contributionScoreSchema.index(
    { username: 1, repository: 1, prNumber: 1 },
    { unique: true }
);

export default mongoose.model(
    'ContributionScore',
    contributionScoreSchema
);
