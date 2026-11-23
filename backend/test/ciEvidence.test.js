import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { verifyProofOfBuild, matchRunCommit } from '../services/kineticMechanisms.js';
import { attributionFromEvent, expectedShasForEvent, recordCiEvidence } from '../services/contributionIndex.js';
import { validateProofOfBuild } from '../middleware/validate.js';

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});

const HEAD = 'e6e89f9990c38acd30d422f281b7926db4796879';
const MERGE = '5e893ce0725de12d7cb6df79ebb4b6d813648328';
const OTHER = '0123456789abcdef0123456789abcdef01234567';
const PR_SHAS = [{ sha: HEAD, kind: 'head' }, { sha: MERGE, kind: 'merge' }];

function mockRun(run, { status = 200 } = {}) {
    const calls = [];
    globalThis.fetch = async (url) => {
        calls.push(String(url));
        return new Response(JSON.stringify(run), { status, headers: { 'content-type': 'application/json' } });
    };
    return calls;
}

const successRun = sha => ({ id: 42, head_sha: sha, status: 'completed', conclusion: 'success' });

test('a successful run on the PR head SHA verifies and identifies the commit', async () => {
    const calls = mockRun(successRun(HEAD));
    const evidence = await verifyProofOfBuild('nodejs/node', '42', 'token', { expectedShas: PR_SHAS });

    assert.equal(calls[0], 'https://api.github.com/repos/nodejs/node/actions/runs/42');
    assert.equal(evidence.verified, true);
    assert.equal(evidence.runId, 42);
    assert.equal(evidence.headSha, HEAD);
    assert.equal(evidence.conclusion, 'success');
    assert.deepEqual(evidence.matchedCommit, { sha: HEAD, kind: 'head' });
    assert.equal(evidence.reason, null);
    assert.equal(evidence.confirmed, true);
});

test('a successful post-merge run on the merge commit verifies', async () => {
    mockRun(successRun(MERGE));
    const evidence = await verifyProofOfBuild('nodejs/node', 42, 'token', { expectedShas: PR_SHAS });

    assert.equal(evidence.verified, true);
    assert.deepEqual(evidence.matchedCommit, { sha: MERGE, kind: 'merge' });
});

test('a successful run from a different commit does not verify the evaluated commit', async () => {
    mockRun(successRun(OTHER));
    const evidence = await verifyProofOfBuild('nodejs/node', 42, 'token', { expectedShas: PR_SHAS });

    assert.equal(evidence.verified, false);
    assert.equal(evidence.conclusion, 'success');
    assert.equal(evidence.headSha, OTHER);
    assert.equal(evidence.matchedCommit, null);
    assert.ok(evidence.reason.includes(`ran on commit ${OTHER}, not the evaluated commit`));
});

test('a failed or unfinished run on the right commit is not verification', async () => {
    mockRun({ ...successRun(HEAD), conclusion: 'failure' });
    const failed = await verifyProofOfBuild('nodejs/node', 42, 'token', { expectedShas: PR_SHAS });
    assert.equal(failed.verified, false);
    assert.deepEqual(failed.matchedCommit, { sha: HEAD, kind: 'head' });
    assert.match(failed.reason, /did not succeed \(conclusion: failure\)/);

    mockRun({ ...successRun(HEAD), status: 'in_progress', conclusion: null });
    const running = await verifyProofOfBuild('nodejs/node', 42, 'token', { expectedShas: PR_SHAS });
    assert.equal(running.verified, false);
    assert.match(running.reason, /has not completed/);
});

test('the old call without a commit keeps its outcome check and reports matchedCommit null', async () => {
    mockRun(successRun(OTHER));
    const evidence = await verifyProofOfBuild('nodejs/node', '42', 'token');
    assert.equal(evidence.verified, true);
    assert.equal(evidence.matchedCommit, null);

    mockRun({ message: 'Not Found' }, { status: 404 });
    const missing = await verifyProofOfBuild('nodejs/node', '42', 'token');
    assert.equal(missing.verified, false);
    assert.equal(missing.confirmed, false);
    assert.match(missing.reason, /not found/);

    await assert.rejects(() => verifyProofOfBuild('nodejs/node', '42', undefined), /token required/);
});

test('matchRunCommit accepts abbreviated SHAs (7+ chars) as a prefix, case-insensitively', () => {
    assert.deepEqual(matchRunCommit(HEAD, [{ sha: HEAD.slice(0, 7).toUpperCase(), kind: 'commit' }]), { sha: HEAD, kind: 'commit' });
    assert.equal(matchRunCommit(HEAD, [{ sha: HEAD.slice(0, 6), kind: 'commit' }]), null);
    assert.equal(matchRunCommit(null, PR_SHAS), null);
});

test('expected SHAs come from the indexed PR and CI evidence reaches processing', () => {
    assert.deepEqual(expectedShasForEvent({ headSha: HEAD, mergeCommitSha: MERGE }), PR_SHAS);
    assert.deepEqual(expectedShasForEvent({ headSha: null, mergeCommitSha: null }), []);

    const ciEvidence = { runId: 42, headSha: HEAD, conclusion: 'success', matchedCommit: { sha: HEAD, kind: 'head' }, verified: true };
    assert.deepEqual(attributionFromEvent({ repo: 'nodejs/node', prNumber: 1, author: 'a', ciEvidence }).ciEvidence, ciEvidence);
    assert.equal(attributionFromEvent({ repo: 'nodejs/node', prNumber: 1, author: 'a' }).ciEvidence, null);
});

test('recordCiEvidence stores only confirmed runs on the PR commit and never downgrades verified evidence', async () => {
    const writes = [];
    const Event = {
        async updateOne(filter, update) {
            writes.push({ filter, update });
            return { modifiedCount: 1 };
        }
    };
    const key = { repoKey: 'nodejs/node', prNumber: 1 };
    const now = new Date('2026-11-09T00:00:00Z');
    const base = { runId: 42, headSha: HEAD, status: 'completed', conclusion: 'success', matchedCommit: { sha: HEAD, kind: 'head' }, confirmed: true };

    assert.equal(await recordCiEvidence(Event, key, { ...base, verified: true, reason: null }, now), true);
    assert.deepEqual(writes[0].filter, key);
    assert.deepEqual(writes[0].update.$set.ciEvidence, {
        runId: 42, headSha: HEAD, status: 'completed', conclusion: 'success',
        matchedCommit: { sha: HEAD, kind: 'head' }, verified: true, reason: null, checkedAt: now
    });

    // A failed run on the PR commit is stored, but never over verified evidence
    await recordCiEvidence(Event, key, { ...base, conclusion: 'failure', verified: false, reason: 'failed' }, now);
    assert.deepEqual(writes[1].filter, { ...key, 'ciEvidence.verified': { $ne: true } });

    // A run from another commit, or a result GitHub did not confirm, is never stored
    assert.equal(await recordCiEvidence(Event, key, { ...base, headSha: OTHER, matchedCommit: null, verified: false }, now), false);
    assert.equal(await recordCiEvidence(Event, key, { ...base, confirmed: false, verified: false }, now), false);
    assert.equal(writes.length, 2);
});

function validate(query) {
    let status = null;
    let nextCalled = false;
    const req = { query };
    const res = {
        status(code) {
            status = code;
            return this;
        },
        json() {
            return this;
        }
    };
    validateProofOfBuild(req, res, () => {
        nextCalled = true;
    });
    return { req, status, nextCalled };
}

test('validateProofOfBuild: optional sha (7-40 hex) and pr (positive integer)', () => {
    const ok = validate({ repo: 'nodejs/node', runId: '42', sha: HEAD.toUpperCase(), pr: '67154' });
    assert.equal(ok.nextCalled, true);
    assert.equal(ok.req.expectedSha, HEAD);
    assert.equal(ok.req.prNumber, 67154);

    const legacy = validate({ repo: 'nodejs/node', runId: '42' });
    assert.equal(legacy.nextCalled, true);
    assert.equal(legacy.req.expectedSha, undefined);
    assert.equal(legacy.req.prNumber, undefined);

    const badQueries = [
        { sha: 'abc12' }, { sha: 'g'.repeat(40) }, { sha: 'a'.repeat(41) }, { sha: [HEAD, HEAD] },
        { pr: '0' }, { pr: '-3' }, { pr: '1.5' }, { pr: 'abc' }
    ];
    for (const bad of badQueries) {
        const result = validate({ repo: 'nodejs/node', runId: '42', ...bad });
        assert.equal(result.status, 400, JSON.stringify(bad));
        assert.equal(result.nextCalled, false);
    }
});
