
import mongoose from 'mongoose';
import FundingEpoch from '../models/FundingEpoch.js';
import FundingEpochScore from '../models/FundingEpochScore.js';
import ContributionEvent from '../models/ContributionEvent.js';
import User from '../models/User.js';

import {
    calculatePRScore,
    extractPRMetrics,
    getAlgorithmConfiguration,
    ALGORITHM_VERSION
} from './contributionService.js';

function validateDates(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error('Valid startDate and endDate are required');
    }

    if (start >= end) {
        throw new Error('Epoch endDate must be after startDate');
    }

    return { start, end };
}

function normalizeRepository(repo) {
    return String(repo).trim().toLowerCase();
}

function validateWeights(weights = {}) {
    const keys = ['impact', 'complexity', 'quality', 'review', 'priority'];
    const values = keys.map(key => Number(weights[key]));

    if (values.some(value => !Number.isFinite(value) || value < 0 || value > 1)) {
        throw new Error('Scoring weights must be numbers between 0 and 1');
    }

    const total = values.reduce((sum, value) => sum + value, 0);

    if (Math.abs(total - 1) > 0.001) {
        throw new Error('Scoring weights must add up to 1');
    }
}

async function getOwnedEpoch(epochId, organizationId) {
    if (!mongoose.isValidObjectId(epochId)) {
        throw new Error('Invalid funding epoch ID');
    }

    const epoch = await FundingEpoch.findOne({
        _id: epochId,
        organization: organizationId
    });

    if (!epoch) {
        throw new Error('Funding epoch not found');
    }

    return epoch;
}

export async function createFundingEpoch(organizationId, payload) {
    const organization = await User.findById(organizationId);

    if (!organization || organization.role !== 'organization') {
        throw new Error('Only organization accounts can create funding epochs');
    }

    const { name, description = '', startDate, endDate } = payload;

    if (!name || !String(name).trim()) {
        throw new Error('Epoch name is required');
    }

    const dates = validateDates(startDate, endDate);
    const eligibility = payload.eligibility || {};
    const configuration = payload.configuration || {};

    if (
        eligibility.minScore !== undefined &&
        (!Number.isFinite(Number(eligibility.minScore)) || Number(eligibility.minScore) < 0)
    ) {
        throw new Error('minScore must be a non-negative number');
    }

    if (
        eligibility.minMergedPRs !== undefined &&
        (!Number.isInteger(Number(eligibility.minMergedPRs)) || Number(eligibility.minMergedPRs) < 0)
    ) {
        throw new Error('minMergedPRs must be a non-negative integer');
    }

    const weights = {
        impact: 0.2,
        complexity: 0.2,
        quality: 0.2,
        review: 0.2,
        priority: 0.2,
        ...(configuration.weights || {})
    };

    validateWeights(weights);

    const allowedRepositories = eligibility.allowedRepositories || [];

    if (!Array.isArray(allowedRepositories)) {
        throw new Error('allowedRepositories must be an array');
    }

    const organizationRepositories = new Set(
        (organization.repositories || []).map(repo => normalizeRepository(repo.name))
    );

    if (allowedRepositories.some(repo => !organizationRepositories.has(normalizeRepository(repo)))) {
        throw new Error('All allowed repositories must belong to the organization');
    }

    return FundingEpoch.create({
        organization: organizationId,
        createdBy: organizationId,
        name: String(name).trim(),
        description,
        startDate: dates.start,
        endDate: dates.end,
        eligibility: {
            minScore: eligibility.minScore ?? 0,
            minMergedPRs: eligibility.minMergedPRs ?? 1,
            allowedRepositories: allowedRepositories.map(normalizeRepository),
            requiredLabels: eligibility.requiredLabels || []
        },
        configuration: {
            weights,
            algorithmVersion: ALGORITHM_VERSION
        }
    });
}

export async function getFundingEpochs(organizationId) {
    return FundingEpoch.find({ organization: organizationId })
        .sort({ createdAt: -1 });
}

export async function getFundingEpoch(epochId, organizationId) {
    return getOwnedEpoch(epochId, organizationId);
}

export async function updateFundingEpoch(epochId, organizationId, updates) {
    const epoch = await getOwnedEpoch(epochId, organizationId);

    if (epoch.status !== 'DRAFT') {
        throw new Error('Only draft funding epochs can be modified');
    }

    const allowedFields = ['name', 'description', 'startDate', 'endDate'];

    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            epoch[field] = updates[field];
        }
    }

    if (updates.startDate !== undefined || updates.endDate !== undefined) {
        const dates = validateDates(epoch.startDate, epoch.endDate);
        epoch.startDate = dates.start;
        epoch.endDate = dates.end;
    }

    if (updates.eligibility !== undefined) {
        const eligibility = updates.eligibility;

        if (
            eligibility.minScore !== undefined &&
            (!Number.isFinite(Number(eligibility.minScore)) || Number(eligibility.minScore) < 0)
        ) {
            throw new Error('minScore must be a non-negative number');
        }

        if (
            eligibility.minMergedPRs !== undefined &&
            (!Number.isInteger(Number(eligibility.minMergedPRs)) || Number(eligibility.minMergedPRs) < 0)
        ) {
            throw new Error('minMergedPRs must be a non-negative integer');
        }

        if (eligibility.allowedRepositories !== undefined) {
            if (!Array.isArray(eligibility.allowedRepositories)) {
                throw new Error('allowedRepositories must be an array');
            }

            const organization = await User.findById(organizationId);
            const organizationRepositories = new Set(
                (organization?.repositories || []).map(repo => normalizeRepository(repo.name))
            );

            if (eligibility.allowedRepositories.some(
                repo => !organizationRepositories.has(normalizeRepository(repo))
            )) {
                throw new Error('All allowed repositories must belong to the organization');
            }
        }

        epoch.eligibility = {
            ...epoch.eligibility.toObject(),
            ...eligibility
        };
    }

    if (updates.configuration !== undefined) {
        const weights = {
            ...epoch.configuration.toObject().weights,
            ...(updates.configuration.weights || {})
        };

        validateWeights(weights);

        epoch.configuration = {
            ...epoch.configuration.toObject(),
            ...updates.configuration,
            weights,
            algorithmVersion: ALGORITHM_VERSION
        };
    }

    await epoch.save();
    return epoch;
}

export async function activateFundingEpoch(epochId, organizationId) {
    const epoch = await getOwnedEpoch(epochId, organizationId);

    if (epoch.status !== 'DRAFT') {
        throw new Error('Only draft funding epochs can be activated');
    }

    const configurationSnapshot = {
        configuration: epoch.configuration.toObject(),
        eligibility: epoch.eligibility.toObject(),
        algorithm: getAlgorithmConfiguration(),
        algorithmVersion: ALGORITHM_VERSION
    };

    epoch.configurationSnapshot = configurationSnapshot;
    epoch.status = 'ACTIVE';
    epoch.activatedAt = new Date();

    await epoch.save();

    return epoch;
}

function buildScoringPayload(event) {
    const stats = event.stats || {};

    return {
        additions: stats.additions || 0,
        deletions: stats.deletions || 0,
        changed_files: stats.changedFiles || 0,
        commits: stats.commits || 0,
        comments: stats.comments || 0,
        review_comments: stats.reviewComments || 0,
        merged: stats.merged === true,
        labels: (stats.labels || []).map(label => ({
            name: typeof label === 'string' ? label : label.name
        }))
    };
}

export async function finalizeFundingEpoch(epochId, organizationId) {
    const epoch = await getOwnedEpoch(epochId, organizationId);

    // Repeated finalization returns the existing final result.
    if (epoch.status === 'FINALIZED') {
        return {
            epoch,
            scores: await FundingEpochScore.find({ epoch: epoch._id }),
            alreadyFinalized: true
        };
    }

    if (epoch.status !== 'ACTIVE') {
        throw new Error('Only active funding epochs can be finalized');
    }

    if (new Date(epoch.endDate) > new Date()) {
        throw new Error('A funding epoch cannot be finalized before its end date');
    }

    const organization = await User.findById(organizationId);

    if (!organization) {
        throw new Error('Organization account not found');
    }

    const organizationRepositories = (organization.repositories || [])
        .map(repo => normalizeRepository(repo.name));

    const configuredRepositories = epoch.eligibility.allowedRepositories.length
        ? epoch.eligibility.allowedRepositories.map(normalizeRepository)
        : organizationRepositories;

    const repositoryKeys = configuredRepositories.map(repo => repo);

    const events = await ContributionEvent.find({
        repoKey: { $in: repositoryKeys },
        mergedAt: {
            $gte: epoch.startDate,
            $lte: epoch.endDate
        },
        'stats.merged': true
    }).sort({ mergedAt: 1 });

    const contributorCounts = new Map();

    for (const event of events) {
        const key = event.authorKey || event.author.toLowerCase();
        contributorCounts.set(key, (contributorCounts.get(key) || 0) + 1);
    }

    const timestampsByContributor = new Map();

    for (const event of events) {
        const key = event.authorKey || event.author.toLowerCase();

        if (!timestampsByContributor.has(key)) {
            timestampsByContributor.set(key, []);
        }

        timestampsByContributor.get(key).push(event.mergedAt);
    }

    const userCache = new Map();
    const operations = [];
    const contributorTotals = new Map();

    const weights = epoch.configurationSnapshot.configuration.weights;
    const eligibility = epoch.configurationSnapshot.eligibility;

    for (const event of events) {
        const username = event.author;
        const contributorKey = event.authorKey || username.toLowerCase();
        const payload = buildScoringPayload(event);

        let contributor = userCache.get(contributorKey);

        if (contributor === undefined) {
            contributor = await User.findOne({ github: username });
            userCache.set(contributorKey, contributor);
        }

        const metrics = extractPRMetrics(payload);

        const result = calculatePRScore(metrics, weights, {
            reputation: contributor?.reputation || 0,
            timestamps: timestampsByContributor.get(contributorKey) || []
        });

        const labels = payload.labels.map(label => label.name.toLowerCase());

        const missingLabels = (eligibility.requiredLabels || []).filter(
            label => !labels.includes(String(label).toLowerCase())
        );

        const enoughContributions =
            (contributorCounts.get(contributorKey) || 0) >= eligibility.minMergedPRs;

        const enoughScore = result.score >= eligibility.minScore;
        const labelsMatch = missingLabels.length === 0;

        const eligible = enoughContributions && enoughScore && labelsMatch && !result.reason;

        let reason = null;

if (!enoughContributions) {
    reason = 'Contributor does not meet the minimum merged PR requirement';
} else if (!labelsMatch) {
    reason = `Missing required labels: ${missingLabels.join(', ')}`;
} else if (result.reason) {
    reason = result.reason;
} else if (!enoughScore) {
    reason = 'Contribution score is below the minimum required score';
}

        operations.push({
            updateOne: {
                filter: {
                    epoch: epoch._id,
                    repository: event.repo,
                    prNumber: event.prNumber
                },
                update: {
                    $set: {
                        epoch: epoch._id,
                        contributionEvent: event._id,
                        username,
                        repository: event.repo,
                        prNumber: event.prNumber,
                        score: result.score,
                        eligible,
                        eligibilityReason: reason,
                        algorithmVersion: ALGORITHM_VERSION,
                        configurationSnapshot: epoch.configurationSnapshot,
                        scoringDetails: result
                    }
                },
                upsert: true
            }
        });

        if (!contributorTotals.has(contributorKey)) {
            contributorTotals.set(contributorKey, {
                username,
                contributionCount: 0,
                eligibleCount: 0,
                totalScore: 0
            });
        }

        const total = contributorTotals.get(contributorKey);
        total.contributionCount += 1;

        if (eligible) {
            total.eligibleCount += 1;
            total.totalScore += result.score;
        }
    }

    if (operations.length) {
        await FundingEpochScore.bulkWrite(operations);
    }

    const totals = Array.from(contributorTotals.values()).map(total => ({
        ...total,
        totalScore: Number(total.totalScore.toFixed(4))
    }));

    const finalizationSnapshot = {
        finalizedAt: new Date(),
        totalContributions: events.length,
        eligibleContributions: totals.reduce(
            (sum, contributor) => sum + contributor.eligibleCount,
            0
        ),
        totalContributors: totals.length,
        contributors: totals,
        configurationSnapshot: epoch.configurationSnapshot
    };

    epoch.status = 'FINALIZED';
    epoch.finalizedAt = finalizationSnapshot.finalizedAt;
    epoch.finalizationSnapshot = finalizationSnapshot;

    await epoch.save();

    return {
        epoch,
        scores: await FundingEpochScore.find({ epoch: epoch._id }),
        alreadyFinalized: false
    };
}
