import mongoose from 'mongoose';

/**
 * Persistent contribution index — one document per contribution event.
 *
 * Field names are kept generic so other event types (e.g. commit / merge
 * attribution) can be stored later without a migration. Today only merged
 * pull requests ('pr_merge') are indexed.
 */
const contributionEventSchema = new mongoose.Schema({
    type: { type: String, required: true, default: 'pr_merge' },

    // Repository as GitHub reports it (owner/repo) and its lowercased lookup key
    repo: { type: String, required: true },
    repoKey: { type: String, required: true },

    // Pull request number (absent for non-PR event types)
    prNumber: { type: Number },

    // Author GitHub login, lowercased lookup key, numeric id and avatar
    author: { type: String, required: true },
    authorKey: { type: String, required: true },
    authorId: { type: Number },
    authorAvatar: { type: String },

    title: { type: String },
    url: { type: String },      // html_url
    apiUrl: { type: String },   // REST API url used to fetch details
    mergedAt: { type: Date },

    // Commit references (filled from PR details; used by commit-level attribution later)
    mergeCommitSha: { type: String, default: null },
    headSha: { type: String, default: null },

    // Raw PR fields needed by extractPRMetrics()
    stats: {
        additions: { type: Number },
        deletions: { type: Number },
        changedFiles: { type: Number },
        commits: { type: Number },
        comments: { type: Number },
        reviewComments: { type: Number },
        merged: { type: Boolean },
        labels: [{ type: String }]
    },

    fetchedAt: { type: Date },                         // last seen in a search result
    detailsFetchedAt: { type: Date, default: null },  // last time stats were fetched

    // PR Review Attribution: actual reviewers, review decisions, and substantive review activity
    reviews: [{
        reviewId: { type: Number },
        reviewer: { type: String },
        reviewerKey: { type: String },
        reviewerId: { type: Number },
        reviewerAvatar: { type: String },
        decision: { type: String }, // 'APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED'
        state: { type: String },
        body: { type: String, default: '' },
        submittedAt: { type: Date },
        commitId: { type: String },
        htmlUrl: { type: String },
        hasInlineComments: { type: Boolean, default: false },
        inlineCommentsCount: { type: Number, default: 0 },
        isSubstantive: { type: Boolean, default: false },
        substantiveReason: { type: String }
    }],
    reviewers: [{ type: String }],
    substantiveReviewers: [{ type: String }],
    reviewSummary: {
        totalReviews: { type: Number, default: 0 },
        approvedCount: { type: Number, default: 0 },
        changesRequestedCount: { type: Number, default: 0 },
        commentedCount: { type: Number, default: 0 },
        dismissedCount: { type: Number, default: 0 },
        substantiveReviewCount: { type: Number, default: 0 },
        hasSubstantiveReview: { type: Boolean, default: false }
    },
    reviewsFetchedAt: { type: Date, default: null }
});

contributionEventSchema.index(
    { repoKey: 1, prNumber: 1 },
    { unique: true, partialFilterExpression: { prNumber: { $exists: true } } }
);
contributionEventSchema.index({ authorKey: 1, mergedAt: -1 });
contributionEventSchema.index({ repoKey: 1, mergedAt: -1 });
contributionEventSchema.index({ 'reviews.reviewerKey': 1, mergedAt: -1 });

export default mongoose.model('ContributionEvent', contributionEventSchema);
