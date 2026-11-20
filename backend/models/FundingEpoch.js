
import mongoose from 'mongoose';

const eligibilitySchema = new mongoose.Schema({
    minScore: { type: Number, default: 0, min: 0 },
    minMergedPRs: { type: Number, default: 1, min: 0 },
    allowedRepositories: [{ type: String }],
    requiredLabels: [{ type: String }]
}, { _id: false });

const configurationSchema = new mongoose.Schema({
    weights: {
        impact: { type: Number, default: 0.2 },
        complexity: { type: Number, default: 0.2 },
        quality: { type: Number, default: 0.2 },
        review: { type: Number, default: 0.2 },
        priority: { type: Number, default: 0.2 }
    },
    algorithmVersion: { type: String, default: 'msts-v2.0.0' }
}, { _id: false });

const fundingEpochSchema = new mongoose.Schema({
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
        type: String,
        enum: ['DRAFT', 'ACTIVE', 'FINALIZED'],
        default: 'DRAFT',
        index: true
    },
    eligibility: {
        type: eligibilitySchema,
        default: () => ({})
    },
    configuration: {
        type: configurationSchema,
        default: () => ({})
    },
    configurationSnapshot: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    activatedAt: { type: Date, default: null },
    finalizedAt: { type: Date, default: null },
    finalizationSnapshot: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

fundingEpochSchema.index({ organization: 1, startDate: 1, endDate: 1 });

export default mongoose.model('FundingEpoch', fundingEpochSchema);
