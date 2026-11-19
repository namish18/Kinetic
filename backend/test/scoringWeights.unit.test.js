import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    DEFAULT_SCORING_WEIGHTS,
    SCORING_WEIGHT_KEYS,
    WEIGHT_SUM_TOLERANCE,
    validateScoringWeights,
    mergeScoringWeights
} from '../config/scoringWeights.js';
import {
    isValidWeightValue,
    validateRepoConfig
} from '../middleware/validate.js';

const VALID_WEIGHTS = {
    impact: 0.3,
    complexity: 0.2,
    quality: 0.2,
    review: 0.15,
    priority: 0.15
};

function runMiddleware(body) {
    let statusCode;
    let responseBody;
    let nextCalled = false;

    const req = { body, params: {}, query: {} };
    const res = {
        status(code) {
            statusCode = code;
            return this;
        },
        json(payload) {
            responseBody = payload;
            return this;
        }
    };

    validateRepoConfig(req, res, () => {
        nextCalled = true;
    });

    return { statusCode, responseBody, nextCalled };
}

describe('MSTS-11 scoring weight validation (isolated)', () => {
    it('defines exactly the five repository scoring dimensions and valid defaults', () => {
        assert.deepEqual(SCORING_WEIGHT_KEYS, [
            'impact', 'complexity', 'quality', 'review', 'priority'
        ]);
        assert.equal(validateScoringWeights(DEFAULT_SCORING_WEIGHTS).valid, true);
        const total = Object.values(DEFAULT_SCORING_WEIGHTS).reduce((sum, value) => sum + value, 0);
        assert.ok(Math.abs(total - 1) <= WEIGHT_SUM_TOLERANCE);
    });

    it('accepts valid weights and floating-point totals within tolerance', () => {
        assert.equal(validateScoringWeights(VALID_WEIGHTS).valid, true);
        assert.equal(
            validateScoringWeights({
                impact: 0.1, complexity: 0.2, quality: 0.7, review: 0, priority: 0
            }).valid,
            true
        );
    });

    it('rejects negative, above-limit, non-finite and non-numeric values', () => {
        for (const value of [-0.01, 1.01, NaN, Infinity, -Infinity, '0.2', null]) {
            assert.equal(isValidWeightValue(value), false, `Expected ${String(value)} to be invalid`);
        }
        assert.equal(isValidWeightValue(0), true);
        assert.equal(isValidWeightValue(1), true);
    });

    it('rejects incomplete, unknown-key and non-summing configurations', () => {
        assert.equal(validateScoringWeights({ impact: 1 }).valid, false);
        assert.equal(validateScoringWeights({ ...VALID_WEIGHTS, extra: 0 }).valid, false);
        assert.equal(
            validateScoringWeights({
                impact: 0.4, complexity: 0.4, quality: 0.4, review: 0.4, priority: 0.4
            }).valid,
            false
        );
    });

    it('merges a partial update with current values before complete validation', () => {
        const merged = mergeScoringWeights(VALID_WEIGHTS, { impact: 0.4 });
        assert.deepEqual(merged, { ...VALID_WEIGHTS, impact: 0.4 });
        assert.equal(validateScoringWeights(merged).valid, false);

        const validMerged = mergeScoringWeights(VALID_WEIGHTS, {
            impact: 0.4,
            complexity: 0.1
        });
        assert.equal(validateScoringWeights(validMerged).valid, true);
    });

    it('rejects invalid supplied values at the API middleware boundary', () => {
        const negative = runMiddleware({
            weights: { impact: -0.1 }
        });
        assert.equal(negative.statusCode, 400);
        assert.equal(negative.nextCalled, false);

        const tooLarge = runMiddleware({
            weights: { impact: 1.1 }
        });
        assert.equal(tooLarge.statusCode, 400);
        assert.equal(tooLarge.nextCalled, false);
    });

    it('allows valid partial updates for route-level merge and sum validation', () => {
        const result = runMiddleware({ weights: { impact: 0.4 } });
        assert.equal(result.nextCalled, true);
        assert.equal(result.statusCode, undefined);
    });

    it('validates complete configurations while leaving partial updates for route-level merge', () => {
        assert.equal(runMiddleware({ weights: VALID_WEIGHTS }).nextCalled, true);

        const invalidComplete = runMiddleware({
            weights: {
                impact: 0.4, complexity: 0.4, quality: 0.4, review: 0.4, priority: 0.4
            }
        });
        assert.equal(invalidComplete.statusCode, 400);
        assert.equal(invalidComplete.nextCalled, false);

        const validPartial = runMiddleware({ weights: { impact: 0.4 } });
        assert.equal(validPartial.nextCalled, true);
        assert.equal(validPartial.statusCode, undefined);
    });
});
