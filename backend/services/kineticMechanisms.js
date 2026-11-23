/**
 * Kinetic Core Mechanisms 
 * Implements: Proof-of-Build (CI/CD Verification), Quadratic Funding, & Spam Penalty
 */

import { computeContributionScore } from './contributionService.js';

// ─────────────────────────────────────────────────────────────
// Mechanism 1: Proof-of-Build (CI/CD Verification)
// Prevents Sybil attacks by requiring cryptographic proof of execution
// ─────────────────────────────────────────────────────────────

/**
 * Finds the expected commit a CI run ran on. Expected SHAs may be abbreviated
 * (7-40 hex chars) and match as a prefix of the run's full head SHA.
 *
 * @param {string} runHeadSha - head_sha of the workflow run
 * @param {{ sha: string, kind: string }[]} expectedShas
 * @returns {{ sha: string, kind: string } | null}
 */
export function matchRunCommit(runHeadSha, expectedShas = []) {
    if (!runHeadSha) return null;
    const head = runHeadSha.toLowerCase();
    for (const expected of expectedShas) {
        const sha = expected?.sha?.toLowerCase();
        if (sha && sha.length >= 7 && head.startsWith(sha)) {
            return { sha: runHeadSha, kind: expected.kind };
        }
    }
    return null;
}

/**
 * Verifies a GitHub Actions run and returns it as CI evidence for a commit.
 *
 * A run counts as verification only if it completed successfully and, when
 * expected commits are given, it ran on one of them: the PR's head SHA (PR CI)
 * or its merge commit (post-merge CI). A run from any other commit does not
 * verify the evaluated commit. Without expected commits only the run's outcome
 * is checked and matchedCommit is null, so callers can tell the run was not
 * tied to a commit.
 *
 * @param {string} ownerRepo - Format: "owner/repo"
 * @param {string|number} runId - The GitHub Actions run ID
 * @param {string} token - GitHub PAT
 * @param {{ expectedShas?: { sha: string, kind: string }[] }} [options]
 * @returns {Promise<{ verified: boolean, runId: number, headSha: string|null,
 *   status: string|null, conclusion: string|null,
 *   matchedCommit: { sha: string, kind: string }|null, reason: string|null,
 *   confirmed: boolean }>} confirmed is true when GitHub returned the run
 */
export async function verifyProofOfBuild(ownerRepo, runId, token, { expectedShas = [] } = {}) {
    if (!token) throw new Error("GitHub token required for CI verification");

    const evidence = {
        verified: false,
        runId: Number(runId),
        headSha: null,
        status: null,
        conclusion: null,
        matchedCommit: null,
        reason: null,
        confirmed: false
    };

    let runData;
    try {
        const response = await fetch(`https://api.github.com/repos/${ownerRepo}/actions/runs/${runId}`, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            evidence.reason = response.status === 404
                ? `CI run ${runId} not found in ${ownerRepo}`
                : `GitHub returned ${response.status} for CI run ${runId}`;
            return evidence;
        }
        runData = await response.json();
    } catch (error) {
        evidence.reason = `Could not reach GitHub: ${error.message}`;
        return evidence;
    }

    evidence.confirmed = true;
    evidence.headSha = runData.head_sha || null;
    evidence.status = runData.status || null;
    evidence.conclusion = runData.conclusion || null;

    if (expectedShas.length > 0) {
        evidence.matchedCommit = matchRunCommit(evidence.headSha, expectedShas);
        if (!evidence.matchedCommit) {
            const expected = expectedShas.map(e => `${e.kind} ${e.sha}`).join(', ');
            evidence.reason = `CI run ${runId} ran on commit ${evidence.headSha || 'unknown'}, not the evaluated commit (${expected})`;
            return evidence;
        }
    }

    // Proof-of-Build requires the code to actually compile/pass tests
    if (evidence.status !== 'completed') {
        evidence.reason = `CI run ${runId} has not completed (status: ${evidence.status})`;
    } else if (evidence.conclusion !== 'success') {
        evidence.reason = `CI run ${runId} did not succeed (conclusion: ${evidence.conclusion})`;
    } else {
        evidence.verified = true;
    }
    return evidence;
}

// ─────────────────────────────────────────────────────────────
// Mechanism 2: Anti-Gaming Spam & Velocity Penalty
// ─────────────────────────────────────────────────────────────

/**
 * Calculates submission penalty considering both total count (k) and PR velocity.
 * @param {Array<Date|string>} prTimestamps - Historical PR submission timestamps
 * @returns {number} Penalty multiplier (0.0 - 1.0)
 */
export function calculateSpamPenalty(prTimestamps = []) {
    const k = prTimestamps.length;
    if (k <= 1) return 1.0;

    // Base diminishing returns formula: 1 / (1 + 0.1 * (k - 1))
    let penalty = 1 / (1 + 0.1 * (k - 1));

    // Velocity check: calculate time difference between recent submissions
    const lastPRTime = new Date(prTimestamps[k - 1]).getTime();
    const prevPRTime = new Date(prTimestamps[k - 2]).getTime();
    const diffMinutes = (lastPRTime - prevPRTime) / (1000 * 60);

    // Apply 20% extra penalty if PRs are submitted within 10 minutes of each other
    if (diffMinutes < 10) {
        penalty *= 0.8;
    }

    return Number(penalty.toFixed(4));
}

// ─────────────────────────────────────────────────────────────
// Mechanism 3: Dependency-Weighted Quadratic Funding (DWQF)
// Distributes funds based on the number of contributors, but 
// weighs their votes using their MSTS score (impact) instead of money
// ─────────────────────────────────────────────────────────────

/**
 * Calculates Quadratic Funding distribution for a set of projects.
 * Standard QF: Funding = (Sum of square roots of contributions)^2
 * Kinetic QF: Contribution = User MSTS Score (Impact) instead of Capital
 * 
 * @param {number} totalPool - The total funding pool (e.g., $10,000)
 * @param {Array} projects - Array of projects with their voter details
 * @returns {Array} Projects mapped with their allocated funds
 */
export function calculateQuadraticFunding(totalPool, projects) {
    let totalQuadraticMatch = 0;

    // 1. Calculate the Quadratic Match for each project
    const projectCalculations = projects.map(project => {
        // Sum of the square roots of each voter's MSTS score
        const sumOfSquareRoots = project.voters.reduce((sum, voter) => {
            // Treat MSTS score as the "contribution amount"
            return sum + Math.sqrt(voter.mstsScore || 0);
        }, 0);

        // The matching weight is the square of the sum of square roots
        const quadraticMatchWeight = Math.pow(sumOfSquareRoots, 2);
        totalQuadraticMatch += quadraticMatchWeight;

        return { ...project, quadraticMatchWeight };
    });

    // 2. Distribute the funding pool proportionally
    if (totalQuadraticMatch === 0) return projectCalculations;

    return projectCalculations.map(project => {
        const percentageOfPool = project.quadraticMatchWeight / totalQuadraticMatch;
        const allocatedFunds = totalPool * percentageOfPool;

        return {
            projectName: project.name,
            totalVoters: project.voters.length,
            quadraticWeight: Math.round(project.quadraticMatchWeight * 100) / 100,
            poolPercentage: Math.round(percentageOfPool * 10000) / 100 + '%',
            allocatedFunds: Math.round(allocatedFunds * 100) / 100 // Final payout
        };
    });
}