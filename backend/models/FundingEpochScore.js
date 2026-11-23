
import mongoose from 'mongoose';

const fundingEpochScoreSchema = new mongoose.Schema({
    epoch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FundingEpoch',
        required: true,
        index: true
    },
    contributionEvent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ContributionEvent',
        required: true
    },
    username: { type: String, required: true, index: true },
    repository: { type: String, required: true },
    prNumber: { type: Number, required: true },
    score: { type: Number, required: true, min: 0 },
    eligible: { type: Boolean, required: true },
    eligibilityReason: { type: String, default: null },
    algorithmVersion: { type: String, required: true },
    configurationSnapshot: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    scoringDetails: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    }
}, { timestamps: true });

fundingEpochScoreSchema.index(
    { epoch: 1, repository: 1, prNumber: 1 },
    { unique: true }
);

fundingEpochScoreSchema.index({ epoch: 1, username: 1 });

export default mongoose.model('FundingEpochScore', fundingEpochScoreSchema);
