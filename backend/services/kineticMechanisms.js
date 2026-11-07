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
 * Verifies a GitHub Actions run to ensure the code actually executes 
 * in a real CI environment, proving it's not a spam repository.
 * 
 * @param {string} ownerRepo - Format: "username/repo"
 * @param {string|number} runId - The GitHub Actions run ID
 * @param {string} token - GitHub PAT
 * @returns {Promise<boolean>} True if the CI run was successful
 */
export async function verifyProofOfBuild(ownerRepo, runId, token) {
    if (!token) throw new Error("GitHub token required for CI verification");

    try {
        const response = await fetch(`https://api.github.com/repos/${ownerRepo}/actions/runs/${runId}`, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) return false;

        const runData = await response.json();

        // Proof-of-Build requires the code to actually compile/pass tests
        return runData.status === 'completed' && runData.conclusion === 'success';
    } catch (error) {
        return false;
    }
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