import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import {
    buildEvidencePackage,
    storeEvidencePackage,
    recordContributionEvidence,
    fetchCIEvidence,
    shouldRefreshEvidence,
    isCIPending,
    hashEvidencePackage,
    ensureContributionEvidence,
    fetchRepositoryVisibility,
    clearVisibilityCache,
    EVIDENCE_RECHECK_MS,
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

function fakeModel(result) {
    const calls = [];
    return {
        calls,
        findOneAndUpdate: async (...args) => {
            calls.push(args);
            if (typeof result === 'function') return result(...args);
            return result;
        }
    };
}
const echoModel = () => fakeModel((_f, update) => ({ evidenceCID: update.$set.evidenceCID }));

describe('recordContributionEvidence', () => {
    it('links the stored CID to the contribution', async () => {
        const cid = await realCid();
        const model = echoModel();
        const out = await recordContributionEvidence(baseInput(), { store: async () => cid, model, logger: silent });
        assert.equal(out, cid);
        assert.deepEqual(model.calls[0][0], { username: 'kiran', repository: 'org/repo', prNumber: 7 });
        assert.equal(model.calls[0][1].$set.evidenceCID, cid);
        assert.equal(model.calls[0][1].$set.evidenceDigest, hashEvidencePackage(buildEvidencePackage(baseInput())));
        assert.equal(model.calls[0][1].$set.evidencePending, false);
    });

    it('returns null and saves nothing when storing fails', async () => {
        const model = echoModel();
        const out = await recordContributionEvidence(baseInput(), {
            store: async () => { throw new Error('ipfs down'); },
            model,
            logger: silent
        });
        assert.equal(out, null);
        assert.equal(model.calls.length, 0);
    });

    it('returns null when no contribution record matched the update', async () => {
        const cid = await realCid();
        const warnings = [];
        const out = await recordContributionEvidence(baseInput(), {
            store: async () => cid,
            model: fakeModel(null),
            logger: { warn: m => warnings.push(m) }
        });
        assert.equal(out, null);
        assert.match(warnings[0], /CID not linked/);
    });

    it('returns null when the saved record does not hold the CID', async () => {
        const cid = await realCid();
        const out = await recordContributionEvidence(baseInput(), {
            store: async () => cid,
            model: fakeModel({ evidenceCID: null }),
            logger: silent
        });
        assert.equal(out, null);
    });

    it('returns null when the database write throws', async () => {
        const cid = await realCid();
        const out = await recordContributionEvidence(baseInput(), {
            store: async () => cid,
            model: fakeModel(() => { throw new Error('mongo down'); }),
            logger: silent
        });
        assert.equal(out, null);
    });

    it('marks the package pending while CI is still running', async () => {
        const cid = await realCid();
        const model = echoModel();
        const input = baseInput();
        input.ci = { commitSha: 'abc123', verified: false, runs: [{ name: 'build', status: 'in_progress', conclusion: null }] };
        await recordContributionEvidence(input, { store: async () => cid, model, logger: silent });
        assert.equal(model.calls[0][1].$set.evidencePending, true);
    });

    it('does not store again when the evidence is unchanged', async () => {
        const cid = await realCid();
        const digest = hashEvidencePackage(buildEvidencePackage(baseInput()));
        const model = echoModel();
        let stores = 0;
        const out = await recordContributionEvidence(baseInput(), {
            store: async () => { stores++; return cid; },
            previous: { evidenceCID: cid, evidenceDigest: digest },
            model,
            logger: silent
        });
        assert.equal(out, cid);
        assert.equal(stores, 0);
        assert.equal(model.calls.length, 1);
    });

    it('stores a new package when only the CI evidence changed', async () => {
        const oldCid = await realCid('old');
        const newCid = await realCid('new');
        const pendingInput = baseInput();
        pendingInput.ci = { commitSha: 'abc123', verified: false, runs: [{ name: 'build', status: 'in_progress', conclusion: null }] };
        const previous = { evidenceCID: oldCid, evidenceDigest: hashEvidencePackage(buildEvidencePackage(pendingInput)) };

        const out = await recordContributionEvidence(baseInput(), {
            store: async () => newCid,
            previous,
            model: echoModel(),
            logger: silent
        });
        assert.equal(out, newCid);
    });
});

describe('isCIPending', () => {
    it('is pending when CI is unreadable, empty or still running', () => {
        assert.equal(isCIPending(null), true);
        assert.equal(isCIPending({ verified: null, runs: [] }), true);
        assert.equal(isCIPending({ verified: true, runs: [] }), true);
        assert.equal(isCIPending({ verified: false, runs: [{ status: 'queued', conclusion: null }] }), true);
    });

    it('is final once every run completed, even if one failed', () => {
        assert.equal(isCIPending({ verified: true, runs: [{ status: 'completed', conclusion: 'success' }] }), false);
        assert.equal(isCIPending({ verified: false, runs: [{ status: 'completed', conclusion: 'failure' }] }), false);
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

describe('fetchCIEvidence with only a PR number', () => {
    it('looks up the merge commit, then reads its check runs', async () => {
        const urls = [];
        const fetchFn = async url => {
            urls.push(url);
            if (url.includes('/pulls/')) return { ok: true, json: async () => ({ merge_commit_sha: 'deadbeef' }) };
            return { ok: true, json: async () => ({ check_runs: [{ name: 'build', status: 'completed', conclusion: 'success' }] }) };
        };
        const ci = await fetchCIEvidence({ repository: 'org/repo', prNumber: 7, fetchFn });
        assert.equal(ci.commitSha, 'deadbeef');
        assert.equal(ci.verified, true);
        assert.ok(urls[1].includes('/commits/deadbeef/check-runs'));
    });

    it('leaves verified null when the merge commit cannot be found', async () => {
        const ci = await fetchCIEvidence({ repository: 'org/repo', prNumber: 7, fetchFn: async () => ({ ok: false }) });
        assert.equal(ci.verified, null);
        assert.equal(ci.commitSha, null);
    });
});

describe('shouldRefreshEvidence', () => {
    const now = new Date('2026-11-08T12:00:00Z');
    const fresh = async (extra = {}) => ({
        score: 10,
        algorithmVersion: 'msts-v2.0.0',
        evidenceCID: await realCid(),
        evidenceDigest: 'abc',
        evidencePending: false,
        evidenceCheckedAt: new Date('2026-11-08T10:00:00Z'),
        ...extra
    });
    const ctx = { score: 10, algorithmVersion: 'msts-v2.0.0', now };

    it('refreshes when there is no valid evidence yet', () => {
        assert.equal(shouldRefreshEvidence(null, ctx), true);
        assert.equal(shouldRefreshEvidence({ score: 10, evidenceCID: null }, ctx), true);
        assert.equal(shouldRefreshEvidence({ score: 10, evidenceCID: 'sha256-fake' }, ctx), true);
    });

    it('skips when nothing changed and the last check is recent', async () => {
        assert.equal(shouldRefreshEvidence(await fresh(), ctx), false);
    });

    it('refreshes when the score or algorithm version changed', async () => {
        assert.equal(shouldRefreshEvidence(await fresh(), { ...ctx, score: 12 }), true);
        assert.equal(shouldRefreshEvidence(await fresh(), { ...ctx, algorithmVersion: 'msts-v3.0.0' }), true);
    });

    it('refreshes when CI was still pending, even though the score is the same', async () => {
        assert.equal(shouldRefreshEvidence(await fresh({ evidencePending: true }), ctx), true);
    });

    it('refreshes when the last check is older than the recheck window', async () => {
        const old = new Date(now.getTime() - EVIDENCE_RECHECK_MS - 1000);
        assert.equal(shouldRefreshEvidence(await fresh({ evidenceCheckedAt: old }), ctx), true);
    });

    it('refreshes records saved before digests existed', async () => {
        assert.equal(shouldRefreshEvidence(await fresh({ evidenceDigest: null }), ctx), true);
    });
});

describe('ensureContributionEvidence', () => {
    const args = (previous = null) => ({
        contribution: baseInput().contribution,
        scoreInputs: baseInput().scoreInputs,
        score: 14.2,
        algorithm: baseInput().algorithm,
        previous,
        token: 't'
    });

    it('does not call GitHub when evidence is current', async () => {
        const cid = await realCid();
        const previous = {
            score: 14.2, algorithmVersion: 'msts-v2.0.0', evidenceCID: cid, evidenceDigest: 'x',
            evidencePending: false, evidenceCheckedAt: new Date()
        };
        let fetched = 0;
        const out = await ensureContributionEvidence(args(previous), {
            checkVisibility: async () => true,
            fetchCI: async () => { fetched++; return baseInput().ci; },
            logger: silent
        });
        assert.equal(out, cid);
        assert.equal(fetched, 0);
    });

    it('returns null instead of throwing if something unexpected fails', async () => {
        const out = await ensureContributionEvidence(args(), {
            checkVisibility: async () => true,
            fetchCI: async () => { throw new Error('boom'); },
            logger: silent
        });
        assert.equal(out, null);
    });

    it('publishes for a public repository', async () => {
        const recorded = [];
        const out = await ensureContributionEvidence(args(), {
            checkVisibility: async () => true,
            fetchCI: async () => baseInput().ci,
            record: async input => { recorded.push(input); return 'cid-from-record'; },
            logger: silent
        });
        assert.equal(out, 'cid-from-record');
        assert.equal(recorded.length, 1);
    });

    it('does not publish, or read CI, for a private repository', async () => {
        let fetched = 0;
        let recorded = 0;
        const out = await ensureContributionEvidence(args(), {
            checkVisibility: async () => false,
            fetchCI: async () => { fetched++; return baseInput().ci; },
            record: async () => { recorded++; return 'x'; },
            logger: silent
        });
        assert.equal(out, null);
        assert.equal(fetched, 0);
        assert.equal(recorded, 0);
    });

    it('does not publish when visibility cannot be confirmed', async () => {
        let recorded = 0;
        const out = await ensureContributionEvidence(args(), {
            checkVisibility: async () => null,
            fetchCI: async () => baseInput().ci,
            record: async () => { recorded++; return 'x'; },
            logger: silent
        });
        assert.equal(out, null);
        assert.equal(recorded, 0);
    });
});

describe('fetchRepositoryVisibility', () => {
    const respond = (body, ok = true) => async () => ({ ok, json: async () => body });

    it('is true for a public repository', async () => {
        clearVisibilityCache();
        assert.equal(await fetchRepositoryVisibility({ repository: 'org/pub', fetchFn: respond({ private: false, visibility: 'public' }) }), true);
    });

    it('is false for a private or internal repository', async () => {
        clearVisibilityCache();
        assert.equal(await fetchRepositoryVisibility({ repository: 'org/priv', fetchFn: respond({ private: true, visibility: 'private' }) }), false);
        assert.equal(await fetchRepositoryVisibility({ repository: 'org/internal', fetchFn: respond({ private: false, visibility: 'internal' }) }), false);
    });

    it('is null when GitHub cannot be read or answers unexpectedly', async () => {
        clearVisibilityCache();
        assert.equal(await fetchRepositoryVisibility({ repository: 'org/a', fetchFn: respond({}, false) }), null);
        assert.equal(await fetchRepositoryVisibility({ repository: 'org/b', fetchFn: respond({ nope: 1 }) }), null);
        assert.equal(await fetchRepositoryVisibility({ repository: 'org/c', fetchFn: async () => { throw new Error('offline'); } }), null);
    });

    it('caches definite answers but not failures', async () => {
        clearVisibilityCache();
        let calls = 0;
        const counting = body => async () => { calls++; return { ok: true, json: async () => body }; };
        await fetchRepositoryVisibility({ repository: 'org/cached', fetchFn: counting({ private: false }) });
        await fetchRepositoryVisibility({ repository: 'org/cached', fetchFn: counting({ private: false }) });
        assert.equal(calls, 1);

        let failures = 0;
        const failing = async () => { failures++; return { ok: false }; };
        await fetchRepositoryVisibility({ repository: 'org/flaky', fetchFn: failing });
        await fetchRepositoryVisibility({ repository: 'org/flaky', fetchFn: failing });
        assert.equal(failures, 2);
    });
});

