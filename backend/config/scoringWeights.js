/**
 * Scoring Weight Configuration & Validation (MSTS-11)
 *
 * Single source of truth for the five repository-specific scoring weights used
 * by the base score in contribution_algo.md (Step 2):
 *
 *   Base = w_impact*impact + w_complexity*complexity + w_quality*quality
 *        + w_review*review + w_priority*priority
 *
 * A valid configuration must:
 *   1. contain exactly the five known weight keys (no missing / unknown keys),
 *   2. contain only finite numbers,
 *   3. have every weight within [MIN_WEIGHT, MAX_WEIGHT] (non-negative, <= limit),
 *   4. sum to 1 (within WEIGHT_SUM_TOLERANCE to absorb floating-point error).
 */

export const SCORING_WEIGHT_KEYS = Object.freeze(['impact', 'complexity', 'quality', 'review', 'priority']);

/** Inclusive lower / upper limit for each individual weight. */
export const MIN_WEIGHT = 0;
export const MAX_WEIGHT = 1;

/** Required total of all weights. */
export const WEIGHT_SUM_TARGET = 1;

/**
 * Allowed absolute difference between the weight total and WEIGHT_SUM_TARGET.
 * Needed because e.g. 0.1 + 0.2 + 0.7 !== 1 in IEEE-754 arithmetic.
 */
export const WEIGHT_SUM_TOLERANCE = 1e-6;

/** Default configuration applied to newly added repositories. */
export const DEFAULT_SCORING_WEIGHTS = Object.freeze({
    impact: 0.2,
    complexity: 0.2,
    quality: 0.2,
    review: 0.2,
    priority: 0.2
});

/**
 * Validates a single weight value against the type and range rules.
 * @param {string} key
 * @param {any} value
 * @returns {{field: string, message: string} | null} error or null when valid
 */
export function validateWeightValue(key, value) {
    const field = `weights.${key}`;

    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return { field, message: `Weight '${key}' must be a finite number.` };
    }
    if (value < MIN_WEIGHT) {
        return { field, message: `Weight '${key}' must not be negative (received ${value}).` };
    }
    if (value > MAX_WEIGHT) {
        return {
            field,
            message: `Weight '${key}' must not exceed ${MAX_WEIGHT} (received ${value}).`
        };
    }
    return null;
}

/**
 * Validates a COMPLETE scoring weight configuration.
 *
 * @param {any} weights - candidate configuration { impact, complexity, quality, review, priority }
 * @returns {{ valid: boolean, errors: Array<{field: string, message: string}> }}
 */
export function validateScoringWeights(weights) {
    const errors = [];

    if (typeof weights !== 'object' || weights === null || Array.isArray(weights)) {
        return {
            valid: false,
            errors: [{ field: 'weights', message: "'weights' must be an object." }]
        };
    }

    const keys = Object.keys(weights);

    const unexpected = keys.filter(k => !SCORING_WEIGHT_KEYS.includes(k));
    if (unexpected.length > 0) {
        errors.push({
            field: 'weights',
            message: `Unexpected weight property: ${unexpected.join(', ')}. Allowed: ${SCORING_WEIGHT_KEYS.join(', ')}.`
        });
    }

    const missing = SCORING_WEIGHT_KEYS.filter(k => weights[k] === undefined);
    if (missing.length > 0) {
        errors.push({
            field: 'weights',
            message: `Missing weight(s): ${missing.join(', ')}. All of ${SCORING_WEIGHT_KEYS.join(', ')} are required.`
        });
    }

    // Per-weight type / non-negative / limit checks
    let allValuesValid = true;
    for (const key of SCORING_WEIGHT_KEYS) {
        if (weights[key] === undefined) {
            allValuesValid = false;
            continue;
        }
        const err = validateWeightValue(key, weights[key]);
        if (err) {
            allValuesValid = false;
            errors.push(err);
        }
    }

    // Sum check only makes sense when every individual value is usable.
    if (allValuesValid) {
        const total = SCORING_WEIGHT_KEYS.reduce((sum, key) => sum + weights[key], 0);
        if (Math.abs(total - WEIGHT_SUM_TARGET) > WEIGHT_SUM_TOLERANCE) {
            errors.push({
                field: 'weights',
                message: `Weights must sum to ${WEIGHT_SUM_TARGET} (received ${Number(total.toFixed(6))}).`
            });
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Throws if the configuration is invalid. Error carries the field errors in `.details`.
 * @param {any} weights
 * @returns {object} the same weights, for chaining
 */
export function assertValidScoringWeights(weights) {
    const { valid, errors } = validateScoringWeights(weights);
    if (!valid) {
        const err = new Error(errors.map(e => e.message).join(' '));
        err.name = 'ScoringWeightsValidationError';
        err.details = errors;
        throw err;
    }
    return weights;
}

/**
 * Overlays a (possibly partial) update onto the current weights.
 * Only known keys are copied; the result must still be validated.
 * @param {object} [current]
 * @param {object} [updates]
 */
export function mergeScoringWeights(current = {}, updates = {}) {
    const merged = {};
    for (const key of SCORING_WEIGHT_KEYS) {
        merged[key] = updates[key] ?? current?.[key];
    }
    return merged;
}
