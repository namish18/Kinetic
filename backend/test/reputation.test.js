import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import User from '../models/User.js';
import {
    calculateHistoricalReputation,
    calculateConsistencyScore,
    calculatePRScore,
    DEFAULT_REPUTATION_WEIGHTS
} from '../services/contributionService.js';

describe('MSTS-03: Historical Reputation Engine', () => {
    describe('calculateHistoricalReputation()', () => {
        it('calculates reputation using the formula R = α*(accepted_PRs) + β*(avg_review_score) + γ*(historical_impact) + δ*(consistency)', () => {
            const evidence = {
                acceptedPRs: 5,
                avgReviewScore: 0.8,
                historicalImpact: 1.5,
                consistency: 0.75
            };

            const weights = {
                alpha: 10,
                beta: 20,
                gamma: 30,
                delta: 15
            };

            const expected = (10 * 5) + (20 * 0.8) + (30 * 1.5) + (15 * 0.75); // 50 + 16 + 45 + 11.25 = 122.25
            const result = calculateHistoricalReputation(evidence, weights);

            assert.equal(result.reputation, 122.25);
            assert.deepEqual(result.weights, weights);
            assert.equal(result.evidence.acceptedPRs, 5);
            assert.equal(result.evidence.avgReviewScore, 0.8);
            assert.equal(result.evidence.historicalImpact, 1.5);
            assert.equal(result.evidence.consistency, 0.75);
            assert.ok(result.evidence.lastCalculated instanceof Date);
        });

        it('falls back to DEFAULT_REPUTATION_WEIGHTS when custom weights are omitted', () => {
            const evidence = {
                acceptedPRs: 2,
                avgReviewScore: 0.5,
                historicalImpact: 1.0,
                consistency: 0.5
            };

            const expected = 
                (DEFAULT_REPUTATION_WEIGHTS.alpha * 2) +
                (DEFAULT_REPUTATION_WEIGHTS.beta * 0.5) +
                (DEFAULT_REPUTATION_WEIGHTS.gamma * 1.0) +
                (DEFAULT_REPUTATION_WEIGHTS.delta * 0.5);

            const result = calculateHistoricalReputation(evidence);
            assert.equal(result.reputation, Math.round(expected * 100) / 100);
            assert.deepEqual(result.weights, DEFAULT_REPUTATION_WEIGHTS);
        });

        it('allows overriding specific weight coefficients individually', () => {
            const evidence = {
                acceptedPRs: 3,
                avgReviewScore: 1.0,
                historicalImpact: 2.0,
                consistency: 1.0
            };

            // Custom alpha and gamma, default beta and delta
            const result = calculateHistoricalReputation(evidence, { alpha: 50, gamma: 100 });
            const expected = (50 * 3) + (DEFAULT_REPUTATION_WEIGHTS.beta * 1.0) + (100 * 2.0) + (DEFAULT_REPUTATION_WEIGHTS.delta * 1.0);

            assert.equal(result.reputation, expected);
            assert.equal(result.weights.alpha, 50);
            assert.equal(result.weights.gamma, 100);
            assert.equal(result.weights.beta, DEFAULT_REPUTATION_WEIGHTS.beta);
            assert.equal(result.weights.delta, DEFAULT_REPUTATION_WEIGHTS.delta);
        });

        it('allows setting explicit weight coefficient of 0 without fallback override', () => {
            const evidence = {
                acceptedPRs: 10,
                avgReviewScore: 0.8,
                historicalImpact: 2.0,
                consistency: 1.0
            };

            const result = calculateHistoricalReputation(evidence, { alpha: 0 });
            // alpha should be 0, not 10
            const expected = (0 * 10) + (DEFAULT_REPUTATION_WEIGHTS.beta * 0.8) + (DEFAULT_REPUTATION_WEIGHTS.gamma * 2.0) + (DEFAULT_REPUTATION_WEIGHTS.delta * 1.0);
            assert.equal(result.reputation, expected);
            assert.equal(result.weights.alpha, 0);
        });

        it('handles zero or missing evidence gracefully without NaN or negative values', () => {
            const result = calculateHistoricalReputation({});
            assert.equal(result.reputation, 0);
            assert.equal(result.evidence.acceptedPRs, 0);
            assert.equal(result.evidence.avgReviewScore, 0);
            assert.equal(result.evidence.historicalImpact, 0);
            assert.equal(result.evidence.consistency, 0);
        });
    });

    describe('calculateConsistencyScore()', () => {
        it('returns 0 for empty PR list', () => {
            assert.equal(calculateConsistencyScore([]), 0);
        });

        it('returns baseline 0.5 for single PR', () => {
            assert.equal(calculateConsistencyScore([{ merged_at: '2024-01-01T00:00:00Z' }]), 0.5);
        });

        it('calculates higher consistency for contributions spread across multiple weeks', () => {
            const spreadPRs = [
                { merged_at: '2024-01-05T10:00:00Z' },
                { merged_at: '2024-01-18T10:00:00Z' },
                { merged_at: '2024-02-02T10:00:00Z' },
                { merged_at: '2024-02-20T10:00:00Z' },
                { merged_at: '2024-03-10T10:00:00Z' }
            ];

            const score = calculateConsistencyScore(spreadPRs);
            assert.ok(score >= 0.8 && score <= 1.0, `Expected high consistency, got ${score}`);
        });

        it('caps consistency score at 1.0', () => {
            const manyWeeksPRs = Array.from({ length: 15 }, (_, i) => ({
                merged_at: new Date(2024, 0, 1 + i * 14).toISOString()
            }));

            const score = calculateConsistencyScore(manyWeeksPRs);
            assert.equal(score, 1.0);
        });

        it('assigns lower consistency to burst contributions all within the same week', () => {
            const sameDayPRs = [
                { merged_at: '2024-01-05T10:00:00Z' },
                { merged_at: '2024-01-05T11:00:00Z' },
                { merged_at: '2024-01-05T12:00:00Z' }
            ];

            const score = calculateConsistencyScore(sameDayPRs);
            assert.equal(score, 0.2); // 1 week / 5 = 0.2
        });
    });

    describe('calculatePRScore() Integration with Historical Reputation', () => {
        const dummyMetrics = {
            impact: 0.6,
            complexity: 0.5,
            quality: 0.8,
            review: 0.7,
            priority: 0.6
        };

        const dummyWeights = {
            impact: 0.2,
            complexity: 0.2,
            quality: 0.2,
            review: 0.2,
            priority: 0.2
        };

        it('returns multiplier of 1.0 when contributor has 0 reputation', () => {
            const result = calculatePRScore(dummyMetrics, dummyWeights, { reputation: 0 });
            assert.equal(result.details.repMult, 1.0);
        });

        it('applies logarithmic reputation boost capped at 1.5x', () => {
            const midResult = calculatePRScore(dummyMetrics, dummyWeights, { reputation: 150 });
            assert.ok(midResult.details.repMult > 1.0 && midResult.details.repMult < 1.5);

            // Very high reputation should be capped at 1.5
            const cappedResult = calculatePRScore(dummyMetrics, dummyWeights, { reputation: 10000 });
            assert.equal(cappedResult.details.repMult, 1.5);
            assert.equal(cappedResult.score, cappedResult.details.baseScore * 1.5);
        });

        it('maintains backwards compatibility when context is omitted', () => {
            const result = calculatePRScore(dummyMetrics, dummyWeights);
            assert.ok(result.score > 0);
            assert.equal(result.details.repMult, 1.0);
        });
    });

    describe('User Schema Reputation Configuration', () => {
        it('defines reputation, evidence, and customizable weight schema paths', () => {
            const paths = User.schema.paths;
            const repoPaths = paths['repositories'].schema.paths;

            assert.ok(paths['reputation'], 'User schema missing reputation');
            assert.ok(paths['reputationEvidence.acceptedPRs'], 'Missing reputationEvidence.acceptedPRs');
            assert.ok(paths['reputationEvidence.avgReviewScore'], 'Missing reputationEvidence.avgReviewScore');
            assert.ok(paths['reputationEvidence.historicalImpact'], 'Missing reputationEvidence.historicalImpact');
            assert.ok(paths['reputationEvidence.consistency'], 'Missing reputationEvidence.consistency');
            assert.ok(paths['reputationWeights.alpha'], 'Missing user-level reputationWeights.alpha');
            assert.ok(repoPaths['reputationWeights.alpha'], 'Missing repo-level reputationWeights.alpha');
            assert.ok(repoPaths['reputationWeights.beta'], 'Missing repo-level reputationWeights.beta');
            assert.ok(repoPaths['reputationWeights.gamma'], 'Missing repo-level reputationWeights.gamma');
            assert.ok(repoPaths['reputationWeights.delta'], 'Missing repo-level reputationWeights.delta');
        });
    });
});

