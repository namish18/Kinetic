import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    SCORING_WEIGHT_KEYS,
    DEFAULT_SCORING_WEIGHTS,
    MIN_WEIGHT,
    MAX_WEIGHT,
    WEIGHT_SUM_TOLERANCE,
    validateScoringWeights,
    validateWeightValue,
    assertValidScoringWeights,
    mergeScoringWeights
} from '../config/scoringWeights.js';
import { validateRepoConfig } from '../middleware/validate.js';
import { calculatePRScore, getAlgorithmConfiguration } from '../services/contributionService.js';
import User from '../models/User.js';

const VALID = { impact: 0.3, complexity: 0.2, quality: 0.2, review: 0.15, priority: 0.15 };

function createMockHttp(body) {
    let status = null;
    let payload = null;
    let nextCalled = false;
    const res = {
        status(c) { status = c; return this; },
        json(b) { payload = b; return this; }
    };
    return {
        req: { params: {}, query: {}, body },
        res,
        next: () => { nextCalled = true; },
        status: () => status,
        body: () => payload,
        nextCalled: () => nextCalled
    };
}

function runConfig(body) {
    const http = createMockHttp(body);
    validateRepoConfig(http.req, http.res, http.next);
    return http;
}

describe('scoring weight validator (config/scoringWeights.js)', () => {
    it('accepts the default configuration and it sums to 1', () => {
        assert.equal(validateScoringWeights(DEFAULT_SCORING_WEIGHTS).valid, true);
        const total = SCORING_WEIGHT_KEYS.reduce((s, k) => s + DEFAULT_SCORING_WEIGHTS[k], 0);
        assert.ok(Math.abs(total - 1) <= WEIGHT_SUM_TOLERANCE);
    });

    it('accepts valid configurations, including floating-point sums', () => {
        assert.equal(validateScoringWeights(VALID).valid, true);
        // 0.1 + 0.2 + 0.7 !== 1 in IEEE-754, tolerance must absorb it
        assert.equal(
            validateScoringWeights({ impact: 0.1, complexity: 0.2, quality: 0.7, review: 0, priority: 0 }).valid,
            true
        );
    });

    it('accepts boundary values (0 and 1) when the total is 1', () => {
        const allIn = { impact: 1, complexity: 0, quality: 0, review: 0, priority: 0 };
        assert.equal(validateScoringWeights(allIn).valid, true);
        assert.equal(MIN_WEIGHT, 0);
        assert.equal(MAX_WEIGHT, 1);
    });

    it('rejects negative weights', () => {
        const result = validateScoringWeights({ ...VALID, impact: -0.1, complexity: 0.5 });
        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.field === 'weights.impact' && /negative/.test(e.message)));
    });

    it('rejects a negative weight even if the total happens to equal 1', () => {
        const result = validateScoringWeights({ impact: -0.5, complexity: 0.75, quality: 0.5, review: 0.25, priority: 0 });
        assert.equal(result.valid, false);
    });

    it('rejects weights above the upper limit', () => {
        const result = validateScoringWeights({ impact: 1.5, complexity: 0, quality: -0.5, review: 0, priority: 0 });
        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.field === 'weights.impact' && /exceed/.test(e.message)));
    });

    it('rejects configurations that do not sum to 1', () => {
        const tooLow = validateScoringWeights({ impact: 0.1, complexity: 0.1, quality: 0.1, review: 0.1, priority: 0.1 });
        assert.equal(tooLow.valid, false);
        assert.ok(tooLow.errors.some(e => /sum to 1/.test(e.message)));

        const tooHigh = validateScoringWeights({ ...VALID, priority: 0.3 });
        assert.equal(tooHigh.valid, false);
        assert.ok(tooHigh.errors.some(e => /sum to 1/.test(e.message)));

        const allZero = validateScoringWeights({ impact: 0, complexity: 0, quality: 0, review: 0, priority: 0 });
        assert.equal(allZero.valid, false);
    });

    it('rejects non-finite and non-numeric values', () => {
        for (const bad of [NaN, Infinity, -Infinity, '0.2', null, undefined, true, {}, []]) {
            const result = validateScoringWeights({ ...VALID, impact: bad });
            assert.equal(result.valid, false, `expected ${String(bad)} to be rejected`);
        }
        assert.ok(validateWeightValue('impact', NaN));
        assert.equal(validateWeightValue('impact', 0.5), null);
    });

    it('rejects incomplete configurations and unknown keys', () => {
        const { impact, ...missingOne } = VALID;
        const incomplete = validateScoringWeights(missingOne);
        assert.equal(incomplete.valid, false);
        assert.ok(incomplete.errors.some(e => /Missing weight/.test(e.message)));

        const extra = validateScoringWeights({ ...VALID, bonus: 0 });
        assert.equal(extra.valid, false);
        assert.ok(extra.errors.some(e => /Unexpected weight property/.test(e.message)));
    });

    it('rejects non-object input', () => {
        for (const bad of [null, undefined, 'x', 5, [], [0.2, 0.2, 0.2, 0.2, 0.2]]) {
            assert.equal(validateScoringWeights(bad).valid, false);
        }
    });

    it('assertValidScoringWeights throws with details for invalid and returns input for valid', () => {
        assert.equal(assertValidScoringWeights(VALID), VALID);
        assert.throws(
            () => assertValidScoringWeights({ ...VALID, impact: -1 }),
            err => err.name === 'ScoringWeightsValidationError' && Array.isArray(err.details)
        );
    });

    it('mergeScoringWeights overlays updates on current values and ignores unknown keys', () => {
        const merged = mergeScoringWeights(VALID, { impact: 0.5, hacker: 9 });
        assert.deepEqual(merged, { ...VALID, impact: 0.5 });
    });
});

describe('PUT /config middleware: validateRepoConfig weight rules', () => {
    it('accepts a valid complete weight configuration', () => {
        assert.equal(runConfig({ weights: VALID }).nextCalled(), true);
    });

    it('accepts payloads without weights (weights are optional)', () => {
        assert.equal(runConfig({ targetBranches: ['main'] }).nextCalled(), true);
        assert.equal(runConfig({ bountyPool: 10 }).nextCalled(), true);
    });

    it('rejects negative weights with HTTP 400', () => {
        const http = runConfig({ weights: { impact: -0.2, complexity: 0.4, quality: 0.4, review: 0.2, priority: 0.2 } });
        assert.equal(http.status(), 400);
        assert.equal(http.nextCalled(), false);
        assert.ok(http.body().details.some(d => d.field === 'weights.impact'));
    });

    it('rejects weights above the limit with HTTP 400', () => {
        const http = runConfig({ weights: { impact: 1.2, complexity: 0, quality: 0, review: 0, priority: 0 } });
        assert.equal(http.status(), 400);
        assert.ok(http.body().details.some(d => d.field === 'weights.impact'));
    });

    it('rejects weights that do not sum to 1 with HTTP 400', () => {
        const http = runConfig({ weights: { impact: 0.5, complexity: 0.5, quality: 0.5, review: 0.5, priority: 0.5 } });
        assert.equal(http.status(), 400);
        assert.ok(http.body().details.some(d => /sum to 1/.test(d.message)));
    });

    it('allows partial updates for route-level merge, but rejects malformed weight payloads', () => {
        // Partial updates are intentional. The route must merge these values with
        // the stored configuration and validate the complete result before saving.
        assert.equal(runConfig({ weights: { impact: 0.2 } }).nextCalled(), true);

        assert.equal(runConfig({ weights: {} }).status(), 400);
        assert.equal(runConfig({ weights: [0.2, 0.2, 0.2, 0.2, 0.2] }).status(), 400);
        assert.equal(runConfig({ weights: 'abc' }).status(), 400);
        assert.equal(runConfig({ weights: { ...VALID, impact: NaN } }).status(), 400);
        assert.equal(runConfig({ weights: { ...VALID, bonus: 0.1 } }).status(), 400);
    });

    it('reports every problem at once alongside other field errors', () => {
        const http = runConfig({
            targetBranches: [],
            weights: { impact: -1, complexity: 2, quality: 0, review: 0, priority: 0 },
            bountyPool: -5
        });
        assert.equal(http.status(), 400);
        const fields = http.body().details.map(d => d.field);
        assert.ok(fields.includes('targetBranches'));
        assert.ok(fields.includes('weights.impact'));
        assert.ok(fields.includes('weights.complexity'));
        assert.ok(fields.includes('bountyPool'));
    });
});

describe('User model: repository weights are validated before persisting', () => {
    const makeUser = weights =>
        new User({ githubId: '1', github: 'octo', repositories: [{ name: 'o/r', ...(weights ? { weights } : {}) }] });

    it('accepts a new repository with default weights', async () => {
        await assert.doesNotReject(() => makeUser().validate());
    });

    it('accepts a valid custom configuration', async () => {
        await assert.doesNotReject(() => makeUser(VALID).validate());
    });

    it('rejects negative, out-of-limit and non-summing configurations', async () => {
        await assert.rejects(() => makeUser({ impact: -0.2, complexity: 0.4, quality: 0.4, review: 0.2, priority: 0.2 }).validate());
        await assert.rejects(() => makeUser({ impact: 1.5, complexity: 0, quality: 0, review: 0, priority: 0 }).validate());
        await assert.rejects(() => makeUser({ impact: 0.5, complexity: 0.5, quality: 0.5, review: 0.2, priority: 0.2 }).validate());
    });

    it('rejects an update that makes stored weights invalid, but not unrelated saves of legacy data', async () => {
        const legacy = { impact: 0.9, complexity: 0.9, quality: 0.9, review: 0.9, priority: 0.9 }; // pre-existing bad data
        const doc = User.hydrate({ githubId: '2', github: 'legacy', repositories: [{ name: 'o/r', weights: legacy }] });

        // Unrelated modification: must not be blocked
        doc.displayName = 'Changed';
        await assert.doesNotReject(() => doc.validate());

        // Touching the weights with an invalid value: must be rejected
        doc.repositories[0].weights = { ...legacy, impact: -1 };
        await assert.rejects(() => doc.validate());

        // Fixing them: accepted
        doc.repositories[0].weights = VALID;
        await assert.doesNotReject(() => doc.validate());
    });
});

describe('scoring compatibility with validated weights', () => {
    const metrics = { impact: 0.6, complexity: 0.5, quality: 0.9, review: 0.7, priority: 0.4 };

    it('default weights in the algorithm configuration match the validated defaults', () => {
        assert.deepEqual(getAlgorithmConfiguration().defaultWeights, DEFAULT_SCORING_WEIGHTS);
        assert.equal(validateScoringWeights(getAlgorithmConfiguration().defaultWeights).valid, true);
    });

    it('calculatePRScore output is unchanged for validated weights', () => {
        const result = calculatePRScore(metrics, VALID, { reputation: 0 });
        const expectedBase =
            0.3 * 0.6 + 0.2 * 0.5 + 0.2 * 0.9 + 0.15 * 0.7 + 0.15 * 0.4;
        assert.ok(Math.abs(result.details.baseScore - expectedBase) < 1e-12);
        assert.equal(result.score, Number(expectedBase.toFixed(4)));
    });

    it('with weights summing to 1 and metrics in [0,1], the base score stays in [0,1]', () => {
        const result = calculatePRScore({ impact: 1, complexity: 1, quality: 1, review: 1, priority: 1 }, VALID, {});
        assert.ok(result.details.baseScore <= 1 + 1e-12);
    });

    it('calculatePRScore falls back to the default weights when none are supplied', () => {
        const withDefault = calculatePRScore(metrics, DEFAULT_SCORING_WEIGHTS, {});
        const omitted = calculatePRScore(metrics, undefined, {});
        assert.equal(withDefault.score, omitted.score);
    });
});
