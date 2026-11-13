
/**
 * Contribution Scoring Service — based on contribution_algo.md
 *
 * This service fetches real data from GitHub and computes a score
 * following the MSTS v2 Final Algorithm specifications.
 */

import User from '../models/User.js';
import ContributionEvent from '../models/ContributionEvent.js';
import AlgorithmVersion from '../models/AlgorithmVersion.js';
import ContributionScore from '../models/ContributionScore.js';

import {
    syncIndex,
    toPRShape,
    attributionFromEvent
} from './contributionIndex.js';

import {
    createContributionEvidence
} from './contributionEvidenceService.js';

import {
    fetchAllSearchResults,
    fetchPRDetails,
    repoFullNameFromUrl
} from './githubSearch.js';

import { calculateSpamPenalty } from './kineticMechanisms.js';

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

const MAX_LINES = 10000;
const REPUTATION_INFLUENCE_LAMBDA = 0.5;

function parseEnvWeight(val, defaultVal) {
    if (val === undefined || val === '') return defaultVal;

    const parsed = parseFloat(val);

    return Number.isNaN(parsed) ? defaultVal : parsed;
}

/**
 * Default weights for Historical Reputation Formula:
 *
 * R = α*(accepted_PRs)
 *   + β*(avg_review_score)
 *   + γ*(historical_impact)
 *   + δ*(consistency)
 */

export const DEFAULT_REPUTATION_WEIGHTS = {
    alpha: parseEnvWeight(process.env.REPUTATION_ALPHA, 10),
    beta: parseEnvWeight(process.env.REPUTATION_BETA, 25),
    gamma: parseEnvWeight(process.env.REPUTATION_GAMMA, 30),
    delta: parseEnvWeight(process.env.REPUTATION_DELTA, 20)
};

// ─────────────────────────────────────────────────────────────
// Sync Metadata
// ─────────────────────────────────────────────────────────────

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

        ...(sync.rateLimitResetAt && {
            rateLimitResetAt: sync.rateLimitResetAt
        }),

        ...(sync.errors.length > 0 && {
            syncError: sync.errors[0]
        }),

        githubRequests: sync.githubRequests,
        searchRequests: sync.searchRequests,
        detailRequests: sync.detailRequests,
        detailErrors: sync.detailErrors,
        newEvents: sync.newEvents,
        alreadyIndexed: sync.alreadyIndexed,
        cursorsAdvanced: sync.cursorsAdvanced
    };
}

// ─────────────────────────────────────────────────────────────
// Historical Reputation
// ─────────────────────────────────────────────────────────────

/**
 * Calculates consistency score [0, 1] based on timestamp
 * spread of merged PRs.
 */

export function calculateConsistencyScore(prs = []) {
    if (!prs || prs.length === 0) return 0;

    if (prs.length === 1) return 0.5;

    const timestamps = prs
        .map(pr =>
            pr.merged_at
                ? new Date(pr.merged_at).getTime()
                : (
                    pr.updated_at
                        ? new Date(pr.updated_at).getTime()
                        : null
                )
        )
        .filter(Boolean)
        .sort((a, b) => a - b);

    if (timestamps.length <= 1) return 0.5;

    // Track unique active calendar weeks.

    const uniqueWeeks = new Set(
        timestamps.map(ts => {
            const d = new Date(ts);

            const startOfYear = new Date(
                d.getFullYear(),
                0,
                1
            );

            const weekNumber = Math.ceil(
                (
                    (
                        (d - startOfYear) / 86400000
                    ) + startOfYear.getDay() + 1
                ) / 7
            );

            return `${d.getFullYear()}-W${weekNumber}`;
        })
    );

    // Full consistency achieved with sustained activity
    // across multiple weeks.

    return Math.min(
        1.0,
        Math.max(0.2, uniqueWeeks.size / 5)
    );
}

/**
 * Computes contributor reputation from historical contribution
 * evidence.
 *
 * R = α*(accepted_PRs)
 *   + β*(avg_review_score)
 *   + γ*(historical_impact)
 *   + δ*(consistency)
 */

export function calculateHistoricalReputation(
    evidence = {},
    customWeights = {}
) {
    const acceptedPRs = Math.max(
        0,
        Number(evidence.acceptedPRs) || 0
    );

    const avgReviewScore = Math.max(
        0,
        Math.min(
            1.0,
            Number(evidence.avgReviewScore) || 0
        )
    );

    const historicalImpact = Math.max(
        0,
        Number(evidence.historicalImpact) || 0
    );

    const consistency = Math.max(
        0,
        Math.min(
            1.0,
            Number(evidence.consistency) || 0
        )
    );

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

    const reputation = Math.max(
        0,
        Math.round(rawReputation * 100) / 100
    );

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
 * Fetches historical PRs for a contributor and computes
 * their reputation score.
 */

export async function getContributorReputation(
    username,
    token,
    customWeights = {}
) {
    const githubToken = token || process.env.GITHUB_PAT;

    const headers = {
        Accept: 'application/vnd.github.v3+json',

        ...(githubToken && {
            Authorization: `token ${githubToken}`
        })
    };

    try {
        const searchQuery =
            `author:${username} is:pr is:merged updated:>2024-01-01`;

        const searchRes = await fetch(
            `https://api.github.com/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=15`,
            { headers }
        );

        if (!searchRes.ok) {
            throw new Error(
                `GitHub search failed: ${searchRes.status}`
            );
        }

        const searchData = await searchRes.json();

        if (!searchData.items || searchData.items.length === 0) {
            return {
                reputation: 0,

                evidence: {
                    acceptedPRs: 0,
                    avgReviewScore: 0,
                    historicalImpact: 0,
                    consistency: 0,
                    lastCalculated: new Date()
                },

                weights: {
                    ...DEFAULT_REPUTATION_WEIGHTS,
                    ...customWeights
                }
            };
        }

        const prs = [];

        for (const item of searchData.items.slice(0, 10)) {
            const prUrl = item.pull_request?.url;

            if (!prUrl) continue;

            try {
                const prRes = await fetch(prUrl, { headers });

                if (!prRes.ok) continue;

                const prData = await prRes.json();

                prs.push({
                    prData,
                    metrics: extractPRMetrics(prData)
                });

            } catch {
                // Ignore individual PR fetch failures.
            }
        }

        const acceptedPRs = searchData.total_count || prs.length;

        const totalReview = prs.reduce(
            (sum, p) => sum + p.metrics.review,
            0
        );

        const avgReviewScore =
            prs.length > 0
                ? totalReview / prs.length
                : 0.5;

        const historicalImpact = prs.reduce(
            (sum, p) => sum + p.metrics.impact,
            0
        );

        const consistency = calculateConsistencyScore(
            prs.map(p => p.prData)
        );

        return calculateHistoricalReputation(
            {
                acceptedPRs,
                avgReviewScore,
                historicalImpact,
                consistency
            },
            customWeights
        );

    } catch (err) {
        console.error(
            `Failed to fetch contributor reputation for ${username}:`,
            err.message
        );

        return {
            reputation: 0,

            evidence: {
                acceptedPRs: 0,
                avgReviewScore: 0,
                historicalImpact: 0,
                consistency: 0,
                lastCalculated: new Date()
            },

            weights: {
                ...DEFAULT_REPUTATION_WEIGHTS,
                ...customWeights
            }
        };
    }
}

// ─────────────────────────────────────────────────────────────
// Algorithm Versioning
// ─────────────────────────────────────────────────────────────

export const ALGORITHM_VERSION = 'msts-v2.0.0';

export const ALGORITHM_NAME = 'MSTS Contribution Scoring';

/**
 * Returns the exact configuration used by the scoring algorithm.
 */

export function getAlgorithmConfiguration() {
    return {
        maxLines: MAX_LINES,

        reputationInfluenceLambda:
            REPUTATION_INFLUENCE_LAMBDA,

        reputationMax: 500,

        reputationMultiplierCap: 1.5,

        filters: {
            minQuality: 0.3,
            minReview: 0.3,
            spamImpact: 0.2,
            spamComplexity: 0.2
        },

        defaultWeights: {
            impact: 0.2,
            complexity: 0.2,
            quality: 0.2,
            review: 0.2,
            priority: 0.2
        },

        pointsScale: 20,

        scoreCap: 100
    };
}

/**
 * Ensures the current algorithm version exists in DB
 * and is the only active one.
 */

export async function ensureAlgorithmVersion() {
    const config = getAlgorithmConfiguration();

    await AlgorithmVersion.updateMany(
        {
            version: {
                $ne: ALGORITHM_VERSION
            }
        },
        {
            isActive: false
        }
    );

    return AlgorithmVersion.findOneAndUpdate(
        {
            version: ALGORITHM_VERSION
        },
        {
            $setOnInsert: {
                name: ALGORITHM_NAME,
                configuration: config
            },
            isActive: true
        },
        {
            upsert: true,
            new: true
        }
    );
}

// ─────────────────────────────────────────────────────────────
// PR Metrics
// ─────────────────────────────────────────────────────────────

/**
 * Derives normalized inputs for the algorithm from
 * a GitHub PR object.
 */

export function extractPRMetrics(pr) {

    // 1. Complexity (log-scaled lines).

    const linesChanged =
        (pr.additions || 0) + (pr.deletions || 0);

    const complexity = Math.min(
        1.0,
        Math.log(linesChanged + 1) /
        Math.log(MAX_LINES + 1)
    );

    // 2. Impact (proxied by changed files and commits).

    const impactRaw =
        (
            (pr.changed_files || 0) * 2 +
            (pr.commits || 0)
        ) / 50;

    const impact = Math.min(1.0, impactRaw);

    // 3. Quality (proxy: based on deletions/refactor ratio).

    let quality = 0.8;

    if (pr.deletions > pr.additions) {
        quality += 0.1;
    }

    if (pr.merged === true) {
        quality += 0.1;
    }

    quality = Math.min(1.0, quality);

    // 4. Review (proxy based on review comments).

    const reviewRaw =
        (pr.review_comments || 0) / 10;

    const review = Math.min(
        1.0,
        reviewRaw + 0.5
    );

    // 5. Priority (proxy based on labels).

    const hasPriorityLabel =
        pr.labels &&
        pr.labels.some(l =>
            [
                'priority',
                'high',
                'critical',
                'urgent'
            ].some(k =>
                l.name.toLowerCase().includes(k)
            )
        );

    const priority = hasPriorityLabel ? 1.0 : 0.4;

    return {
        impact,
        complexity,
        quality,
        review,
        priority
    };
}

// ─────────────────────────────────────────────────────────────
// MSTS v2 PR Scoring
// ─────────────────────────────────────────────────────────────

/**
 * Computes the Final Score for a PR.
 *
 * Integrates:
 * - MSTS Anti-Gaming
 * - Log-scaled Base Impact
 * - Reputation
 * - Velocity Penalties
 */

export function calculatePRScore(
    metrics,
    weights,
    context = {}
) {

    // Step 1: Anti-Gaming Filters.

    if (
        metrics.quality < 0.3 ||
        metrics.review < 0.3
    ) {
        return {
            score: 0,
            reason: 'Failed minimum quality threshold'
        };
    }

    if (
        metrics.impact < 0.2 &&
        metrics.complexity < 0.2
    ) {
        return {
            score: 0,
            reason: 'Failed spam / micro PR filter'
        };
    }

    // Step 2: Default weights.

    const w = weights || {
        impact: 0.2,
        complexity: 0.2,
        quality: 0.2,
        review: 0.2,
        priority: 0.2
    };

    // Step 3: Base Score.

    const baseScore =
        (w.impact * metrics.impact) +
        (w.complexity * metrics.complexity) +
        (w.quality * metrics.quality) +
        (w.review * metrics.review) +
        (w.priority * metrics.priority);

    // Step 4: Reputation Multiplier.

    const rawReputation = context.reputation || 0;

    const R_max = 500;

    const R_norm = Math.max(
        0,
        Math.log(rawReputation + 1) /
        Math.log(R_max + 1)
    );

    let repMult =
        1 + (
            REPUTATION_INFLUENCE_LAMBDA *
            Math.min(1.0, R_norm)
        );

    repMult = Math.min(1.5, repMult);

    // Step 5: Velocity Spam Penalty.

    const prTimestamps = context.timestamps || [];

    const spamPenalty =
        calculateSpamPenalty(prTimestamps);

    // Step 6: Final Score.

    const finalScore = Number(
        (
            baseScore *
            repMult *
            spamPenalty
        ).toFixed(4)
    );

    return {
        score: finalScore,

        spamPenalty,

        isSpamFlagged: spamPenalty < 0.8,

        details: {
            metrics,
            weights: w,
            baseScore,
            repMult,
            spamPenalty
        }
    };
}

/**
 * Synchronous helper for evaluating single PR payload
 * and timestamp history.
 */

export function evaluateSinglePRScore(
    prData,
    contributorHistory = []
) {
    const prTimestamps = contributorHistory.map(
        pr => pr.createdAt || pr.submittedAt
    );

    prTimestamps.push(
        prData.createdAt ||
        prData.created_at ||
        new Date()
    );

    const metrics = extractPRMetrics(prData);

    return calculatePRScore(
        metrics,
        null,
        {
            timestamps: prTimestamps
        }
    );
}

// ─────────────────────────────────────────────────────────────
// Contribution Score Computation
// ─────────────────────────────────────────────────────────────

/**
 * Computes a contributor's score using the persistent
 * contribution index.
 *
 * Integrates immutable contribution evidence.
 */

export async function computeContributionScore(
    username,
    token,
    options = {}
) {
    const githubToken = token || process.env.GITHUB_PAT;

    const headers = {
        Accept: 'application/vnd.github.v3+json',

        ...(githubToken && {
            Authorization: `token ${githubToken}`
        })
    };

    try {

        const user = await User.findOne({
            github: username
        });

        const userRepos = user?.repositories || [];

        // Collect repositories registered on the platform.

        const allOrgUsers = await User.find({
            'repositories.0': {
                $exists: true
            }
        });

        const registeredRepoMap = {};

        for (const orgUser of allOrgUsers) {

            for (const repo of orgUser.repositories || []) {

                if (repo.name) {
                    registeredRepoMap[
                        repo.name.toLowerCase()
                    ] = repo;
                }
            }
        }

        const registeredKeys = new Set(
            Object.keys(registeredRepoMap)
        );

        const authorKey = username.toLowerCase();

        // Incrementally sync author's merged PR history.

        const sync = await syncIndex({
            scopes: [
                {
                    key: `author:${authorKey}`,
                    qualifier: `author:${username}`
                }
            ],

            detailFilter: {
                authorKey
            },

            registeredKeys,
            headers
        });

        // Fetch indexed contribution events.

        const events = await ContributionEvent.find({
            authorKey,

            type: 'pr_merge',

            repoKey: {
                $in: [...registeredKeys]
            },

            detailsFetchedAt: {
                $ne: null
            }
        })
            .sort({
                mergedAt: -1
            })
            .lean();

        // Do not report misleading zero score
        // when indexing failed.

        if (events.length === 0 && sync.stale) {
            return {
                username,

                finalScore: 0,

                prs: [],

                error:
                    sync.errors?.[0] ||
                    (sync.rateLimited
                        ? 'GitHub API rate limit exceeded.'
                        : 'Contribution index could not be refreshed.'),

                algorithmVersion: ALGORITHM_VERSION,

                meta: {
                    prCount: 0,
                    source: 'index',
                    ...indexMeta(sync)
                }
            };
        }

        // Convert indexed events into MSTS v2 format.

        const validPRRecords = [];

        const prTimestamps = [];

        for (const event of events) {

            const prData = toPRShape(event);

            const repoFullName =
                prData.base?.repo?.full_name;

            if (!repoFullName) continue;

            const repoConfig =
                registeredRepoMap[
                    repoFullName.toLowerCase()
                ];

            // Only score repositories registered on platform.

            if (!repoConfig) continue;

            if (prData.created_at) {
                prTimestamps.push(prData.created_at);
            }

            validPRRecords.push({
                prData,
                attribution: attributionFromEvent(event),
                repoFullName,
                repoConfig,

                weights:
                    repoConfig.weights || null,

                repWeights:
                    options.reputationWeights ||
                    repoConfig.reputationWeights ||
                    user?.reputationWeights,

                metrics: extractPRMetrics(prData),

                timestampCount: prTimestamps.length
            });
        }

        // Handle empty contribution records.

        if (validPRRecords.length === 0) {
            return {
                username,

                finalScore: 0,

                reputation: 0,

                prs: [],

                algorithmVersion: ALGORITHM_VERSION,

                meta: {
                    computeTimeMs:
                        Date.now() -
                        (options.startTime || Date.now()),

                    prCount: 0,

                    source: 'index',

                    ...indexMeta(sync)
                }
            };
        }

        // ─────────────────────────────────────────────
        // Calculate Historical Contributor Reputation
        // ─────────────────────────────────────────────

        const acceptedPRs = validPRRecords.length;

        const totalReview = validPRRecords.reduce(
            (sum, record) =>
                sum + record.metrics.review,
            0
        );

        const avgReviewScore =
            acceptedPRs > 0
                ? totalReview / acceptedPRs
                : 0;

        const historicalImpact = validPRRecords.reduce(
            (sum, record) =>
                sum + record.metrics.impact,
            0
        );

        const consistency = calculateConsistencyScore(
            validPRRecords.map(
                record => record.prData
            )
        );

        const activeRepWeights =
            options.reputationWeights ||
            validPRRecords[0]?.repWeights ||
            user?.reputationWeights;

        const {
            reputation: contributorReputation,
            evidence: repEvidence
        } = calculateHistoricalReputation(
            {
                acceptedPRs,
                avgReviewScore,
                historicalImpact,
                consistency
            },
            activeRepWeights
        );

        // ─────────────────────────────────────────────
        // Algorithm Configuration
        // ─────────────────────────────────────────────

        const algorithmConfig =
            getAlgorithmConfiguration();

        let totalPoints = 0;

        const prDetails = [];

        // ─────────────────────────────────────────────
        // Score + Evidence + Persistence
        // ─────────────────────────────────────────────

        for (const record of validPRRecords) {
            // Step 1: Prepare scoring inputs.

            const scoringInputs = {
                metrics: record.metrics,
                reputation: contributorReputation,
                timestamps: prTimestamps.slice(0, record.timestampCount)
            };

            // Step 2: Resolve effective weights.

            const effectiveWeights =
                record.weights ||
                algorithmConfig.defaultWeights;

            // Step 3: Calculate PR score.

            const result = calculatePRScore(
                scoringInputs.metrics,
                effectiveWeights,
                {
                    reputation: scoringInputs.reputation,
                    timestamps: scoringInputs.timestamps
                }
            );

            // Step 4: Calculate contribution points.

            const prPoints = Math.round(
                result.score *
                algorithmConfig.pointsScale *
                10
            ) / 10;

            // Step 5: Configuration snapshot.

            const configurationSnapshot = {
                algorithm: algorithmConfig,

                weights:
                    result.details?.weights ||
                    effectiveWeights,

                repoConfig: {
                    name: record.repoConfig.name,
                    weights: record.repoConfig.weights,
                    bountyPool: record.repoConfig.bountyPool
                }
            };

            try {

                // Step 6: Create immutable evidence first.

                const evidence = await createContributionEvidence({
                    algorithmVersion: ALGORITHM_VERSION,
                    scoringInputs,
                    configurationSnapshot,
                    score: prPoints
                });

                // Validate evidence response.

                if (
                    !evidence ||
                    !evidence.reference ||
                    !evidence.evidenceHash ||
                    !evidence.schemaVersion
                ) {
                    throw new Error(
                        `Invalid evidence generated for PR #${record.prData.number}`
                    );
                }

                // Step 7: Persist score and evidence together.

                await ContributionScore.findOneAndUpdate(
                    {
                        username,

                        repository: record.repoFullName,

                        prNumber: record.prData.number
                    },

                    {
                        $set: {
                            score: prPoints,

                            algorithmVersion: ALGORITHM_VERSION,

                            configurationSnapshot,

                            evidenceReference: evidence.reference,

                            evidenceHash: evidence.evidenceHash,

                            evidenceSchemaVersion: evidence.schemaVersion,

                            calculatedAt: new Date()
                        }
                    },

                    {
                        upsert: true,
                        new: true,
                        runValidators: true
                    }
                );

            } catch (dbErr) {

                console.error(
                    `Failed to persist score/evidence for PR #${record.prData.number}:`,
                    dbErr
                );

                // Do not count PR if evidence creation
                // or database persistence fails.

                continue;
            }

            // Step 8: Add points only after successful persistence.

            totalPoints += prPoints;

            // Step 9: Add successfully persisted PR to response.

            prDetails.push({
                id: record.prData.number,

                title: record.prData.title,

                repo: record.repoFullName,

                score: prPoints,

                algorithmVersion: ALGORITHM_VERSION,

                status: 'merged',

                date:
                    record.prData.merged_at?.split('T')[0] ||
                    'N/A',

                link: record.prData.html_url,

                ...record.attribution
            });
        }

        // ─────────────────────────────────────────────
        // Persist Historical Reputation
        // ─────────────────────────────────────────────

        if (user) {

            user.reputation = contributorReputation;

            user.reputationEvidence = repEvidence;

            await user.save().catch(err => {
                console.warn(
                    'Could not persist user reputation:',
                    err.message
                );
            });
        }

        // ─────────────────────────────────────────────
        // Final Contribution Score
        // ─────────────────────────────────────────────

        const finalScore = Math.min(
            100,
            Math.round(totalPoints * 10) / 10
        );

        return {
            username,

            finalScore,

            reputation: contributorReputation,

            reputationEvidence: repEvidence,

            algorithmVersion: ALGORITHM_VERSION,

            prs: prDetails,

            meta: {
                computeTimeMs:
                    Date.now() -
                    (options.startTime || Date.now()),

                prCount: prDetails.length,

                source: 'index',

                ...indexMeta(sync)
            }
        };

    } catch (error) {

        console.error(
            'Error computing score:',
            error
        );

        return {
            username,

            finalScore: 0,

            prs: [],

            error: error.message
        };
    }
}

// ─────────────────────────────────────────────────────────────
// Organization Contributors
// ─────────────────────────────────────────────────────────────

/**
 * Computes contributors for an organization using
 * indexed contribution events.
 */

export async function computeOrgContributors(
    orgId,
    token
) {
    const githubToken = token || process.env.GITHUB_PAT;

    const headers = {
        Accept: 'application/vnd.github.v3+json',

        ...(githubToken && {
            Authorization: `token ${githubToken}`
        })
    };

    try {

        const org = await User.findById(orgId);

        if (!org || org.role !== 'organization') {
            return {
                contributors: [],
                recentEvents: []
            };
        }

        const repositories = org.repositories || [];

        const repoNames = repositories
            .map(repo => repo.name)
            .filter(Boolean);

        if (repoNames.length === 0) {
            return {
                contributors: [],
                recentEvents: []
            };
        }

        const repoKeys = new Set(
            repoNames.map(
                name => name.toLowerCase()
            )
        );

        // Synchronize tracked repositories into contribution index.

        const sync = await syncIndex({
            scopes: repoNames.map(name => ({
                key: `repo:${name.toLowerCase()}`,
                qualifier: `repo:${name}`
            })),

            detailFilter: {},

            registeredKeys: repoKeys,

            headers
        });

        // Read PR details from persistent index.

        const events = await ContributionEvent.find({
            type: 'pr_merge',

            repoKey: {
                $in: [...repoKeys]
            },

            detailsFetchedAt: {
                $ne: null
            }
        })
            .sort({
                mergedAt: -1
            })
            .lean();

        const meta = {
            source: 'index',

            eventCount: events.length,

            ...indexMeta(sync)
        };

        if (events.length === 0) {
            return {
                contributors: [],
                recentEvents: [],
                meta
            };
        }

        // Group indexed PRs by contributor.
        const contributorPRMap = {};
        for (const event of events) {

            const prData = toPRShape(event);

            const username = event.author;
            if (!username) continue;

            const repoFullName =
                prData.base?.repo?.full_name ||
                event.repoFullName ||
                event.repo;

            if (!repoFullName) continue;

            const repoConfig = repositories.find(
                repo =>
                    repo.name?.toLowerCase() ===
                    repoFullName.toLowerCase()
            );

            // Ignore events for repositories no longer tracked by the organization.
            if (!repoConfig) continue;
            const metrics = extractPRMetrics(prData);

            if (!contributorPRMap[username]) {

                contributorPRMap[username] = {
                    user: {
                        login: username,
                        avatar_url: event.authorAvatar
                    },

                    prs: []
                };
            }

            contributorPRMap[username].prs.push({
                prData,
                attribution: attributionFromEvent(event),
                repoFullName,
                repoConfig,
                metrics,
                event
            });
        }

        const contributorsMap = {};

        const recentEvents = [];

        // Calculate each contributor's reputation and PR scores.

        for (const [
            username,
            contributorData
        ] of Object.entries(contributorPRMap)) {

            const prs = contributorData.prs;

            const existingUser = await User.findOne({
                github: username
            });

            let contributorReputation =
                existingUser?.reputation;

            if (
                contributorReputation === undefined ||
                contributorReputation === null ||
                contributorReputation === 0
            ) {

                const acceptedPRs = prs.length;

                const totalReview = prs.reduce(
                    (sum, pr) =>
                        sum + pr.metrics.review,
                    0
                );

                const avgReviewScore =
                    acceptedPRs > 0
                        ? totalReview / acceptedPRs
                        : 0.5;

                const historicalImpact = prs.reduce(
                    (sum, pr) =>
                        sum + pr.metrics.impact,
                    0
                );

                const consistency = calculateConsistencyScore(
                    prs.map(pr => pr.prData)
                );

                const repWeights =
                    prs[0]?.repoConfig?.reputationWeights;

                const repResult = calculateHistoricalReputation(
                    {
                        acceptedPRs,
                        avgReviewScore,
                        historicalImpact,
                        consistency
                    },
                    repWeights
                );

                contributorReputation =
                    repResult.reputation;
            }

            contributorsMap[username] = {
                username,

                totalScore: 0,

                prCount: 0,

                avatar:
                    contributorData.user?.avatar_url,

                reputation: contributorReputation
            };

            for (const prItem of prs) {

                const result = calculatePRScore(
                    prItem.metrics,

                    prItem.repoConfig?.weights,

                    {
                        reputation: contributorReputation
                    }
                );

                const prScore = result.score * 20;

                contributorsMap[username].totalScore += prScore;

                contributorsMap[username].prCount += 1;

                recentEvents.push({
                    username,

                    type: 'PR_MERGE',

                    repo: prItem.repoFullName,

                    score: Math.round(prScore * 10) / 10,
                    timestamp:
                        prItem.prData.merged_at ||
                        prItem.event?.mergedAt ||
                        null,

                    algorithmVersion: ALGORITHM_VERSION,

                    ...prItem.attribution
                });
            }
        }

        const contributors = Object.values(
            contributorsMap
        ).map(contributor => ({
            ...contributor,

            totalScore: Math.min(
                100,
                Math.round(contributor.totalScore * 10) / 10
            )
        }));

        return {
            contributors: contributors.sort(
                (a, b) => b.totalScore - a.totalScore
            ),

            recentEvents: recentEvents.slice(0, 10),

            meta
        };

    } catch (error) {

        console.error(
            'Org contributors error:',
            error
        );

        return {
            contributors: [],
            recentEvents: [],
            error: error.message
        };
    }
}
