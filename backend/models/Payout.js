import mongoose from 'mongoose';

const payoutSchema = new mongoose.Schema({
    contributionId: { type: String, required: true },
    epochId: { type: String, required: true, default: 'epoch-default' },
    username: { type: String, required: true },
    wallet: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { 
        type: String, 
        enum: ['pending', 'pending_wallet', 'success', 'failed', 'already_processed'], 
        default: 'pending' 
    },
    txResult: { type: Object, default: null },
    createdAt: { type: Date, default: Date.now }
});

// Enforce strictly one payout per contribution per funding epoch
payoutSchema.index({ contributionId: 1, epochId: 1 }, { unique: true });

const Payout = mongoose.model('Payout', payoutSchema);
export default Payout;