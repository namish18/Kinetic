import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import {
    buildEvidencePackage,
    storeEvidencePackage,
    recordContributionEvidence,
    fetchCIEvidence,
    isValidCid
} from '../services/evidenceService.js';

async function realCid(text = 'evidence') {
    const digest = await sha256.digest(new TextEncoder().encode(text));
    return CID.createV1(0x0129, digest).toString();
}

const baseInput = () => ({
    contribution: {
        username: 'kiran',
        repository: 'org/repo',
        prNumber: 7,
        prUrl: 'https://github.com/org/repo/pull/7',
        mergedAt: '2026-11-01T10:00:00Z'
    },
    ci: {
        commitSha: 'abc123',
        verified: true,
        runs: [{ name: 'build', status: 'completed', conclusion: 'success' }]
    },
    scoreInputs: { complexity: 0.6, impact: 0.4, quality: 0.9, review: 0.7, priority: 0.4, reputation: 12, weights: { complexity: 0.3 } },
    score: 14.2,
    algorithm: { name: 'MSTS Contribution Scoring', version: 'msts-v2.0.0' }
});

const silent = { warn() { }, error() { }, log() { } };

describe('buildEvidencePackage', () => {
    it('includes metadata, CI evidence, score inputs and algorithm version', () => {
        const pkg = buildEvidencePackage(baseInput());
        assert.equal(pkg.contribution.repository, 'org/repo');
        assert.equal(pkg.contribution.prNumber, 7);
        assert.equal(pkg.ciEvidence.commitSha, 'abc123');
        assert.equal(pkg.ciEvidence.verified, true);
        assert.equal(pkg.ciEvidence.runs[0].conclusion, 'success');
        assert.equal(pkg.scoreInputs.complexity, 0.6);
        assert.equal(pkg.scoreInputs.weights.complexity, 0.3);
        assert.equal(pkg.score, 14.2);
        assert.equal(pkg.algorithm.version, 'msts-v2.0.0');
    });

    it('only copies known fields, so secrets cannot leak in', () => {
        const input = baseInput();
        input.contribution.email = 'a@b.com';
        input.contribution.accessToken = 'ghp_secret';
        input.ci.token = 'ghp_secret';
        input.scoreInputs.githubToken = 'ghp_secret';
        const text = JSON.stringify(buildEvidencePackage(input));
        assert.ok(!text.includes('a@b.com'));
        assert.ok(!text.includes('ghp_secret'));
    });

    it('gives the same package for the same input', () => {
        assert.equal(
            JSON.stringify(buildEvidencePackage(baseInput())),
            JSON.stringify(buildEvidencePackage(baseInput()))
        );
    });

    it('keeps CI verified as null when it was not checked', () => {
        const input = baseInput();
        input.ci = undefined;
        const pkg = buildEvidencePackage(input);
        assert.equal(pkg.ciEvidence.verified, null);
        assert.deepEqual(pkg.ciEvidence.runs, []);
    });

    it('throws without identifiers or algorithm version', () => {
        const noId = baseInput();
        delete noId.contribution.repository;
        assert.throws(() => buildEvidencePackage(noId));
        const noVersion = baseInput();
        noVersion.algorithm = {};
        assert.throws(() => buildEvidencePackage(noVersion));
    });
});

describe('isValidCid', () => {
    it('accepts a real CID', async () => {
        assert.equal(isValidCid(await realCid()), true);
    });

    it('rejects fake and fallback ids', () => {
        assert.equal(isValidCid('sha256-abcdef'), false);
        assert.equal(isValidCid('bafybei1a2b3c4d'), false);
        assert.equal(isValidCid(''), false);
        assert.equal(isValidCid(null), false);
    });
});

describe('storeEvidencePackage', () => {
    it('returns the CID from storage', async () => {
        const cid = await realCid();
        const out = await storeEvidencePackage(buildEvidencePackage(baseInput()), { store: async () => cid });
        assert.equal(out, cid);
    });

    it('throws instead of accepting an invalid CID', async () => {
        await assert.rejects(
            storeEvidencePackage(buildEvidencePackage(baseInput()), { store: async () => 'sha256-fake' })
        );
    });
});

describe('recordContributionEvidence', () => {
    it('links the stored CID to the contribution', async () => {
        const cid = await realCid();
        const calls = [];
        const model = { findOneAndUpdate: async (...args) => calls.push(args) };
        const out = await recordContributionEvidence(baseInput(), { store: async () => cid, model, logger: silent });
        assert.equal(out, cid);
        assert.deepEqual(calls[0][0], { username: 'kiran', repository: 'org/repo', prNumber: 7 });
        assert.equal(calls[0][1].$set.evidenceCID, cid);
    });

    it('returns null and saves nothing when storing fails', async () => {
        const calls = [];
        const model = { findOneAndUpdate: async (...args) => calls.push(args) };
        const out = await recordContributionEvidence(baseInput(), {
            store: async () => { throw new Error('ipfs down'); },
            model,
            logger: silent
        });
        assert.equal(out, null);
        assert.equal(calls.length, 0);
    });
});

describe('fetchCIEvidence', () => {
    const okFetch = runs => async () => ({ ok: true, json: async () => ({ check_runs: runs }) });

    it('marks verified when every run succeeded', async () => {
        const ci = await fetchCIEvidence({
            repository: 'org/repo', commitSha: 'abc', token: 'ghp_secret',
            fetchFn: okFetch([{ name: 'build', status: 'completed', conclusion: 'success' }])
        });
        assert.equal(ci.verified, true);
        assert.ok(!JSON.stringify(ci).includes('ghp_secret'));
    });

    it('marks not verified when a run failed', async () => {
        const ci = await fetchCIEvidence({
            repository: 'org/repo', commitSha: 'abc',
            fetchFn: okFetch([{ name: 'build', status: 'completed', conclusion: 'failure' }])
        });
        assert.equal(ci.verified, false);
    });

    it('leaves verified null when GitHub cannot be read', async () => {
        const ci = await fetchCIEvidence({
            repository: 'org/repo', commitSha: 'abc',
            fetchFn: async () => ({ ok: false })
        });
        assert.equal(ci.verified, null);
        assert.deepEqual(ci.runs, []);
    });
});
