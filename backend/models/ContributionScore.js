
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
        evidenceReference: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ContributionEvidence',
            default: null
        },
        evidenceHash: {
            type: String,
            default: null,
            match: /^[a-f0-9]{64}$/
        },
        evidenceSchemaVersion: {
            type: Number,
            default: null
        },
        calculatedAt: {
            type: Date,
            default: Date.now
        },

        // CID of the IPFS evidence package for this contribution (null until stored)
        evidenceCID: {
            type: String,
            default: null
        },

        // sha256 of the stored evidence package; changes whenever the evidence changes
        evidenceDigest: {
            type: String,
            default: null
        },

        // true while CI results were still running or unreadable when the package was built
        evidencePending: {
            type: Boolean,
            default: false
        },

        // when evidence was last checked against GitHub
        evidenceCheckedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

contributionScoreSchema.index(
    {
        username: 1,
        repository: 1,
        prNumber: 1
    },
    {
        unique: true
    }
);

// Evidence fields must either all be present or all be absent.
// This keeps older score records readable while enforcing complete
// evidence links for newly persisted records.
contributionScoreSchema.pre('validate', function (next) {
    const fields = [
        this.evidenceReference,
        this.evidenceHash,
        this.evidenceSchemaVersion
    ];

    const presentCount = fields.filter(
        value => value !== null && value !== undefined
    ).length;

    if (presentCount !== 0 && presentCount !== fields.length) {
        return next(
            new Error(
                'Evidence reference, hash and schema version must be stored together.'
            )
        );
    }

    next();
});

export default mongoose.model(
    'ContributionScore',
    contributionScoreSchema
);
