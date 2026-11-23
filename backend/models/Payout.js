import mongoose from 'mongoose';

const payoutSchema = new mongoose.Schema({
    contributionId: { type: String, required: true },
    epochId: { type: String, required: true, default: 'epoch-default' },
    username: { type: String, required: true },
    wallet: { type: String, required: true },
    amount: { type: Number, required: true },
    // SEC-05 Multisig Attributes
    approvals: [{ type: String }], // Unique list of approving user IDs / signer addresses
    requiredThreshold: { type: Number, default: 2 }, // Flow 3 Multisig Threshold
    status: { 
        type: String, 
        enum: ['pending', 'pending_approvals', 'pending_wallet', 'success', 'failed', 'already_processed'], 
        default: 'pending_approvals' 
    },
    txResult: { type: Object, default: null },
    createdAt: { type: Date, default: Date.now }
});

payoutSchema.index({ contributionId: 1, epochId: 1 }, { unique: true });

const Payout = mongoose.model('Payout', payoutSchema);
export default Payout;