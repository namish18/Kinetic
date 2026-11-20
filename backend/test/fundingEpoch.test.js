import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import FundingEpoch from '../models/FundingEpoch.js';
import FundingEpochScore from '../models/FundingEpochScore.js';

describe('FLOW-08: Funding Epoch Models', () => {
    describe('FundingEpoch schema', () => {
        it('defines the required funding epoch fields', () => {
            const paths = FundingEpoch.schema.paths;

            for (const field of [
                'organization',
                'name',
                'description',
                'startDate',
                'endDate',
                'status',
                'eligibility',
                'configuration',
                'configurationSnapshot',
                'activatedAt',
                'finalizedAt',
                'finalizationSnapshot',
                'createdBy'
            ]) {
                assert.ok(paths[field], `Missing schema field: ${field}`);
            }
        });

        it('defaults new epochs to DRAFT status', () => {
            const epoch = new FundingEpoch({
                organization: '507f1f77bcf86cd799439011',
                createdBy: '507f1f77bcf86cd799439012',
                name: 'Test Funding',
                startDate: new Date('2026-01-01'),
                endDate: new Date('2026-12-31')
            });

            assert.equal(epoch.status, 'DRAFT');
        });

        it('rejects invalid lifecycle statuses', () => {
            const epoch = new FundingEpoch({
                organization: '507f1f77bcf86cd799439011',
                createdBy: '507f1f77bcf86cd799439012',
                name: 'Test Funding',
                startDate: new Date('2026-01-01'),
                endDate: new Date('2026-12-31'),
                status: 'CANCELLED'
            });

            const error = epoch.validateSync();
            assert.ok(error);
            assert.ok(error.errors.status);
        });

        it('rejects epochs missing required fields', () => {
            const epoch = new FundingEpoch({});
            const error = epoch.validateSync();

            assert.ok(error);
            assert.ok(error.errors.organization);
            assert.ok(error.errors.name);
            assert.ok(error.errors.startDate);
            assert.ok(error.errors.endDate);
            assert.ok(error.errors.createdBy);
        });
    });

    describe('FundingEpochScore schema', () => {
        it('defines the required score and audit fields', () => {
            const paths = FundingEpochScore.schema.paths;

            for (const field of [
                'epoch',
                'contributionEvent',
                'username',
                'repository',
                'prNumber',
                'score',
                'eligible',
                'eligibilityReason',
                'algorithmVersion',
                'configurationSnapshot',
                'scoringDetails'
            ]) {
                assert.ok(paths[field], `Missing schema field: ${field}`);
            }
        });

        it('requires a non-negative score and eligibility result', () => {
            const score = new FundingEpochScore({
                epoch: '507f1f77bcf86cd799439011',
                contributionEvent: '507f1f77bcf86cd799439012',
                username: 'test-user',
                repository: 'owner/repo',
                prNumber: 1,
                score: -1,
                eligible: true,
                algorithmVersion: 'msts-v2.0.0',
                configurationSnapshot: {}
            });

            const error = score.validateSync();
            assert.ok(error);
            assert.ok(error.errors.score);
        });
    });
});