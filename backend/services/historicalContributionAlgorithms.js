
import { calculateSpamPenalty } from './kineticMechanisms.js';

// ─────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

// ─────────────────────────────────────────────────────────────
// MSTS v2 Historical Score Verification
// ─────────────────────────────────────────────────────────────

/**
 * Independent reproduction of msts-v2.0.0.
 *
 * The function returns the final persisted PR points,
 * not the intermediate raw score.
 *
 * This verifier uses the original MSTS v2 weighted-sum
 * formula without weight normalization.
 */

function verifyMstsV2Score(
    scoringInputs,
    configurationSnapshot
) {
    if (
        !scoringInputs ||
        !configurationSnapshot ||
        !configurationSnapshot.algorithm
    ) {
        throw new Error(
            'Missing scoring inputs or algorithm configuration.'
        );
    }

    const {
        metrics,
        reputation,
        timestamps
    } = scoringInputs;

    const {
        algorithm,
        weights
    } = configurationSnapshot;

    if (!metrics || !weights || !algorithm) {
        throw new Error(
            'Incomplete historical scoring data.'
        );
    }

    // ─────────────────────────────────────────────────────────
    // Step 1: Validate Metrics and Weights
    // ─────────────────────────────────────────────────────────

    const metricNames = [
        'impact',
        'complexity',
        'quality',
        'review',
        'priority'
    ];

    for (const name of metricNames) {

        if (!isFiniteNumber(metrics[name])) {
            throw new Error(
                `Invalid metric: ${name}`
            );
        }

        if (!isFiniteNumber(weights[name])) {
            throw new Error(
                `Invalid weight: ${name}`
            );
        }
    }

    // ─────────────────────────────────────────────────────────
    // Step 2: Validate Reputation and Timestamps
    // ─────────────────────────────────────────────────────────

    if (
        !isFiniteNumber(reputation) ||
        reputation < 0
    ) {
        throw new Error(
            'Invalid contributor reputation.'
        );
    }

    if (!Array.isArray(timestamps)) {
        throw new Error(
            'Invalid timestamp evidence.'
        );
    }

    // ─────────────────────────────────────────────────────────
    // Step 3: Anti-Gaming Filters
    // ─────────────────────────────────────────────────────────

    const filters = algorithm.filters;

    if (!filters) {
        throw new Error(
            'Missing algorithm filters.'
        );
    }

    // Reproduce the anti-gaming checks used by MSTS v2.

    if (
        metrics.quality < filters.minQuality ||
        metrics.review < filters.minReview ||
        (
            metrics.impact < filters.spamImpact &&
            metrics.complexity < filters.spamComplexity
        )
    ) {
        return 0;
    }

    // ─────────────────────────────────────────────────────────
    // Step 4: Original MSTS v2 Weighted-Sum Formula
    // ─────────────────────────────────────────────────────────

    /**
     * IMPORTANT:
     *
     * Original formula:
     *
     * Base Score =
     * (Impact × Impact Weight)
     * + (Complexity × Complexity Weight)
     * + (Quality × Quality Weight)
     * + (Review × Review Weight)
     * + (Priority × Priority Weight)
     *
     * Do NOT divide by totalWeight.
     *
     * This must match calculatePRScore() exactly.
     */

    const baseScore = metricNames.reduce(
        (total, name) =>
            total + metrics[name] * weights[name],
        0
    );

    // ─────────────────────────────────────────────────────────
    // Step 5: Reputation Multiplier
    // ─────────────────────────────────────────────────────────

    const reputationMax = algorithm.reputationMax;

    const reputationLambda =
        algorithm.reputationInfluenceLambda;

    const multiplierCap =
        algorithm.reputationMultiplierCap;

    if (
        !isFiniteNumber(reputationMax) ||
        reputationMax <= 0 ||
        !isFiniteNumber(reputationLambda) ||
        !isFiniteNumber(multiplierCap)
    ) {
        throw new Error(
            'Invalid reputation configuration.'
        );
    }

    const reputationMultiplier = Math.min(
        multiplierCap,
        1 + reputationLambda *
            Math.min(
                1,
                Math.log(reputation + 1) /
                Math.log(reputationMax + 1)
            )
    );

    // ─────────────────────────────────────────────────────────
    // Step 6: Velocity Spam Penalty
    // ─────────────────────────────────────────────────────────

    const spamPenalty =
        calculateSpamPenalty(timestamps);

    if (!isFiniteNumber(spamPenalty)) {
        throw new Error(
            'Spam penalty calculation returned an invalid value.'
        );
    }

    // ─────────────────────────────────────────────────────────
    // Step 7: Final Raw Score
    // ─────────────────────────────────────────────────────────

    const rawScore = Number(
        (
            baseScore *
            reputationMultiplier *
            spamPenalty
        ).toFixed(4)
    );

    // ─────────────────────────────────────────────────────────
    // Step 8: Final Persisted PR Points
    // ─────────────────────────────────────────────────────────

    const pointsScale = algorithm.pointsScale;

    if (
        !isFiniteNumber(pointsScale) ||
        pointsScale <= 0
    ) {
        throw new Error(
            'Invalid points scale.'
        );
    }

    /**
     * Match the original persisted score rounding exactly.
     *
     * Original:
     * Math.round(result.score * pointsScale * 10) / 10
     */

    return Math.round(
        rawScore * pointsScale * 10
    ) / 10;
}

// ─────────────────────────────────────────────────────────────
// Historical Algorithm Registry
// ─────────────────────────────────────────────────────────────

export const CONTRIBUTION_ALGORITHM_REGISTRY =
    Object.freeze({
        'msts-v2.0.0': verifyMstsV2Score
    });
