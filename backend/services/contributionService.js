/**
 * Contribution Scoring Service — based on contribution_algo.md
 * 
 * This service fetches real data from GitHub and computes a score 
 * following the MSTS v2 Final Algorithm specifications.
 */

import User from '../models/User.js';
import ContributionEvent from '../models/ContributionEvent.js';
import { syncIndex, toPRShape, reviewsFromPR } from './contributionIndex.js';
export { normalizeReviews, evaluateReviewSubstance, REVIEW_DECISIONS } from './reviewAttribution.js';
export { reviewsFromPR };

/**
 * Sync details reported in a score response's meta.
 */
function indexMeta(sync) {
    return {
        stale: sync.stale,
        partial: sync.partial,
        truncated: sync.truncated,
        historyTruncated: sync.historyTruncated,
        rateLimited: sync.rateLimited,
        ...(sync.rateLimitResetAt && { rateLimitResetAt: sync.rateLimitResetAt }),
        ...(sync.errors.length > 0 && { syncError: sync.errors[0] }),
        githubRequests: sync.githubRequests,
        searchRequests: sync.searchRequests,
        detailRequests: sync.detailRequests,
        detailErrors: sync.detailErrors,
        reviewRequests: sync.reviewRequests || 0,
        reviewErrors: sync.reviewErrors || 0,
        newEvents: sync.newEvents,
        alreadyIndexed: sync.alreadyIndexed,
        cursorsAdvanced: sync.cursorsAdvanced
    };
}
import {
    fetchAllSearchResults,
    fetchPRDetails,
    repoFullNameFromUrl
} from './githubSearch.js';
import { calculateSpamPenalty } from './kineticMechanisms.js';
import AlgorithmVersion from '../models/AlgorithmVersion.js';
import ContributionScore from '../models/ContributionScore.js';

const MAX_LINES = 10000;
const REPUTATION_INFLUENCE_LAMBDA = 0.5;

function parseEnvWeight(val, defaultVal) {
    if (val === undefined || val === '') return defaultVal;
    const parsed = parseFloat(val);
    return Number.isNaN(parsed) ? defaultVal : parsed;
}

/**
 * Default weights for the Historical Reputation Formula:
 * R = α*(accepted_PRs) + β*(avg_review_score) + γ*(historical_impact) + δ*(consistency)
 */
export const DEFAULT_REPUTATION_WEIGHTS = {
    alpha: parseEnvWeight(process.env.REPUTATION_ALPHA, 10),
    beta: parseEnvWeight(process.env.REPUTATION_BETA, 25),
    gamma: parseEnvWeight(process.env.REPUTATION_GAMMA, 30),
    delta: parseEnvWeight(process.env.REPUTATION_DELTA, 20)
};

/**
 * Calculates consistency score [0, 1] based on timestamp spread of merged PRs
 */
export function calculateConsistencyScore(prs = []) {
    if (!prs || prs.length === 0) return 0;
    if (prs.length === 1) return 0.5;

    const timestamps = prs
        .map(pr => pr.merged_at ? new Date(pr.merged_at).getTime() : (pr.updated_at ? new Date(pr.updated_at).getTime() : null))
        .filter(Boolean)
        .sort((a, b) => a - b);

    if (timestamps.length <= 1) return 0.5;

    // Track unique active calendar weeks
    const uniqueWeeks = new Set(
        timestamps.map(ts => {
            const d = new Date(ts);
            const startOfYear = new Date(d.getFullYear(), 0, 1);
            const weekNumber = Math.ceil((((d - startOfYear) / 86400000) + startOfYear.getDay() + 1) / 7);
            return `${d.getFullYear()}-W${weekNumber}`;
        })
    );

    // Full consistency achieved with sustained activity across multiple weeks (normalized [0, 1])
    return Math.min(1.0, Math.max(0.2, uniqueWeeks.size / 5));
}

/**
 * Computes contributor reputation from historical contribution evidence:
 * R = α*(accepted_PRs) + β*(avg_review_score) + γ*(historical_impact) + δ*(consistency)
 *
 * @param {Object} evidence - { acceptedPRs, avgReviewScore, historicalImpact, consistency }
 * @param {Object} [customWeights] - Optional custom coefficients { alpha, beta, gamma, delta }
 * @returns {Object} { reputation, evidence, weights }
 */
export function calculateHistoricalReputation(evidence = {}, customWeights = {}) {
    const acceptedPRs = Math.max(0, Number(evidence.acceptedPRs) || 0);
    const avgReviewScore = Math.max(0, Math.min(1.0, Number(evidence.avgReviewScore) || 0));
    const historicalImpact = Math.max(0, Number(evidence.historicalImpact) || 0);
    const consistency = Math.max(0, Math.min(1.0, Number(evidence.consistency) || 0));

    const weights = {
        alpha: customWeights.alpha ?? DEFAULT_REPUTATION_WEIGHTS.alpha,
        beta: customWeights.beta ?? DEFAULT_REPUTATION_WEIGHTS.beta,
        gamma: customWeights.gamma ?? DEFAULT_REPUTATION_WEIGHTS.gamma,
        delta: customWeights.delta ?? DEFAULT_REPUTATION_WEIGHTS.delta
    };

    const rawReputation = 
        (weights.alpha * acceptedPRs) +
        (weights.beta * avgReviewScore) +
        (weights.gamma * historicalImpact) +
        (weights.delta * consistency);

    const reputation = Math.max(0, Math.round(rawReputation * 100) / 100);

    return {
        reputation,
        evidence: {
            acceptedPRs,
            avgReviewScore,
            historicalImpact,
            consistency,
            lastCalculated: evidence.lastCalculated || new Date()
        },
        weights
    };
}

/**
 * Fetches historical PRs for a contributor and computes their reputation score
 */
export async function getContributorReputation(username, token, customWeights = {}) {
    const githubToken = token || process.env.GITHUB_PAT;
    const headers = {
        'Accept': 'application/vnd.github.v3+json',
        ...(githubToken && { 'Authorization': `token ${githubToken}` })
    };

    try {
        const searchQuery = `author:${username} is:pr is:merged updated:>2024-01-01`;
        const searchRes = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=15`, { headers });
        const searchData = await searchRes.json();

        if (!searchData.items || searchData.items.length === 0) {
            return {
                reputation: 0,
                evidence: { acceptedPRs: 0, avgReviewScore: 0, historicalImpact: 0, consistency: 0, lastCalculated: new Date() },
                weights: { ...DEFAULT_REPUTATION_WEIGHTS, ...customWeights }
            };
        }

        const prs = [];
        for (const item of searchData.items.slice(0, 10)) {
            const prUrl = item.pull_request?.url;
            if (!prUrl) continue;
            try {
                const prRes = await fetch(prUrl, { headers });
                const prData = await prRes.json();
                prs.push({
                    prData,
                    metrics: extractPRMetrics(prData)
                });
            } catch {
                // Ignore individual PR fetch failures
            }
        }

        const acceptedPRs = searchData.total_count || prs.length;
        const totalReview = prs.reduce((sum, p) => sum + p.metrics.review, 0);
        const avgReviewScore = prs.length > 0 ? totalReview / prs.length : 0.5;
        const historicalImpact = prs.reduce((sum, p) => sum + p.metrics.impact, 0);
        const consistency = calculateConsistencyScore(prs.map(p => p.prData));

        return calculateHistoricalReputation({
            acceptedPRs,
            avgReviewScore,
            historicalImpact,
            consistency
        }, customWeights);
    } catch (err) {
        console.error(`Failed to fetch contributor reputation for ${username}:`, err.message);
        return {
            reputation: 0,
            evidence: { acceptedPRs: 0, avgReviewScore: 0, historicalImpact: 0, consistency: 0, lastCalculated: new Date() },
            weights: { ...DEFAULT_REPUTATION_WEIGHTS, ...customWeights }
        };
    }
}
// ─────────────────────────────────────────────────────────────
//  Algorithm Versioning
// ─────────────────────────────────────────────────────────────

export const ALGORITHM_VERSION = 'msts-v2.0.0';
export const ALGORITHM_NAME = 'MSTS Contribution Scoring';

/**
 * Returns the exact configuration used by the scoring algorithm.
 */
export function getAlgorithmConfiguration() {
    return {
        maxLines: MAX_LINES,
        reputationInfluenceLambda: REPUTATION_INFLUENCE_LAMBDA,
        reputationMax: 500,
        reputationMultiplierCap: 1.5,
        filters: {
            minQuality: 0.3,
            minReview: 0.3,
            spamImpact: 0.2,
            spamComplexity: 0.2,
        },
        defaultWeights: { impact: 0.2, complexity: 0.2, quality: 0.2, review: 0.2, priority: 0.2 },
        pointsScale: 20,
        scoreCap: 100,
    };
}

/**
 * Ensures the current algorithm version exists in DB and is the only active one.
 */
export async function ensureAlgorithmVersion() {
    const config = getAlgorithmConfiguration();
    await AlgorithmVersion.updateMany(
        { version: { $ne: ALGORITHM_VERSION } },
        { isActive: false }
    );
    return AlgorithmVersion.findOneAndUpdate(
        { version: ALGORITHM_VERSION },
        { $setOnInsert: { name: ALGORITHM_NAME, configuration: config }, isActive: true },
        { upsert: true, new: true }
    );
}

/**
 * Derives normalized inputs for the algorithm from a GitHub PR object
 */
export function extractPRMetrics(pr) {
    // 1. Complexity (log-scaled lines)
    const linesChanged = (pr.additions || 0) + (pr.deletions || 0);
    const complexity = Math.min(1.0, Math.log(linesChanged + 1) / Math.log(MAX_LINES + 1));

    // 2. Impact (proxied by changed files and commits)
    const impactRaw = ((pr.changed_files || 0) * 2 + (pr.commits || 0)) / 50;
    const impact = Math.min(1.0, impactRaw);

    // 3. Quality (proxy: based on deletions/refactor ratio)
    let quality = 0.8; 
    if (pr.deletions > pr.additions) quality += 0.1; // refactor bonus
    if (pr.merged === true) quality += 0.1; // merge bonus
    quality = Math.min(1.0, quality);

    // 4. Review (proxy based on review comments)
    const reviewRaw = (pr.review_comments || 0) / 10;
    const review = Math.min(1.0, reviewRaw + 0.5);

    // 5. Priority (proxy based on repo popularity or labels)
    const hasPriorityLabel = pr.labels && pr.labels.some(l => 
        ['priority', 'high', 'critical', 'urgent'].some(k => l.name.toLowerCase().includes(k))
    );
    const priority = hasPriorityLabel ? 1.0 : 0.4;

    return { impact, complexity, quality, review, priority };
}

/**
 * Computes the Final Score for a PR based on contribution_algo.md
 * Integrates MSTS Anti-Gaming, Log-scaled Base Impact, Reputation, and Velocity Penalties.
 */
export function calculatePRScore(metrics, weights, context = {}) {
    // Step 1: Anti-Gaming Filters
    if (metrics.quality < 0.3 || metrics.review < 0.3) {
        return { score: 0, reason: "Failed minimum quality threshold" };
    }
    if (metrics.impact < 0.2 && metrics.complexity < 0.2) {
        return { score: 0, reason: "Failed spam / micro PR filter" };
    }

    // Default weights if not provided
    const w = weights || { impact: 0.2, complexity: 0.2, quality: 0.2, review: 0.2, priority: 0.2 };

    // Step 2: Base Score (Weighted average of 5 dimensions)
    const baseScore = 
        (w.impact * metrics.impact) +
        (w.complexity * metrics.complexity) +
        (w.quality * metrics.quality) +
        (w.review * metrics.review) +
        (w.priority * metrics.priority);

    // Step 3: Reputation Multiplier
    const rawReputation = context.reputation || 0;
    const R_max = 500; 
    const R_norm = Math.max(0, Math.log(rawReputation + 1) / Math.log(R_max + 1));
    
    let repMult = 1 + (REPUTATION_INFLUENCE_LAMBDA * Math.min(1.0, R_norm));
    repMult = Math.min(1.5, repMult); 

    // Step 4: Velocity Spam Penalty
    const prTimestamps = context.timestamps || [];
    const spamPenalty = calculateSpamPenalty(prTimestamps);

    // Step 5: Final Score Formula: (Base * Rep) * Penalty
    const finalScore = Number((baseScore * repMult * spamPenalty).toFixed(4));

    return {
        score: finalScore,
        spamPenalty,
        isSpamFlagged: spamPenalty < 0.8,
        details: { metrics, weights: w, baseScore, repMult, spamPenalty }
    };
}

/**
 * Synchronous helper for evaluating single PR payload and timestamp history
 */
export function evaluateSinglePRScore(prData, contributorHistory = []) {
    const prTimestamps = contributorHistory.map(pr => pr.createdAt || pr.submittedAt);
    prTimestamps.push(prData.createdAt || prData.created_at || new Date());

    const metrics = extractPRMetrics(prData);
    return calculatePRScore(metrics, null, { timestamps: prTimestamps });
}

/**
 * Main function: Fetches real PRs from GitHub and computes overall Contribution Score
 */
export async function computeContributionScore(username, token, options = {}) {
    const githubToken = token || process.env.GITHUB_PAT;
    const headers = {
        'Accept': 'application/vnd.github.v3+json',
        ...(githubToken && { 'Authorization': `token ${githubToken}` })
    };

    try {
        const user = await User.findOne({ github: username });
        const userRepos = user?.repositories || [];

        // Build a map of ALL repos registered on the platform
        const allOrgUsers = await User.find({ 'repositories.0': { $exists: true } });
        const registeredRepoMap = {};
        for (const orgUser of allOrgUsers) {
            for (const repo of orgUser.repositories) {
                registeredRepoMap[repo.name] = repo;
            }
        }

        // Sync this author's merged PRs into the contribution index, then score from it
        const registeredKeys = new Set(Object.keys(registeredRepoMap).map(name => name.toLowerCase()));
        const authorKey = username.toLowerCase();
        const sync = await syncIndex({
            scopes: [{ key: `author:${authorKey}`, qualifier: `author:${username}` }],
            detailFilter: { authorKey },
            registeredKeys,
            headers,
            fetchReviews: true
        });

        const events = await ContributionEvent.find({
            authorKey,
            type: 'pr_merge',
            repoKey: { $in: [...registeredKeys] },
            detailsFetchedAt: { $ne: null }
        }).sort({ mergedAt: -1 }).lean();

        if (events.length === 0 && sync.stale) {
            return {
                username, finalScore: 0, prs: [],
                error: sync.errors[0] || 'GitHub API rate limit exceeded',
                meta: { prCount: 0, source: 'index', ...indexMeta(sync) }
            };
        }

        if (events.length === 0) {
            return {
                username,
                finalScore: 0,
                algorithmVersion: ALGORITHM_VERSION,
                prs: [],
                meta: { prCount: 0, source: 'index', ...indexMeta(sync) }
            };
        }

        const validPRRecords = [];
        const prTimestamps = [];

        for (const event of events) {
            const prData = toPRShape(event);

            const repoFullName = prData.base?.repo?.full_name;

            // Filter: only track PRs for repos registered on the platform
            if (!repoFullName || !registeredRepoMap[repoFullName]) continue;

            // Collect timestamp for velocity penalty calculation
            if (prData.created_at) prTimestamps.push(prData.created_at);

            const repoConfig = registeredRepoMap[repoFullName] || userRepos.find(r => r.name === repoFullName);
            const weights = repoConfig?.weights || null;
            const repWeights = options.reputationWeights || repoConfig?.reputationWeights;

            const metrics = extractPRMetrics(prData);
            validPRRecords.push({
                prData,
                repoFullName,
                repoConfig,
                weights,
                repWeights,
                metrics
            });
        }

        if (validPRRecords.length === 0) {
            return {
                username,
                finalScore: 0,
                reputation: 0,
                prs: [],
                meta: {
                    computeTimeMs: Date.now() - (options.startTime || Date.now()),
                    prCount: 0,
                    source: 'index',
                    ...indexMeta(sync)
                }
            };
        }

        // Calculate reputation from actual historical contribution evidence (MSTS-03)
        // R = α*(accepted_PRs) + β*(avg_review_score) + γ*(historical_impact) + δ*(consistency)
        const acceptedPRs = validPRRecords.length;
        const totalReview = validPRRecords.reduce((sum, r) => sum + r.metrics.review, 0);
        const avgReviewScore = acceptedPRs > 0 ? totalReview / acceptedPRs : 0;
        const historicalImpact = validPRRecords.reduce((sum, r) => sum + r.metrics.impact, 0);
        const consistency = calculateConsistencyScore(validPRRecords.map(r => r.prData));

        const activeRepWeights = options.reputationWeights || validPRRecords[0]?.repWeights || user?.reputationWeights;
        const { reputation: contributorReputation, evidence: repEvidence } = calculateHistoricalReputation({
            acceptedPRs,
            avgReviewScore,
            historicalImpact,
            consistency
        }, activeRepWeights);

        let totalPoints = 0;
        const prDetails = [];

        for (const record of validPRRecords) {
            // Integrate historical reputation into PR scoring
            const result = calculatePRScore(record.metrics, record.weights, {
                reputation: contributorReputation,
                timestamps: prTimestamps
            });

            const prPoints = Math.round(result.score * 20 * 10) / 10;
            totalPoints += prPoints;

            // ── Persist score with algorithm version + config snapshot ──
            try {
                await ContributionScore.findOneAndUpdate(
                    { username, repository: record.repoFullName, prNumber: record.prData.number },
                    {
                        $set: {
                            score: prPoints,
                            algorithmVersion: ALGORITHM_VERSION,
                            configurationSnapshot: {
                                algorithm: getAlgorithmConfiguration(),
                                weights: result.details?.weights || record.weights || getAlgorithmConfiguration().defaultWeights,
                                repoConfig: record.repoConfig
                                    ? {
                                        name: record.repoConfig.name,
                                        weights: record.repoConfig.weights,
                                        bountyPool: record.repoConfig.bountyPool
                                    }
                                    : null,
                            },
                            calculatedAt: new Date(),
                        },
                    },
                    { upsert: true, new: true }
                );
            } catch (dbErr) {
                console.error('Failed to persist contribution score:', dbErr.message);
            }

            prDetails.push({
                id: record.prData.number,
                title: record.prData.title,
                repo: record.repoFullName,
                score: prPoints,
                algorithmVersion: ALGORITHM_VERSION,
                status: 'merged',
                date: record.prData.merged_at?.split('T')[0] || 'N/A',
                link: record.prData.html_url,
                reviews: record.prData.reviews || [],
                reviewers: record.prData.reviewers || [],
                substantiveReviewers: record.prData.substantiveReviewers || [],
                reviewSummary: record.prData.reviewSummary || null
            });
        }

        // Persist computed historical reputation to contributor User record if found
        if (user) {
            user.reputation = contributorReputation;
            user.reputationEvidence = repEvidence;
            await user.save().catch(err => console.warn('Could not persist user reputation:', err.message));
        }

        // Hard cap at 100
        const finalScore = Math.min(100, Math.round(totalPoints * 10) / 10);

        return {
            username,
            finalScore,
            reputation: contributorReputation,
            reputationEvidence: repEvidence,
            algorithmVersion: ALGORITHM_VERSION,
            prs: prDetails,
            meta: {
                computeTimeMs: Date.now() - (options.startTime || Date.now()),
                prCount: prDetails.length,
                source: 'index',
                ...indexMeta(sync)
            }
        };
    } catch (error) {
        console.error("Error computing score:", error);
        return { username, finalScore: 0, prs: [], error: error.message };
    }
}

/**
 * Computes contributors for an organization based on its tracked repositories
 */
export async function computeOrgContributors(orgId, token) {
    const githubToken = token || process.env.GITHUB_PAT;
    const headers = {
        'Accept': 'application/vnd.github.v3+json',
        ...(githubToken && { 'Authorization': `token ${githubToken}` })
    };

    try {
        const org = await User.findById(orgId);
        if (!org || org.role !== 'organization') return { contributors: [], recentEvents: [] };

        const repoNames = org.repositories.map(r => r.name);
        if (repoNames.length === 0) return { contributors: [], recentEvents: [] };

        // Sync the organization's repositories into the contribution index (one
        // cursor per repo), then score from the index
        const repoKeys = new Set(repoNames.map(name => name.toLowerCase()));
        const sync = await syncIndex({
            scopes: repoNames.map(name => ({ key: `repo:${name.toLowerCase()}`, qualifier: `repo:${name}` })),
            detailFilter: {},
            registeredKeys: repoKeys,
            headers,
            fetchReviews: true
        });

        const events = await ContributionEvent.find({
            type: 'pr_merge',
            repoKey: { $in: [...repoKeys] },
            detailsFetchedAt: { $ne: null }
        }).sort({ mergedAt: -1 }).lean();

        const meta = { source: 'index', eventCount: events.length, ...indexMeta(sync) };
        if (events.length === 0) return { contributors: [], recentEvents: [], meta };

        const contributorPRMap = {};
        for (const event of events) {
            const prData = toPRShape(event);
            const username = event.author;
            if (!username) continue;

            const repoFullName = prData.base?.repo?.full_name;
            const repoConfig = org.repositories.find(r => r.name === repoFullName);
            const metrics = extractPRMetrics(prData);

            if (!contributorPRMap[username]) {
                contributorPRMap[username] = {
                    user: { login: username, avatar_url: event.authorAvatar },
                    prs: []
                };
            }
            contributorPRMap[username].prs.push({ prData, repoFullName, repoConfig, metrics });
        }

        const contributorsMap = {};
        const recentEvents = [];

        // 2. Score each contributor using their historical reputation evidence
        for (const [username, cData] of Object.entries(contributorPRMap)) {
            // Check if contributor already has a reputation stored in DB
            const existingUser = await User.findOne({ github: username });
            let contributorReputation = existingUser?.reputation;

            if (contributorReputation === undefined || contributorReputation === null || contributorReputation === 0) {
                const prs = cData.prs;
                const acceptedPRs = prs.length;
                const totalReview = prs.reduce((sum, p) => sum + p.metrics.review, 0);
                const avgReviewScore = acceptedPRs > 0 ? totalReview / acceptedPRs : 0.5;
                const historicalImpact = prs.reduce((sum, p) => sum + p.metrics.impact, 0);
                const consistency = calculateConsistencyScore(prs.map(p => p.prData));

                const repWeights = prs[0]?.repoConfig?.reputationWeights;
                const repResult = calculateHistoricalReputation({
                    acceptedPRs,
                    avgReviewScore,
                    historicalImpact,
                    consistency
                }, repWeights);
                contributorReputation = repResult.reputation;
            }

            for (const prItem of cData.prs) {
                const result = calculatePRScore(prItem.metrics, prItem.repoConfig?.weights, { reputation: contributorReputation });
                const prScore = result.score * 20;

                if (!contributorsMap[username]) {
                    contributorsMap[username] = {
                        username,
                        totalScore: 0,
                        prCount: 0,
                        avatar: cData.user?.avatar_url,
                        reputation: contributorReputation
                    };
                }

                contributorsMap[username].totalScore += prScore;
                contributorsMap[username].prCount += 1;

                recentEvents.push({
                    username,
                    type: 'PR_MERGE',
                    repo: prItem.repoFullName,
                    score: Math.round(prScore * 10) / 10,
                    timestamp: prItem.prData.merged_at,
                    cid: `bafybei${Math.random().toString(16).substring(2, 10)}`
                });
            }
        }

        const stats = Object.values(contributorsMap).map(c => ({
            ...c,
            totalScore: Math.min(100, Math.round(c.totalScore * 10) / 10)
        }));

        return {
            contributors: stats.sort((a, b) => b.totalScore - a.totalScore),
            recentEvents: recentEvents.slice(0, 10),
            meta
        };

    } catch (error) {
        console.error("Org contributors error:", error);
        return { contributors: [], recentEvents: [] };
    }
}