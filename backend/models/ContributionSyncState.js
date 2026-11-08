import mongoose from 'mongoose';

/**
 * Incremental sync cursor for the contribution index.
 *
 * scope is 'author:<login>' or 'repo:<owner/repo>' (lowercased). Everything
 * merged before lastMergedAt has already been indexed for that scope, except
 * when historyTruncated is set: the first sync hit GitHub's 1000-result cap,
 * so only the 1000 most recently updated PRs from before then are indexed.
 */
const contributionSyncStateSchema = new mongoose.Schema({
    scope: { type: String, required: true, unique: true },
    lastMergedAt: { type: Date, required: true },
    lastSyncedAt: { type: Date },
    historyTruncated: { type: Boolean, default: false }
});

export default mongoose.model('ContributionSyncState', contributionSyncStateSchema);
