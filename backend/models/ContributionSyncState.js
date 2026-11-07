import mongoose from 'mongoose';

/**
 * Incremental sync cursor for the contribution index.
 *
 * scope is 'author:<login>' or 'repo:<owner/repo>' (lowercased). Everything
 * merged before lastMergedAt has already been indexed for that scope.
 */
const contributionSyncStateSchema = new mongoose.Schema({
    scope: { type: String, required: true, unique: true },
    lastMergedAt: { type: Date, required: true },
    lastSyncedAt: { type: Date }
});

export default mongoose.model('ContributionSyncState', contributionSyncStateSchema);
