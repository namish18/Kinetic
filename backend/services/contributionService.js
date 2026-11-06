/**
 * Contribution Scoring Service — based on contribution_algo.md
 * 
 * This service fetches real data from GitHub and computes a score 
 * following the "Final Algorithm" specifications.
 */

import User from '../models/User.js';
import {
    fetchAllSearchResults,
    fetchPRDetails,
    repoFullNameFromUrl
} from './githubSearch.js';

const MAX_LINES = 10000;
const REPUTATION_INFLUENCE_LAMBDA = 0.5;

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
 * Steps 1-6: Computes the Final Score for a PR based on contribution_algo.md
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

    // Step 4: Reputation System
    const rawReputation = context.reputation || 0;
    const R_max = 500; 
    const R_norm = Math.max(0, Math.log(rawReputation + 1) / Math.log(R_max + 1));
    
    let repMult = 1 + (REPUTATION_INFLUENCE_LAMBDA * Math.min(1.0, R_norm));
    repMult = Math.min(1.5, repMult); 

    // Step 6: Final Score
    const finalScore = baseScore * repMult;

    return {
        score: finalScore,
        details: { metrics, weights: w, baseScore, repMult }
    };
}

/**
 * Main function: Fetches real PRs and computes the overall Contribution Score
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

        // Build a map of ALL repos registered on the platform (across all org users)
        // key: repo full name (owner/repo), value: weights config from the registering org
        const allOrgUsers = await User.find({ 'repositories.0': { $exists: true } });
        const registeredRepoMap = {};
        for (const orgUser of allOrgUsers) {
            for (const repo of orgUser.repositories) {
                // org-defined weights take precedence; contributor's own config is a fallback
                registeredRepoMap[repo.name] = repo;
            }
        }

        // Fetch all merged PRs using the search API (paginated, capped at 1000 by GitHub)
        const searchQuery = `author:${username} is:pr is:merged updated:>2024-01-01`;
        const search = await fetchAllSearchResults(searchQuery, headers);
        const searchMeta = {
            searchTotal: search.totalCount,
            searchFetched: search.items.length,
            truncated: search.truncated,
            rateLimited: search.rateLimited,
            ...(search.resetAt && { rateLimitResetAt: search.resetAt })
        };

        if (search.items.length === 0) {
            return {
                username, finalScore: 0, prs: [],
                ...(search.error && { error: search.error }),
                meta: { prCount: 0, ...searchMeta, partial: Boolean(search.error) }
            };
        }

        // Skip the detail request for PRs in repos not registered on the platform.
        // Case-insensitive so it never drops a PR the exact check below would count.
        const registeredLower = new Set(Object.keys(registeredRepoMap).map(name => name.toLowerCase()));
        const candidates = search.items.filter(item =>
            item.pull_request?.url && registeredLower.has(repoFullNameFromUrl(item.repository_url))
        );
        const details = await fetchPRDetails(candidates.map(item => item.pull_request.url), headers);

        let totalPoints = 0;
        const prDetails = [];

        for (const prData of details.prs) {
            if (!prData) continue;

            const repoFullName = prData.base?.repo?.full_name;

            // ── FILTER: only track PRs for repos registered on the platform ──
            if (!repoFullName || !registeredRepoMap[repoFullName]) continue;

            // Use org-defined weights for this repo (fallback to contributor's own config)
            const repoConfig = registeredRepoMap[repoFullName] || userRepos.find(r => r.name === repoFullName);
            const weights = repoConfig?.weights || null;

            const metrics = extractPRMetrics(prData);
            const result = calculatePRScore(metrics, weights, { reputation: userRepos.length * 10 });

            // Max points per PR is roughly (1 * 1.5 * 1.2) = 1.8. 
            // We scale this so a high impact PR is ~25-30 pts.
            const prPoints = Math.round(result.score * 20 * 10) / 10;
            totalPoints += prPoints;

            prDetails.push({
                id: prData.number,
                title: prData.title,
                repo: repoFullName,
                score: prPoints,
                status: 'merged',
                date: prData.merged_at?.split('T')[0] || 'N/A',
                link: prData.html_url
            });
        }

        // Hard cap at 100
        const finalScore = Math.min(100, Math.round(totalPoints * 10) / 10);

        return {
            username,
            finalScore,
            prs: prDetails,
            meta: {
                computeTimeMs: Date.now() - (options.startTime || Date.now()),
                prCount: prDetails.length,
                ...searchMeta,
                rateLimited: search.rateLimited || details.rateLimited,
                ...((search.resetAt || details.resetAt) && { rateLimitResetAt: search.resetAt || details.resetAt }),
                partial: Boolean(search.error) || search.incomplete || details.rateLimited || details.errors > 0,
                ...(search.error && { searchError: search.error }),
                detailRequests: details.requests,
                detailErrors: details.errors,
                skippedUnregistered: search.items.length - candidates.length
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

        // Search for merged PRs across all organization repositories (paginated)
        const repoQuery = repoNames.map(name => `repo:${name}`).join(' ');
        const searchQuery = `${repoQuery} is:pr is:merged updated:>2024-01-01`;
        const search = await fetchAllSearchResults(searchQuery, headers);
        const searchMeta = {
            searchTotal: search.totalCount,
            searchFetched: search.items.length,
            truncated: search.truncated,
            rateLimited: search.rateLimited,
            partial: Boolean(search.error) || search.incomplete,
            ...(search.resetAt && { rateLimitResetAt: search.resetAt }),
            ...(search.error && { searchError: search.error })
        };

        if (search.items.length === 0) return { contributors: [], recentEvents: [], meta: searchMeta };

        const prItems = search.items.filter(item => item.pull_request?.url);
        const details = await fetchPRDetails(prItems.map(item => item.pull_request.url), headers);

        const contributorsMap = {};
        const recentEvents = [];

        for (let i = 0; i < prItems.length; i++) {
            const item = prItems[i];
            const prData = details.prs[i];
            if (!prData?.base?.repo) continue;

            const username = item.user.login;
            const repoFullName = prData.base.repo.full_name;
            const repoConfig = org.repositories.find(r => r.name === repoFullName);
            
            const metrics = extractPRMetrics(prData);
            const result = calculatePRScore(metrics, repoConfig?.weights, { reputation: 100 });
            
            const prScore = result.score * 20;

            if (!contributorsMap[username]) {
                contributorsMap[username] = {
                    username,
                    totalScore: 0,
                    prCount: 0,
                    avatar: item.user.avatar_url
                };
            }

            contributorsMap[username].totalScore += prScore;
            contributorsMap[username].prCount += 1;

            recentEvents.push({
                username,
                type: 'PR_MERGE',
                repo: repoFullName,
                score: Math.round(prScore * 10) / 10,
                timestamp: prData.merged_at,
                cid: `bafybei${Math.random().toString(16).substring(2, 10)}`
            });
        }

        const stats = Object.values(contributorsMap).map(c => ({
            ...c,
            totalScore: Math.min(100, Math.round(c.totalScore * 10) / 10)
        }));

        return {
            contributors: stats.sort((a, b) => b.totalScore - a.totalScore),
            recentEvents: recentEvents.slice(0, 10),
            meta: {
                ...searchMeta,
                rateLimited: searchMeta.rateLimited || details.rateLimited,
                ...(details.resetAt && { rateLimitResetAt: details.resetAt }),
                partial: searchMeta.partial || details.rateLimited || details.errors > 0,
                detailRequests: details.requests,
                detailErrors: details.errors
            }
        };

    } catch (error) {
        console.error("Org contributors error:", error);
        return { contributors: [], recentEvents: [] };
    }
}
