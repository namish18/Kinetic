/**
 * Contribution Scoring Service — based on contribution_algo.md
 */

const MAX_LINES = 10000;
const REPUTATION_INFLUENCE_LAMBDA = 0.5;
const DAO_INFLUENCE_MU = 0.3;

/**
 * Derives normalized inputs for the algorithm from a GitHub PR object
 */
export function extractPRMetrics(pr) {
    // 1. Complexity (log-scaled lines)
    const linesChanged = (pr.additions || 0) + (pr.deletions || 0);
    const complexity = Math.log(linesChanged + 1) / Math.log(MAX_LINES + 1);

    // 2. Impact (proxied by changed files and commits)
    const impactRaw = ((pr.changed_files || 0) * 2 + (pr.commits || 0)) / 50;
    const impact = Math.min(1.0, impactRaw);

    // 3. Quality (proxy)
    const quality = 0.9;

    // 4. Review (proxy based on review comments)
    const reviewRaw = (pr.review_comments || 0) / 10;
    const review = Math.min(1.0, reviewRaw + 0.5);

    // 5. Priority (proxy based on labels)
    const hasPriorityLabel = pr.labels && pr.labels.some(l => l.name.toLowerCase().includes('priority') || l.name.toLowerCase().includes('high'));
    const priority = hasPriorityLabel ? 1.0 : 0.5;

    return { 
        impact: Math.max(0, impact), 
        complexity: Math.max(0, complexity), 
        quality, 
        review, 
        priority 
    };
}

/**
 * Step 1-6: Computes the Final Score for a PR based on contribution_algo.md
 * @param {Object} metrics - { impact, complexity, quality, review, priority }
 * @param {Object} weights - { impact, complexity, quality, review, priority }
 * @param {Object} context - { reputation: number, daoScore: number }
 */
export function calculatePRScore(metrics, weights, context = {}) {
    // Step 1: Anti-Gaming Filters
    if (metrics.quality < 0.3 || metrics.review < 0.3) {
        return { score: 0, reason: "Failed minimum quality threshold" };
    }
    if (metrics.impact < 0.2 && metrics.complexity < 0.2) {
        return { score: 0, reason: "Failed spam / micro PR filter" };
    }

    // Step 2: Base Score
    const baseScore = 
        (weights.impact * metrics.impact) +
        (weights.complexity * metrics.complexity) +
        (weights.quality * metrics.quality) +
        (weights.review * metrics.review) +
        (weights.priority * metrics.priority);

    // Step 3: Complexity anti-gaming is already applied via log-scaling in extractPRMetrics.

    // Step 4: Reputation System
    const rawReputation = context.reputation || 0;
    const R_max = 1000;
    const R_norm = Math.max(0, Math.log(rawReputation + 1) / Math.log(R_max + 1));
    
    let repMult = 1 + (REPUTATION_INFLUENCE_LAMBDA * Math.min(1.0, R_norm));
    repMult = Math.min(1.5, repMult); // capped prevent dominance

    // Step 5: DAO Score
    const daoScore = context.daoScore !== undefined ? context.daoScore : 0.5; // neutral D_i 
    let daoAdj = 1 + DAO_INFLUENCE_MU * (daoScore - 0.5);
    daoAdj = Math.max(0.8, Math.min(1.2, daoAdj)); // Clamp DAO influence

    // Step 6: Final Score
    const finalScore = baseScore * repMult * daoAdj;

    // Optional Step 7: Anti-gaming post adjustments (Diminishing returns handled externally if we know historical PR count).

    return {
        score: finalScore,
        details: {
            metrics,
            weights,
            baseScore,
            repMult,
            daoAdj
        }
    };
}

/**
 * Helper to wrap the old computeMSTS call for backward compatibility with the frontend user dashboard.
 */
export async function computeMSTS(username, token, options = {}) {
    const mockMetrics = { impact: 0.8, complexity: 0.7, quality: 0.9, review: 0.8, priority: 0.5 };
    const mockWeights = { impact: 0.2, complexity: 0.2, quality: 0.2, review: 0.2, priority: 0.2 };
    
    // Assume user has some reputation for mock
    const result = calculatePRScore(mockMetrics, mockWeights, { reputation: 100, daoScore: 0.6 });
    
    return {
        username,
        // scale up abstract score so it aligns with 0-100 UI visualizer
        finalScore: Math.round(result.score * 100 * 10) / 10, 
        layers: result.details
    };
}
