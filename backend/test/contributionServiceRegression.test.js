import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import User from '../models/User.js';
import ContributionEvent from '../models/ContributionEvent.js';
import ContributionScore from '../models/ContributionScore.js';
import {
    ALGORITHM_VERSION,
    extractPRMetrics,
    calculatePRScore,
    calculateHistoricalReputation,
    calculateConsistencyScore,
    computeContributionScore,
    computeOrgContributors
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

describe('Contribution Scoring & Metrics Regression', () => {
    it('extractPRMetrics: correctly computes normalized algorithm inputs from raw PR', () => {
        const rawPR = {
            additions: 200,
            deletions: 300, // deletions > additions (refactor bonus)
            changed_files: 5,
            commits: 4,
            review_comments: 3,
            merged: true,
            labels: [{ name: 'priority-high' }]
        };

        const metrics = extractPRMetrics(rawPR);

        // 1. Complexity: log(500 + 1) / log(10000 + 1)
        const expectedComplexity = Math.log(501) / Math.log(10001);
        assert.ok(Math.abs(metrics.complexity - expectedComplexity) < 0.001);

        // 2. Impact: (5 * 2 + 4) / 50 = 14 / 50 = 0.28
        assert.equal(metrics.impact, 0.28);

        // 3. Quality: 0.8 + 0.1 (refactor) + 0.1 (merged) = 1.0
        assert.equal(metrics.quality, 1.0);

        // 4. Review: 3 / 10 + 0.5 = 0.8
        assert.equal(metrics.review, 0.8);

        // 5. Priority: label matches 'priority' -> 1.0
        assert.equal(metrics.priority, 1.0);
    });

    it('calculatePRScore: enforces anti-gaming thresholds', () => {
        // Quality below 0.3 threshold -> discarded
        const lowQuality = calculatePRScore({
            complexity: 0.5, impact: 0.5, quality: 0.29, review: 0.8, priority: 0.5
        });
        assert.equal(lowQuality.score, 0);
        assert.match(lowQuality.reason, /minimum quality/i);

        // Review below 0.3 threshold -> discarded
        const lowReview = calculatePRScore({
            complexity: 0.5, impact: 0.5, quality: 0.8, review: 0.25, priority: 0.5
        });
        assert.equal(lowReview.score, 0);
        assert.match(lowReview.reason, /minimum quality/i);

        // Micro PR / spam filter: impact < 0.2 AND complexity < 0.2 -> discarded
        const spamPR = calculatePRScore({
            complexity: 0.15, impact: 0.15, quality: 0.8, review: 0.8, priority: 0.5
        });
        assert.equal(spamPR.score, 0);
        assert.match(spamPR.reason, /spam \/ micro PR/i);
    });

    it('calculatePRScore: computes weighted base score with reputation multiplier cap at 1.5x', () => {
        const metrics = {
            complexity: 0.6,
            impact: 0.5,
            quality: 0.9,
            review: 0.7,
            priority: 0.4
        };
        const weights = { impact: 0.2, complexity: 0.2, quality: 0.2, review: 0.2, priority: 0.2 };

        // Expected base score = 0.2 * (0.6 + 0.5 + 0.9 + 0.7 + 0.4) = 0.2 * 3.1 = 0.62
        const resultZeroRep = calculatePRScore(metrics, weights, { reputation: 0 });
        assert.equal(resultZeroRep.score, 0.62);

        // High reputation (e.g. 1000) caps at 1.5x
        const resultHighRep = calculatePRScore(metrics, weights, { reputation: 1000 });
        const expectedCappedScore = Number((0.62 * 1.5).toFixed(4));
        assert.equal(resultHighRep.score, expectedCappedScore);
        assert.equal(resultHighRep.details.repMult, 1.5);
    });
});

describe('API Response Contract & Compatibility Regression', () => {
    it('computeContributionScore: maintains contract shape and filters unregistered repos', async () => {
        // Setup User mocks
        const origFindOne = User.findOne;
        const origFind = User.find;
        const origEventFind = ContributionEvent.find;

        try {
            // Contributor user
            User.findOne = async ({ github }) => {
                if (github === 'alice') {
                    return {
                        github: 'alice',
                        repositories: [{ name: 'org/allowed-repo', weights: null }],
                        save: async () => {}
                    };
                }
                return null;
            };

            // Platform registered repos
            User.find = () => {
                const query = {
                    lean: async () => [],
                    async then(resolve) {
                        resolve([{
                            github: 'org-admin',
                            repositories: [{
                                name: 'org/allowed-repo',
                                weights: { impact: 0.2, complexity: 0.2, quality: 0.2, review: 0.2, priority: 0.2 }
                            }]
                        }]);
                    }
                };
                return query;
            };

            // Two indexed events: one for registered repo, one for unregistered external repo
            const fakeEvents = [
                {
                    repo: 'org/allowed-repo',
                    repoKey: 'org/allowed-repo',
                    prNumber: 10,
                    author: 'alice',
                    authorKey: 'alice',
                    title: 'Allowed Feature',
                    url: 'https://github.com/org/allowed-repo/pull/10',
                    mergedAt: new Date('2026-11-01T12:00:00Z'),
                    detailsFetchedAt: new Date('2026-11-01T12:00:00Z'),
                    stats: { additions: 150, deletions: 50, changedFiles: 4, commits: 2, comments: 1, reviewComments: 2, merged: true, labels: [] },
                    reviews: [{ reviewId: 1, reviewer: 'bob', decision: 'APPROVED', isSubstantive: true }],
                    reviewers: ['bob'],
                    substantiveReviewers: ['bob'],
                    reviewSummary: { totalReviews: 1, approvedCount: 1, hasSubstantiveReview: true }
                },
                {
                    repo: 'random/external-repo',
                    repoKey: 'random/external-repo',
                    prNumber: 99,
                    author: 'alice',
                    authorKey: 'alice',
                    title: 'External PR',
                    url: 'https://github.com/random/external-repo/pull/99',
                    mergedAt: new Date('2026-11-01T13:00:00Z'),
                    detailsFetchedAt: new Date('2026-11-01T13:00:00Z'),
                    stats: { additions: 100, deletions: 10, changedFiles: 2, commits: 1, comments: 0, reviewComments: 0, merged: true, labels: [] }
                }
            ];

            const makeQuery = (data) => ({
                select: () => makeQuery(data),
                sort: () => makeQuery(data),
                lean: async () => data,
                then: (resolve) => resolve(data)
            });

            ContributionEvent.find = () => makeQuery(fakeEvents);

            // Mock fetch for syncIndex
            globalThis.fetch = async (url) => {
                if (url.includes('/search/issues')) {
                    return jsonResponse({ total_count: 0, items: [] });
                }
                return jsonResponse([]);
            };

            const response = await computeContributionScore('alice', 'test-token');

            // Verify API contract structure
            assert.equal(response.username, 'alice');
            assert.equal(typeof response.finalScore, 'number');
            assert.ok(response.finalScore > 0);
            assert.equal(response.algorithmVersion, ALGORITHM_VERSION);
            assert.ok(Array.isArray(response.prs));
            assert.ok(response.meta);
            assert.equal(response.meta.source, 'index');

            // Only the registered repo PR was included; external repo was filtered out
            assert.equal(response.prs.length, 1);
            const prContract = response.prs[0];
            assert.equal(prContract.id, 10);
            assert.equal(prContract.repo, 'org/allowed-repo');
            assert.equal(prContract.title, 'Allowed Feature');
            assert.equal(prContract.status, 'merged');
            assert.equal(prContract.algorithmVersion, ALGORITHM_VERSION);
            assert.ok(prContract.link);

            // Review attribution contract preservation
            assert.deepEqual(prContract.reviewers, ['bob']);
            assert.deepEqual(prContract.substantiveReviewers, ['bob']);
            assert.equal(prContract.reviews.length, 1);
            assert.equal(prContract.reviewSummary.approvedCount, 1);

        } finally {
            User.findOne = origFindOne;
            User.find = origFind;
            ContributionEvent.find = origEventFind;
        }
    });

    it('computeOrgContributors: aggregates contributors across organization repositories', async () => {
        const origFindById = User.findById;
        const origFindOne = User.findOne;
        const origEventFind = ContributionEvent.find;

        try {
            // Organization user with 2 repositories
            User.findById = async (id) => {
                if (id === 'org-123') {
                    return {
                        _id: 'org-123',
                        role: 'organization',
                        repositories: [
                            { name: 'org/repo-a', weights: null },
                            { name: 'org/repo-b', weights: null }
                        ]
                    };
                }
                return null;
            };

            User.findOne = async () => null;

            // Merged PR events across both repos by 2 different contributors
            const fakeEvents = [
                {
                    repo: 'org/repo-a',
                    repoKey: 'org/repo-a',
                    prNumber: 1,
                    author: 'alice',
                    authorAvatar: 'https://avatars/alice',
                    title: 'PR 1',
                    mergedAt: new Date('2026-11-01T10:00:00Z'),
                    detailsFetchedAt: new Date('2026-11-01T10:00:00Z'),
                    stats: { additions: 300, deletions: 100, changedFiles: 6, commits: 3, comments: 2, reviewComments: 3, merged: true, labels: [] }
                },
                {
                    repo: 'org/repo-b',
                    repoKey: 'org/repo-b',
                    prNumber: 2,
                    author: 'bob',
                    authorAvatar: 'https://avatars/bob',
                    title: 'PR 2',
                    mergedAt: new Date('2026-11-02T10:00:00Z'),
                    detailsFetchedAt: new Date('2026-11-02T10:00:00Z'),
                    stats: { additions: 100, deletions: 20, changedFiles: 3, commits: 1, comments: 1, reviewComments: 1, merged: true, labels: [] }
                }
            ];

            const makeQuery = (data) => ({
                select: () => makeQuery(data),
                sort: () => makeQuery(data),
                lean: async () => data,
                then: (resolve) => resolve(data)
            });

            ContributionEvent.find = () => makeQuery(fakeEvents);

            globalThis.fetch = async (url) => {
                if (url.includes('/search/issues')) {
                    return jsonResponse({ total_count: 0, items: [] });
                }
                return jsonResponse([]);
            };

            const result = await computeOrgContributors('org-123', 'token');

            // Verify API contract structure
            assert.ok(Array.isArray(result.contributors));
            assert.ok(Array.isArray(result.recentEvents));
            assert.ok(result.meta);

            // Exactly 2 contributors aggregated
            assert.equal(result.contributors.length, 2);
            const contributorNames = result.contributors.map(c => c.username);
            assert.ok(contributorNames.includes('alice'));
            assert.ok(contributorNames.includes('bob'));

            // Sorted descending by totalScore
            assert.ok(result.contributors[0].totalScore >= result.contributors[1].totalScore);

            // Recent events contract
            assert.equal(result.recentEvents.length, 2);
            assert.equal(result.recentEvents[0].type, 'PR_MERGE');
            assert.ok(result.recentEvents[0].cid);
            assert.ok(result.recentEvents[0].repo);

        } finally {
            User.findById = origFindById;
            User.findOne = origFindOne;
            ContributionEvent.find = origEventFind;
        }
    });

    it('computeOrgContributors: returns empty lists gracefully when org has no repositories', async () => {
        const origFindById = User.findById;
        try {
            User.findById = async () => ({
                role: 'organization',
                repositories: []
            });

            const result = await computeOrgContributors('org-empty', 'token');
            assert.deepEqual(result.contributors, []);
            assert.deepEqual(result.recentEvents, []);
        } finally {
            User.findById = origFindById;
        }
    });
});
