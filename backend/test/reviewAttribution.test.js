import { test, describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    REVIEW_DECISIONS,
    normalizeDecision,
    isTrivialFeedback,
    evaluateReviewSubstance,
    normalizeReview,
    normalizeReviews
} from '../services/reviewAttribution.js';
import {
    fetchPRReviews,
    fetchPRReviewComments,
    fetchPRReviewData,
    fetchPRReviewsBatch
} from '../services/githubSearch.js';
import {
    detailsFromPR,
    reviewsFromPR,
    toPRShape,
    syncIndex,
    needsReviews
} from '../services/contributionIndex.js';
import {
    extractPRMetrics,
    calculatePRScore
} from '../services/contributionService.js';

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});

function jsonResponse(body, { status = 200, headers = {} } = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json', ...headers }
    });
}

describe('PR Review Attribution & Decision Tracking', () => {
    it('normalizes review decisions to standard states', () => {
        assert.equal(normalizeDecision('approved'), REVIEW_DECISIONS.APPROVED);
        assert.equal(normalizeDecision('APPROVED'), REVIEW_DECISIONS.APPROVED);
        assert.equal(normalizeDecision('changes_requested'), REVIEW_DECISIONS.CHANGES_REQUESTED);
        assert.equal(normalizeDecision('CHANGES_REQUESTED'), REVIEW_DECISIONS.CHANGES_REQUESTED);
        assert.equal(normalizeDecision('commented'), REVIEW_DECISIONS.COMMENTED);
        assert.equal(normalizeDecision('COMMENTED'), REVIEW_DECISIONS.COMMENTED);
        assert.equal(normalizeDecision('dismissed'), REVIEW_DECISIONS.DISMISSED);
        assert.equal(normalizeDecision('DISMISSED'), REVIEW_DECISIONS.DISMISSED);
        assert.equal(normalizeDecision(''), REVIEW_DECISIONS.COMMENTED);
        assert.equal(normalizeDecision(null), REVIEW_DECISIONS.COMMENTED);
        assert.equal(normalizeDecision(undefined), REVIEW_DECISIONS.COMMENTED);
    });

    it('identifies trivial/empty feedback versus meaningful feedback', () => {
        // Trivial boilerplate
        assert.equal(isTrivialFeedback(''), true);
        assert.equal(isTrivialFeedback('   '), true);
        assert.equal(isTrivialFeedback(null), true);
        assert.equal(isTrivialFeedback('LGTM'), true);
        assert.equal(isTrivialFeedback('lgtm!'), true);
        assert.equal(isTrivialFeedback('looks good'), true);
        assert.equal(isTrivialFeedback('Looks good to me.'), true);
        assert.equal(isTrivialFeedback('+1'), true);
        assert.equal(isTrivialFeedback(':+1:'), true);
        assert.equal(isTrivialFeedback('approved'), true);
        assert.equal(isTrivialFeedback('nice!'), true);
        assert.equal(isTrivialFeedback('ok'), true);
        assert.equal(isTrivialFeedback('thanks'), true);

        // Meaningful feedback
        assert.equal(isTrivialFeedback('Please add error handling for edge case when token is invalid'), false);
        assert.equal(isTrivialFeedback('Verified performance benchmarks and memory usage under load'), false);
        assert.equal(isTrivialFeedback('Needs a small fix in the SQL query on line 42 before merge'), false);
    });

    it('detects substantive activity: empty reviews or approvals without feedback are non-substantive', () => {
        const emptyApproval = { id: 1, state: 'APPROVED', body: '' };
        const result1 = evaluateReviewSubstance(emptyApproval, []);
        assert.equal(result1.isSubstantive, false);
        assert.equal(result1.substantiveReason, 'none');

        const lgtmApproval = { id: 2, state: 'APPROVED', body: 'LGTM!' };
        const result2 = evaluateReviewSubstance(lgtmApproval, []);
        assert.equal(result2.isSubstantive, false);
        assert.equal(result2.substantiveReason, 'none');

        const briefOk = { id: 3, state: 'APPROVED', body: 'Looks good' };
        const result3 = evaluateReviewSubstance(briefOk, []);
        assert.equal(result3.isSubstantive, false);
        assert.equal(result3.substantiveReason, 'none');
    });

    it('detects substantive activity: meaningful written feedback is substantive', () => {
        const detailedApproval = {
            id: 4,
            state: 'APPROVED',
            body: 'Tested with 1500 records and verified pagination and rate limiting behaviour.'
        };
        const result1 = evaluateReviewSubstance(detailedApproval, []);
        assert.equal(result1.isSubstantive, true);
        assert.equal(result1.substantiveReason, 'written_feedback');

        const changesRequested = {
            id: 5,
            state: 'CHANGES_REQUESTED',
            body: 'Please add unit tests covering multiple reviewers and rate limit headers.'
        };
        const result2 = evaluateReviewSubstance(changesRequested, []);
        assert.equal(result2.isSubstantive, true);
        assert.equal(result2.substantiveReason, 'written_feedback');
    });

    it('detects substantive activity: short but meaningful technical feedback is correctly classified', () => {
        // Concise technical comments that should NOT be rejected just because they are short
        const shortTechnicalReviews = [
            { id: 11, state: 'CHANGES_REQUESTED', body: 'nit: use const' },
            { id: 12, state: 'COMMENTED', body: 'XSS risk' },
            { id: 13, state: 'CHANGES_REQUESTED', body: 'race condition' },
            { id: 14, state: 'COMMENTED', body: 'Missing null check' },
            { id: 15, state: 'COMMENTED', body: 'Fix memory leak' },
            { id: 16, state: 'COMMENTED', body: 'off-by-one bug' },
            { id: 17, state: 'COMMENTED', body: 'Use `return early;` here' }
        ];

        for (const review of shortTechnicalReviews) {
            const result = evaluateReviewSubstance(review, []);
            assert.equal(result.isSubstantive, true, `Expected "${review.body}" to be substantive`);
            assert.equal(result.substantiveReason, 'written_feedback');
        }
    });

    it('detects substantive activity: trivial inline comments (done, fixed, +1) do not create false positives', () => {
        const review = { id: 20, state: 'APPROVED', body: '' };

        // Trivial inline comments like acknowledgments or emojis
        const trivialInlineComments = [
            { id: 101, pull_request_review_id: 20, body: 'done' },
            { id: 102, pull_request_review_id: 20, body: 'fixed' },
            { id: 103, pull_request_review_id: 20, body: 'ack' },
            { id: 104, pull_request_review_id: 20, body: 'LGTM' },
            { id: 105, pull_request_review_id: 20, body: ':+1:' }
        ];

        const result = evaluateReviewSubstance(review, trivialInlineComments);
        assert.equal(result.isSubstantive, false, 'Trivial inline comments should not be substantive');
        assert.equal(result.substantiveReason, 'none');
    });

    it('detects substantive activity: meaningful inline code comments make review substantive', () => {
        const reviewWithInlineComment = {
            id: 10,
            state: 'APPROVED',
            body: '' // empty body, but has a genuine technical inline comment on code!
        };
        const inlineComments = [
            { id: 101, pull_request_review_id: 10, body: 'Consider using optional chaining here to avoid TypeError.', path: 'index.js', line: 15 }
        ];

        const result = evaluateReviewSubstance(reviewWithInlineComment, inlineComments);
        assert.equal(result.isSubstantive, true);
        assert.equal(result.hasInlineComments, true);
        assert.equal(result.inlineCommentsCount, 1);
        assert.equal(result.substantiveReason, 'inline_comments');
    });

    it('normalizes individual reviews with complete reviewer metadata', () => {
        const raw = {
            id: 55,
            user: { login: 'sarah_reviewer', id: 456, avatar_url: 'https://avatars.example/sarah' },
            state: 'CHANGES_REQUESTED',
            body: 'Please refactor this method to avoid memory leak.',
            submitted_at: '2026-11-05T14:30:00Z',
            commit_id: 'a1b2c3d4',
            html_url: 'https://github.com/org/repo/pull/1#pullrequestreview-55'
        };

        const normalized = normalizeReview(raw, []);
        assert.equal(normalized.reviewId, 55);
        assert.equal(normalized.reviewer, 'sarah_reviewer');
        assert.equal(normalized.reviewerKey, 'sarah_reviewer');
        assert.equal(normalized.reviewerId, 456);
        assert.equal(normalized.reviewerAvatar, 'https://avatars.example/sarah');
        assert.equal(normalized.decision, 'CHANGES_REQUESTED');
        assert.equal(normalized.state, 'CHANGES_REQUESTED');
        assert.equal(normalized.body, 'Please refactor this method to avoid memory leak.');
        assert.equal(normalized.commitId, 'a1b2c3d4');
        assert.equal(normalized.isSubstantive, true);
        assert.equal(normalized.substantiveReason, 'written_feedback');
        assert.equal(normalized.hasInlineComments, false);
    });
});

describe('Multiple Reviewers & Aggregated Attribution', () => {
    it('accurately tracks multiple reviewers, their decisions, and substantive activity', () => {
        const rawReviews = [
            {
                id: 1,
                user: { login: 'alice', id: 10, avatar_url: 'https://avatars/alice' },
                state: 'APPROVED',
                body: 'LGTM',
                submitted_at: '2026-11-01T10:00:00Z'
            },
            {
                id: 2,
                user: { login: 'bob', id: 20, avatar_url: 'https://avatars/bob' },
                state: 'CHANGES_REQUESTED',
                body: 'Please update documentation and add test cases.',
                submitted_at: '2026-11-01T11:00:00Z'
            },
            {
                id: 3,
                user: { login: 'charlie', id: 30, avatar_url: 'https://avatars/charlie' },
                state: 'COMMENTED',
                body: '',
                submitted_at: '2026-11-01T12:00:00Z'
            }
        ];

        const rawComments = [
            {
                id: 201,
                pull_request_review_id: 3, // associated with Charlie's review
                user: { login: 'charlie' },
                body: 'Potential race condition on this line if accessed concurrently.',
                path: 'services/sync.js',
                line: 88
            }
        ];

        const result = normalizeReviews(rawReviews, rawComments);

        assert.equal(result.reviews.length, 3);
        assert.deepEqual(result.reviewers, ['alice', 'bob', 'charlie']);

        // Bob has meaningful written feedback; Charlie has inline comments; Alice only has LGTM
        assert.deepEqual(result.substantiveReviewers, ['bob', 'charlie']);

        assert.deepEqual(result.reviewSummary, {
            totalReviews: 3,
            approvedCount: 1,
            changesRequestedCount: 1,
            commentedCount: 1,
            dismissedCount: 0,
            substantiveReviewCount: 2,
            hasSubstantiveReview: true
        });

        // Check individual reviewer states
        const aliceReview = result.reviews.find(r => r.reviewer === 'alice');
        assert.equal(aliceReview.decision, 'APPROVED');
        assert.equal(aliceReview.isSubstantive, false);

        const bobReview = result.reviews.find(r => r.reviewer === 'bob');
        assert.equal(bobReview.decision, 'CHANGES_REQUESTED');
        assert.equal(bobReview.isSubstantive, true);
        assert.equal(bobReview.substantiveReason, 'written_feedback');

        const charlieReview = result.reviews.find(r => r.reviewer === 'charlie');
        assert.equal(charlieReview.decision, 'COMMENTED');
        assert.equal(charlieReview.isSubstantive, true);
        assert.equal(charlieReview.substantiveReason, 'inline_comments');
        assert.equal(charlieReview.inlineCommentsCount, 1);
    });

    it('avoids duplicate reviews when merging with existing reviews', () => {
        const existingReviews = [
            {
                reviewId: 101,
                reviewer: 'alice',
                decision: 'CHANGES_REQUESTED',
                body: 'Initial request for changes',
                submittedAt: new Date('2026-11-01T10:00:00Z')
            }
        ];

        // Second sync receives updated review 101 and new review 102
        const rawReviews = [
            {
                id: 101,
                user: { login: 'alice', id: 1 },
                state: 'APPROVED',
                body: 'Changes verified and accepted!',
                submitted_at: '2026-11-01T12:00:00Z'
            },
            {
                id: 102,
                user: { login: 'bob', id: 2 },
                state: 'APPROVED',
                body: 'LGTM',
                submitted_at: '2026-11-01T13:00:00Z'
            }
        ];

        const result = normalizeReviews(rawReviews, [], existingReviews);

        // Exactly 2 reviews, NO duplicate review 101!
        assert.equal(result.reviews.length, 2);
        assert.equal(result.reviews.filter(r => r.reviewId === 101).length, 1);
        const updated101 = result.reviews.find(r => r.reviewId === 101);
        assert.equal(updated101.decision, 'APPROVED');
        assert.equal(updated101.body, 'Changes verified and accepted!');
    });
});

describe('GitHub API Integration (githubSearch)', () => {
    it('fetchPRReviews: fetches and parses reviews for a PR URL with pagination', async () => {
        const calls = [];
        globalThis.fetch = async (url) => {
            calls.push(url);
            if (url.includes('page=2')) {
                return jsonResponse([
                    { id: 2, user: { login: 'reviewer2' }, state: 'CHANGES_REQUESTED', body: 'Needs test coverage' }
                ]);
            }
            return jsonResponse([
                { id: 1, user: { login: 'reviewer1' }, state: 'APPROVED', body: 'Looks good' }
            ], {
                headers: { link: '<https://api.github.com/repos/owner/repo/pulls/10/reviews?page=2>; rel="next"' }
            });
        };

        const res = await fetchPRReviews('https://api.github.com/repos/owner/repo/pulls/10', {});
        assert.equal(res.ok, true);
        assert.equal(res.data.length, 2);
        assert.equal(res.data[0].id, 1);
        assert.equal(res.data[1].id, 2);
        assert.equal(calls.length, 2);
    });

    it('fetchPRReviewComments: fetches inline comments for a PR URL with pagination', async () => {
        const calls = [];
        globalThis.fetch = async (url) => {
            calls.push(url);
            if (url.includes('page=2')) {
                return jsonResponse([
                    { id: 202, pull_request_review_id: 2, body: 'Missing null check', path: 'file2.js', line: 40 }
                ]);
            }
            return jsonResponse([
                { id: 201, pull_request_review_id: 1, body: 'Typo here', path: 'file.js', line: 12 }
            ], {
                headers: { link: '<https://api.github.com/repos/owner/repo/pulls/10/comments?page=2>; rel="next"' }
            });
        };

        const res = await fetchPRReviewComments('https://api.github.com/repos/owner/repo/pulls/10', {});
        assert.equal(res.ok, true);
        assert.equal(res.data.length, 2);
        assert.equal(res.data[0].id, 201);
        assert.equal(res.data[1].id, 202);
        assert.equal(calls.length, 2);
    });

    it('fetchPRReviewsBatch: handles concurrency, rate limits, and errors gracefully', async () => {
        const calls = [];
        globalThis.fetch = async (url) => {
            calls.push(url);
            if (url.includes('/1/reviews')) {
                return jsonResponse([{ id: 1, user: { login: 'alice' }, state: 'APPROVED', body: 'LGTM' }]);
            }
            if (url.includes('/1/comments')) {
                return jsonResponse([]);
            }
            if (url.includes('/2/reviews')) {
                // Secondary rate limit on PR 2
                return jsonResponse({ message: 'Rate limit exceeded' }, {
                    status: 403,
                    headers: { 'retry-after': '60' }
                });
            }
            return jsonResponse([]);
        };

        const prUrls = [
            'https://api.github.com/repos/owner/repo/pulls/1',
            'https://api.github.com/repos/owner/repo/pulls/2',
            'https://api.github.com/repos/owner/repo/pulls/3'
        ];

        const batch = await fetchPRReviewsBatch(prUrls, {}, { concurrency: 1 });
        assert.equal(batch.rateLimited, true);
        assert.ok(batch.resetAt);
        // First PR succeeded before rate limit hit on second
        assert.equal(batch.results[0].reviews.length, 1);
        assert.equal(batch.results[0].reviewsOk, true);
        assert.equal(batch.results[1], null);
    });

    it('fetchPRReviewsBatch: returns explicit endpoint statuses on non-rate-limit errors without crashing', async () => {
        globalThis.fetch = async (url) => {
            if (url.includes('/1/reviews')) {
                return jsonResponse({ message: 'Internal Server Error' }, { status: 500 });
            }
            if (url.includes('/2/reviews')) {
                return jsonResponse([{ id: 2, user: { login: 'bob' }, state: 'APPROVED', body: 'Good work' }]);
            }
            if (url.includes('/2/comments')) {
                return jsonResponse({ message: 'Not Found' }, { status: 404 });
            }
            return jsonResponse([]);
        };

        const prUrls = [
            'https://api.github.com/repos/owner/repo/pulls/1',
            'https://api.github.com/repos/owner/repo/pulls/2'
        ];

        const batch = await fetchPRReviewsBatch(prUrls, {});
        assert.equal(batch.errors, 2); // 1 reviews error + 1 comments error
        assert.equal(batch.rateLimited, false);

        // PR 1: reviews failed
        assert.equal(batch.results[0].ok, false);
        assert.equal(batch.results[0].reviewsOk, false);

        // PR 2: reviews succeeded, but comments failed
        assert.equal(batch.results[1].ok, false);
        assert.equal(batch.results[1].reviewsOk, true);
        assert.equal(batch.results[1].commentsOk, false);
        assert.equal(batch.results[1].reviews.length, 1);
    });
});

describe('Contribution Indexing Integration & Workflow', () => {
    const NOW = new Date('2026-11-08T12:00:00Z');
    const DAY = 24 * 60 * 60 * 1000;
    const HOUR = 60 * 60 * 1000;

    it('needsReviews: independent selection using reviewsFetchedAt and refresh window', () => {
        const registered = new Set(['org/repo']);
        const base = { repoKey: 'org/repo' };
        const recent = new Date(NOW.getTime() - 3 * DAY);
        const old = new Date(NOW.getTime() - 20 * DAY);
        const fetchedOld = new Date(NOW.getTime() - 25 * HOUR);
        const fetchedRecent = new Date(NOW.getTime() - 2 * HOUR);

        // Never fetched reviews -> true (even if details are already cached!)
        assert.equal(needsReviews({ ...base, detailsFetchedAt: fetchedRecent, reviewsFetchedAt: null, mergedAt: old }, registered, NOW), true);
        assert.equal(needsReviews({ ...base, detailsFetchedAt: fetchedRecent, reviewsFetchedAt: null, mergedAt: recent }, registered, NOW), true);

        // Fetched recently within 24h for recent PR -> false
        assert.equal(needsReviews({ ...base, detailsFetchedAt: fetchedRecent, reviewsFetchedAt: fetchedRecent, mergedAt: recent }, registered, NOW), false);

        // Fetched >24h ago for recently merged PR (within 14d) -> true (refresh window)
        assert.equal(needsReviews({ ...base, detailsFetchedAt: fetchedRecent, reviewsFetchedAt: fetchedOld, mergedAt: recent }, registered, NOW), true);

        // Fetched >24h ago for old merged PR (older than 14d) -> false (outside refresh window)
        assert.equal(needsReviews({ ...base, detailsFetchedAt: fetchedRecent, reviewsFetchedAt: fetchedOld, mergedAt: old }, registered, NOW), false);

        // Unregistered repo -> false
        assert.equal(needsReviews({ repoKey: 'unregistered/repo', reviewsFetchedAt: null, mergedAt: recent }, registered, NOW), false);
    });

    const samplePR = {
        number: 42,
        title: 'Feature PR',
        html_url: 'https://github.com/org/repo/pull/42',
        base: { repo: { full_name: 'org/repo' } },
        head: { sha: 'sha-head' },
        merge_commit_sha: 'sha-merge',
        additions: 100,
        deletions: 20,
        changed_files: 3,
        commits: 2,
        comments: 1,
        review_comments: 2,
        merged: true,
        labels: [{ name: 'enhancement' }]
    };

    it('detailsFromPR associates review attribution with PR details', () => {
        const reviewData = {
            reviews: [
                { id: 99, user: { login: 'dev_lead' }, state: 'APPROVED', body: 'Architecture looks great, approved for deploy.' }
            ],
            comments: []
        };

        const details = detailsFromPR(samplePR, NOW, reviewData);

        assert.equal(details.stats.additions, 100);
        assert.equal(details.reviews.length, 1);
        assert.equal(details.reviews[0].reviewer, 'dev_lead');
        assert.equal(details.reviews[0].decision, 'APPROVED');
        assert.equal(details.reviews[0].isSubstantive, true);
        assert.deepEqual(details.reviewers, ['dev_lead']);
        assert.deepEqual(details.substantiveReviewers, ['dev_lead']);
        assert.equal(details.reviewSummary.approvedCount, 1);
        assert.equal(details.reviewsFetchedAt, NOW);
    });

    it('toPRShape exposes review attribution while maintaining scoring backwards compatibility', () => {
        const event = {
            repo: 'org/repo',
            prNumber: 42,
            title: 'Feature PR',
            url: 'https://github.com/org/repo/pull/42',
            mergedAt: NOW,
            stats: { additions: 100, deletions: 20, changedFiles: 3, commits: 2, comments: 1, reviewComments: 2, merged: true, labels: [] },
            reviews: [
                { reviewId: 99, reviewer: 'dev_lead', decision: 'APPROVED', isSubstantive: true }
            ],
            reviewers: ['dev_lead'],
            substantiveReviewers: ['dev_lead'],
            reviewSummary: { totalReviews: 1, approvedCount: 1, hasSubstantiveReview: true }
        };

        const prShape = toPRShape(event);

        assert.equal(prShape.number, 42);
        assert.deepEqual(prShape.reviewers, ['dev_lead']);
        assert.equal(prShape.reviews[0].decision, 'APPROVED');
        assert.equal(prShape.reviewSummary.approvedCount, 1);

        // Scoring metrics MUST remain identical
        const metricsWithReviews = extractPRMetrics(prShape);
        const metricsRaw = extractPRMetrics(samplePR);
        assert.deepEqual(metricsWithReviews, metricsRaw);

        const scoreWithReviews = calculatePRScore(metricsWithReviews, null);
        const scoreRaw = calculatePRScore(metricsRaw, null);
        assert.equal(scoreWithReviews.score, scoreRaw.score);
    });

    it('syncIndex with fetchReviews: true fetches, normalizes, and stores reviews in Mongo', async () => {
        const calls = { eventWrites: [], cursorUpdates: [] };
        const fakeEvents = [{
            repoKey: 'org/repo',
            prNumber: 42,
            apiUrl: 'https://api.github.com/repos/org/repo/pulls/42',
            mergedAt: NOW,
            detailsFetchedAt: null,
            reviewsFetchedAt: null,
            reviews: []
        }];

        const Event = {
            async bulkWrite(ops) {
                calls.eventWrites.push(ops);
                return { upsertedCount: ops.length };
            },
            find() {
                return {
                    select: () => ({
                        lean: async () => fakeEvents
                    })
                };
            }
        };

        const SyncState = {
            find: () => ({ lean: async () => [] }),
            updateOne: async () => { }
        };

        // Mock fetch for search, detail, reviews, comments
        globalThis.fetch = async (url) => {
            if (url.includes('/search/issues')) {
                return jsonResponse({
                    total_count: 1,
                    items: [{
                        number: 42,
                        title: 'Feature PR',
                        repository_url: 'https://api.github.com/repos/org/repo',
                        user: { login: 'contributor1', id: 100 },
                        pull_request: { url: 'https://api.github.com/repos/org/repo/pulls/42', merged_at: NOW.toISOString() }
                    }]
                });
            }
            if (url.includes('/reviews')) {
                return jsonResponse([
                    { id: 501, user: { login: 'reviewer_bob' }, state: 'APPROVED', body: 'Clean implementation!' }
                ]);
            }
            if (url.includes('/comments')) {
                return jsonResponse([]);
            }
            // PR details
            return jsonResponse(samplePR);
        };

        const meta = await syncIndex({
            scopes: [{ key: 'repo:org/repo', qualifier: 'repo:org/repo' }],
            detailFilter: {},
            registeredKeys: new Set(['org/repo']),
            headers: {},
            Event,
            SyncState,
            now: NOW,
            fetchReviews: true
        });

        assert.equal(meta.reviewRequests, 2); // 1 reviews + 1 comments
        assert.equal(calls.eventWrites.length, 2); // 1 search upsert + 1 details & reviews write

        const detailWrite = calls.eventWrites[1][0].updateOne;
        assert.deepEqual(detailWrite.filter, { repoKey: 'org/repo', prNumber: 42 });
        assert.equal(detailWrite.update.$set.reviews.length, 1);
        assert.equal(detailWrite.update.$set.reviews[0].reviewer, 'reviewer_bob');
        assert.equal(detailWrite.update.$set.reviews[0].decision, 'APPROVED');
        assert.equal(detailWrite.update.$set.reviews[0].isSubstantive, true);
        assert.deepEqual(detailWrite.update.$set.reviewers, ['reviewer_bob']);
        assert.equal(detailWrite.update.$set.reviewSummary.approvedCount, 1);
    });

    it('syncIndex: independent review target selection fetches reviews for historical PRs with fresh details', async () => {
        const calls = { eventWrites: [] };
        // Historical PR whose details were fetched 1 hour ago (fresh, needsDetails = false),
        // but whose reviews were never fetched (reviewsFetchedAt = null, needsReviews = true)
        const ONE_HOUR_AGO = new Date(NOW.getTime() - 60 * 60 * 1000);
        const fakeEvents = [{
            repoKey: 'org/repo',
            prNumber: 99,
            apiUrl: 'https://api.github.com/repos/org/repo/pulls/99',
            mergedAt: ONE_HOUR_AGO,
            detailsFetchedAt: ONE_HOUR_AGO,
            reviewsFetchedAt: null,
            reviews: []
        }];

        const Event = {
            async bulkWrite(ops) {
                calls.eventWrites.push(ops);
                return { upsertedCount: ops.length };
            },
            find() {
                return {
                    select: () => ({
                        lean: async () => fakeEvents
                    })
                };
            }
        };

        const SyncState = {
            find: () => ({ lean: async () => [{ scope: 'repo:org/repo', lastMergedAt: NOW }] }),
            updateOne: async () => {}
        };

        const fetchedUrls = [];
        globalThis.fetch = async (url) => {
            fetchedUrls.push(url);
            if (url.includes('/search/issues')) {
                return jsonResponse({ total_count: 0, items: [] });
            }
            if (url.includes('/reviews')) {
                return jsonResponse([
                    { id: 991, user: { login: 'historical_reviewer' }, state: 'APPROVED', body: 'Looks solid' }
                ]);
            }
            if (url.includes('/comments')) {
                return jsonResponse([]);
            }
            throw new Error(`Unexpected request: ${url}`);
        };

        const meta = await syncIndex({
            scopes: [{ key: 'repo:org/repo', qualifier: 'repo:org/repo' }],
            detailFilter: {},
            registeredKeys: new Set(['org/repo']),
            headers: {},
            Event,
            SyncState,
            now: NOW,
            fetchReviews: true
        });

        // Did NOT request PR details because details are already fresh
        assert.equal(meta.detailRequests, 0);
        // DID request reviews because reviewsFetchedAt was null
        assert.equal(meta.reviewRequests, 2);
        assert.equal(calls.eventWrites.length, 1);

        const writeOp = calls.eventWrites[0][0].updateOne;
        assert.deepEqual(writeOp.filter, { repoKey: 'org/repo', prNumber: 99 });
        assert.equal(writeOp.update.$set.reviews[0].reviewer, 'historical_reviewer');
        assert.equal(writeOp.update.$set.reviewsFetchedAt, NOW);
        // stats should not have been updated
        assert.equal(writeOp.update.$set.stats, undefined);
    });

    it('syncIndex: failed review endpoint never overwrites previously stored review data', async () => {
        const calls = { eventWrites: [] };
        const existingReview = {
            reviewId: 777,
            reviewer: 'previous_reviewer',
            decision: 'APPROVED',
            isSubstantive: true
        };

        const fakeEvents = [{
            repoKey: 'org/repo',
            prNumber: 55,
            apiUrl: 'https://api.github.com/repos/org/repo/pulls/55',
            mergedAt: NOW,
            detailsFetchedAt: null,
            reviewsFetchedAt: null,
            reviews: [existingReview]
        }];

        const Event = {
            async bulkWrite(ops) {
                calls.eventWrites.push(ops);
                return { upsertedCount: ops.length };
            },
            find() {
                return {
                    select: () => ({
                        lean: async () => fakeEvents
                    })
                };
            }
        };

        const SyncState = {
            find: () => ({ lean: async () => [{ scope: 'repo:org/repo', lastMergedAt: NOW }] }),
            updateOne: async () => {}
        };

        globalThis.fetch = async (url) => {
            if (url.includes('/search/issues')) {
                return jsonResponse({ total_count: 0, items: [] });
            }
            if (url.includes('/reviews')) {
                // Endpoint failure (e.g. 500 error)
                return jsonResponse({ message: 'Internal Server Error' }, { status: 500 });
            }
            if (url.includes('/comments')) {
                return jsonResponse([]);
            }
            return jsonResponse(samplePR);
        };

        const meta = await syncIndex({
            scopes: [{ key: 'repo:org/repo', qualifier: 'repo:org/repo' }],
            detailFilter: {},
            registeredKeys: new Set(['org/repo']),
            headers: {},
            Event,
            SyncState,
            now: NOW,
            fetchReviews: true
        });

        // Detail request succeeded, review request failed with error
        assert.equal(meta.detailRequests, 1);
        assert.equal(meta.reviewErrors, 1);
        assert.equal(calls.eventWrites.length, 1);

        const writeOp = calls.eventWrites[0][0].updateOne;
        // Detail was updated, but reviews were NEVER overwritten with empty array!
        assert.ok(writeOp.update.$set.detailsFetchedAt);
        assert.equal(writeOp.update.$set.reviews, undefined);
        assert.equal(writeOp.update.$set.reviewsFetchedAt, undefined);
    });
});

describe('Edge Cases', () => {
    it('handles empty reviews and comments gracefully', () => {
        const result = normalizeReviews([], []);
        assert.deepEqual(result.reviews, []);
        assert.deepEqual(result.reviewers, []);
        assert.deepEqual(result.substantiveReviewers, []);
        assert.deepEqual(result.reviewSummary, {
            totalReviews: 0,
            approvedCount: 0,
            changesRequestedCount: 0,
            commentedCount: 0,
            dismissedCount: 0,
            substantiveReviewCount: 0,
            hasSubstantiveReview: false
        });
    });

    it('handles malformed, null, or undefined review objects', () => {
        const result = normalizeReviews([null, undefined, { id: null }, {}], null);
        assert.equal(result.reviews.length, 0);
        assert.equal(result.reviewers.length, 0);
    });

    it('handles deleted/ghost reviewer accounts without user object', () => {
        const raw = {
            id: 88,
            user: null, // deleted account
            state: 'APPROVED',
            body: 'Approved by deleted user'
        };

        const normalized = normalizeReview(raw, []);
        assert.equal(normalized.reviewer, 'unknown');
        assert.equal(normalized.reviewerKey, 'unknown');
        assert.equal(normalized.decision, 'APPROVED');
    });

    it('handles inline comments with unassociated or missing review IDs', () => {
        const rawReviews = [
            { id: 10, user: { login: 'alice' }, state: 'APPROVED', body: 'LGTM' }
        ];
        const rawComments = [
            { id: 999, pull_request_review_id: 999, body: 'Orphan comment' },
            { id: 1000, pull_request_review_id: null, body: 'No review id' }
        ];

        const result = normalizeReviews(rawReviews, rawComments);
        assert.equal(result.reviews.length, 1);
        assert.equal(result.reviews[0].hasInlineComments, false);
        assert.equal(result.reviews[0].isSubstantive, false);
    });
});

