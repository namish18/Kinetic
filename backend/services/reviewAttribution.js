/**
 * PR Review Attribution & Substantive Review Activity Detection
 *
 * Normalizes PR review records from GitHub, captures reviewer decisions,
 * detects substantive review activity (distinguishing meaningful written feedback
 * and inline code comments from empty reviews / approvals without feedback),
 * and prevents duplicate reviews.
 */

export const REVIEW_DECISIONS = {
    APPROVED: 'APPROVED',
    CHANGES_REQUESTED: 'CHANGES_REQUESTED',
    COMMENTED: 'COMMENTED',
    DISMISSED: 'DISMISSED'
};

const TRIVIAL_REGEX = /^(lgtm|looks good(\s+to\s+me)?|approved|\+1|:\+1:|nice|ok|k|good|thanks|thx|ty|fine|looks fine|passed|ready)[.!\s]*$/i;

/**
 * Normalizes a raw GitHub review state string into a standard decision.
 */
export function normalizeDecision(state) {
    if (!state || typeof state !== 'string') return REVIEW_DECISIONS.COMMENTED;
    const upper = state.trim().toUpperCase();
    if (REVIEW_DECISIONS[upper]) return REVIEW_DECISIONS[upper];
    return upper;
}

/**
 * True if a review body contains only trivial/boilerplate phrases without substantive content.
 */
export function isTrivialFeedback(body) {
    if (!body || typeof body !== 'string') return true;
    const trimmed = body.trim();
    if (trimmed.length === 0) return true;
    return TRIVIAL_REGEX.test(trimmed);
}

/**
 * Evaluates whether a review constitutes substantive review activity.
 *
 * Substantive activity includes:
 * 1. One or more inline code comments on the diff.
 * 2. Meaningful written feedback (constructive review body that is not empty or trivial boilerplate).
 *
 * Empty reviews or approvals without feedback are non-substantive.
 */
export function evaluateReviewSubstance(review, inlineComments = []) {
    const commentsList = Array.isArray(inlineComments) ? inlineComments : [];
    const inlineCommentsCount = commentsList.length;
    const hasInlineComments = inlineCommentsCount > 0;

    if (hasInlineComments) {
        return {
            isSubstantive: true,
            hasInlineComments: true,
            inlineCommentsCount,
            substantiveReason: 'inline_comments',
            details: `Included ${inlineCommentsCount} inline code comment(s)`
        };
    }

    const body = (review?.body || '').trim();
    if (!body || isTrivialFeedback(body) || body.length < 15) {
        return {
            isSubstantive: false,
            hasInlineComments: false,
            inlineCommentsCount: 0,
            substantiveReason: 'none',
            details: body ? 'Feedback is generic or brief without specific guidance' : 'No written feedback or inline comments provided'
        };
    }

    return {
        isSubstantive: true,
        hasInlineComments: false,
        inlineCommentsCount: 0,
        substantiveReason: 'written_feedback',
        details: 'Substantive written review comments provided'
    };
}

/**
 * Normalizes a single raw GitHub review object.
 */
export function normalizeReview(rawReview, inlineComments = []) {
    if (!rawReview) return null;

    const reviewer = rawReview.user?.login || 'unknown';
    const reviewerKey = reviewer.toLowerCase();
    const decision = normalizeDecision(rawReview.state);
    const body = (rawReview.body || '').trim();
    const substance = evaluateReviewSubstance(rawReview, inlineComments);

    return {
        reviewId: rawReview.id,
        reviewer,
        reviewerKey,
        reviewerId: rawReview.user?.id || null,
        reviewerAvatar: rawReview.user?.avatar_url || null,
        decision,
        state: decision,
        body,
        submittedAt: rawReview.submitted_at ? new Date(rawReview.submitted_at) : null,
        commitId: rawReview.commit_id || null,
        htmlUrl: rawReview.html_url || null,
        hasInlineComments: substance.hasInlineComments,
        inlineCommentsCount: substance.inlineCommentsCount,
        isSubstantive: substance.isSubstantive,
        substantiveReason: substance.substantiveReason
    };
}

/**
 * Normalizes an array of raw reviews and comments, associating inline comments
 * with their parent reviews, and deduplicating by review ID.
 *
 * @param {object[]} rawReviews - Array of raw GitHub review objects
 * @param {object[]} rawComments - Array of raw GitHub PR review comment objects (inline code comments)
 * @param {object[]} existingReviews - Already stored reviews for deduplication and update
 * @returns {{ reviews: object[], reviewers: string[], substantiveReviewers: string[], reviewSummary: object }}
 */
export function normalizeReviews(rawReviews = [], rawComments = [], existingReviews = []) {
    const commentsList = Array.isArray(rawComments) ? rawComments : [];
    const reviewsList = Array.isArray(rawReviews) ? rawReviews : [];
    const existingList = Array.isArray(existingReviews) ? existingReviews : [];

    // Group inline code comments by pull_request_review_id
    const commentsByReviewId = new Map();
    for (const comment of commentsList) {
        if (!comment) continue;
        const reviewId = comment.pull_request_review_id;
        if (reviewId != null) {
            if (!commentsByReviewId.has(reviewId)) {
                commentsByReviewId.set(reviewId, []);
            }
            commentsByReviewId.get(reviewId).push(comment);
        }
    }

    // Index existing reviews by reviewId to avoid duplicates
    const reviewsMap = new Map();
    for (const existing of existingList) {
        if (existing && existing.reviewId != null) {
            reviewsMap.set(existing.reviewId, existing);
        }
    }

    // Normalize each review and update map
    for (const raw of reviewsList) {
        if (!raw || raw.id == null) continue;
        const matchingComments = commentsByReviewId.get(raw.id) || [];
        const normalized = normalizeReview(raw, matchingComments);
        if (normalized) {
            reviewsMap.set(normalized.reviewId, normalized);
        }
    }

    const allReviews = Array.from(reviewsMap.values());

    // Sort chronologically by submittedAt or reviewId
    allReviews.sort((a, b) => {
        const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return timeA - timeB || (a.reviewId || 0) - (b.reviewId || 0);
    });

    const uniqueReviewers = [...new Set(allReviews.map(r => r.reviewer).filter(Boolean))];
    const uniqueSubstantiveReviewers = [...new Set(allReviews.filter(r => r.isSubstantive).map(r => r.reviewer).filter(Boolean))];

    const reviewSummary = {
        totalReviews: allReviews.length,
        approvedCount: allReviews.filter(r => r.decision === REVIEW_DECISIONS.APPROVED).length,
        changesRequestedCount: allReviews.filter(r => r.decision === REVIEW_DECISIONS.CHANGES_REQUESTED).length,
        commentedCount: allReviews.filter(r => r.decision === REVIEW_DECISIONS.COMMENTED).length,
        dismissedCount: allReviews.filter(r => r.decision === REVIEW_DECISIONS.DISMISSED).length,
        substantiveReviewCount: allReviews.filter(r => r.isSubstantive).length,
        hasSubstantiveReview: uniqueSubstantiveReviewers.length > 0
    };

    return {
        reviews: allReviews,
        reviewers: uniqueReviewers,
        substantiveReviewers: uniqueSubstantiveReviewers,
        reviewSummary
    };
}

