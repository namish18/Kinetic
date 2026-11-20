
import mongoose from 'mongoose';

const contributionEvidenceSchema = new mongoose.Schema(
    {
        schemaVersion: {
            type: Number,
            required: true,
            immutable: true
        },
        evidenceHash: {
            type: String,
            required: true,
            unique: true,
            immutable: true,
            match: /^[a-f0-9]{64}$/
        },
        payload: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
            immutable: true
        },
        createdAt: {
            type: Date,
            default: Date.now,
            immutable: true
        }
    },
    {
        versionKey: false,
        timestamps: false
    }
);

// Application-level protection against modifying or deleting evidence.
for (const operation of [
    'updateOne',
    'updateMany',
    'findOneAndUpdate',
    'replaceOne',
    'deleteOne',
    'deleteMany',
    'findOneAndDelete'
]) {
    contributionEvidenceSchema.pre(operation, function () {
        throw new Error(
            'Contribution evidence is immutable and cannot be modified or deleted.'
        );
    });
}

export default mongoose.model(
    'ContributionEvidence',
    contributionEvidenceSchema
);
