import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    extractPRMetrics,
    calculatePRScore,
    calculateHistoricalReputation,
    getAlgorithmConfiguration,
    ALGORITHM_VERSION
} from '../services/contributionService.js';

// Fixed expected values, worked out with the scoring code as it was before the
// evidence changes (reputation, velocity penalty and versioning merged together).
// If these change, scoring behaviour changed.

const PR = { additions: 420, deletions: 130, changed_files: 9, commits: 5, review_comments: 6, merged: true, labels: [{ name: 'priority-high' }] };
const FOUR_PRS = ['2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z', '2026-11-03T00:00:00Z', '2026-11-04T00:00:00Z'];

describe('scoring behaviour is unchanged', () => {
    it('extracts the same PR metrics', () => {
        const m = extractPRMetrics(PR);
        assert.equal(m.impact, 0.46);
        assert.equal(m.complexity, 0.6852804597468828);
        assert.equal(m.quality, 0.9);
        assert.equal(m.review, 1);
        assert.equal(m.priority, 1);
    });

    it('gives the same final score with reputation and no velocity penalty', () => {
        const r = calculatePRScore(extractPRMetrics(PR), null, { reputation: 120 });
        assert.equal(r.details.baseScore, 0.8090560919493766);
        assert.equal(r.details.repMult, 1.3857241771164996);
        assert.equal(r.score, 1.1211);
    });

    it('gives the same final score with the velocity penalty applied', () => {
        const r = calculatePRScore(extractPRMetrics(PR), null, { reputation: 120, timestamps: FOUR_PRS });
        assert.equal(r.spamPenalty, 0.7692);
        assert.equal(r.score, 0.8624);
    });

    it('keeps the anti-gaming filters', () => {
        assert.deepEqual(
            calculatePRScore({ impact: 0.1, complexity: 0.1, quality: 0.9, review: 0.9, priority: 0.4 }, null, {}),
            { score: 0, reason: 'Failed spam / micro PR filter' }
        );
        assert.deepEqual(
            calculatePRScore({ impact: 0.5, complexity: 0.5, quality: 0.2, review: 0.9, priority: 0.4 }, null, {}),
            { score: 0, reason: 'Failed minimum quality threshold' }
        );
    });

    it('gives the same historical reputation', () => {
        const r = calculateHistoricalReputation({ acceptedPRs: 5, avgReviewScore: 0.8, historicalImpact: 2.5, consistency: 0.6 });
        assert.equal(r.reputation, 157);
    });

    it('keeps the algorithm version and configuration', () => {
        assert.equal(ALGORITHM_VERSION, 'msts-v2.0.0');
        const c = getAlgorithmConfiguration();
        assert.equal(c.maxLines, 10000);
        assert.equal(c.reputationMultiplierCap, 1.5);
        assert.equal(c.pointsScale, 20);
        assert.equal(c.scoreCap, 100);
    });
});
