import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import {
    findSensitiveData,
    assertPublicSafe,
    EvidencePrivacyError,
    cleanLogin,
    cleanRepository,
    cleanPrNumber,
    buildPullUrl,
    cleanCommitSha,
    cleanTimestamp,
    cleanText,
    cleanRunStatus,
    cleanRunConclusion,
    cleanAlgorithmVersion
} from '../services/evidencePrivacy.js';
import { buildEvidencePackage, storeEvidencePackage } from '../services/evidenceService.js';

const TOKEN = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';

const baseInput = () => ({
    contribution: { username: 'kiran', repository: 'org/repo', prNumber: 7, mergedAt: '2026-11-01T10:00:00Z' },
    ci: { commitSha: 'abc123def456', verified: true, runs: [{ name: 'build', status: 'completed', conclusion: 'success' }] },
    scoreInputs: { complexity: 0.6, impact: 0.4, quality: 0.9, review: 0.7, priority: 0.4, reputation: 12, weights: { impact: 0.2, complexity: 0.2 } },
    score: 14.2,
    algorithm: { name: 'MSTS Contribution Scoring', version: 'msts-v2.0.0' }
});

describe('findSensitiveData', () => {
    it('finds email addresses', () => {
        assert.deepEqual(findSensitiveData({ a: 'contact me at dev@example.com' }).map(f => f.type), ['email address']);
    });

    it('finds the common token formats', () => {
        const samples = [
            TOKEN,
            'github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz',
            'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk',
            'Bearer abcdefghijklmnopqrstuvwxyz',
            'AKIAABCDEFGHIJKLMNOP',
            'xoxb-1234567890-abcdefghij',
            '-----BEGIN RSA PRIVATE KEY-----',
            'https://user:secret@github.com/org/repo'
        ];
        for (const sample of samples) {
            assert.ok(findSensitiveData({ v: sample }).length > 0, `should flag: ${sample.slice(0, 20)}`);
        }
    });

    it('finds sensitive field names', () => {
        const found = findSensitiveData({ accessToken: 'x', email: 'y', nested: { apiKey: 'z' } });
        assert.equal(found.filter(f => f.type === 'sensitive field name').length, 3);
    });

    it('reports where, never the value', () => {
        const found = findSensitiveData({ contribution: { note: TOKEN } });
        assert.equal(found[0].path, '$.contribution.note');
        assert.ok(!JSON.stringify(found).includes('ghp_'));
    });

    it('does not flag ordinary evidence', () => {
        assert.deepEqual(findSensitiveData(buildEvidencePackage(baseInput())), []);
        assert.deepEqual(findSensitiveData({ name: 'Build and test (node 22)', sha: 'abc123def456' }), []);
    });
});

describe('assertPublicSafe', () => {
    it('throws EvidencePrivacyError without echoing the secret', () => {
        try {
            assertPublicSafe({ note: TOKEN });
            assert.fail('should have thrown');
        } catch (err) {
            assert.ok(err instanceof EvidencePrivacyError);
            assert.ok(!err.message.includes('ghp_'));
        }
    });

    it('returns the package when it is safe', () => {
        const pkg = { a: 'fine' };
        assert.equal(assertPublicSafe(pkg), pkg);
    });
});

describe('field sanitizers', () => {
    it('accepts public GitHub logins and rejects anything else', () => {
        assert.equal(cleanLogin('kiranShamsHere'), 'kiranShamsHere');
        assert.equal(cleanLogin('dependabot[bot]'), 'dependabot[bot]');
        assert.equal(cleanLogin('a@b.com'), null);
        assert.equal(cleanLogin(TOKEN), null);
        assert.equal(cleanLogin(''), null);
        assert.equal(cleanLogin(42), null);
    });

    it('accepts owner/name repositories only', () => {
        assert.equal(cleanRepository('org/repo.js'), 'org/repo.js');
        assert.equal(cleanRepository('org/repo/extra'), null);
        assert.equal(cleanRepository('https://github.com/org/repo'), null);
        assert.equal(cleanRepository('org/repo?token=abc'), null);
    });

    it('accepts positive integer PR numbers only', () => {
        assert.equal(cleanPrNumber(7), 7);
        assert.equal(cleanPrNumber('7'), 7);
        assert.equal(cleanPrNumber(0), null);
        assert.equal(cleanPrNumber(-1), null);
        assert.equal(cleanPrNumber(1.5), null);
        assert.equal(cleanPrNumber('abc'), null);
    });

    it('rebuilds the PR URL from safe parts', () => {
        assert.equal(buildPullUrl('org/repo', 7), 'https://github.com/org/repo/pull/7');
    });

    it('accepts hex commit SHAs only', () => {
        assert.equal(cleanCommitSha('abc123def456'), 'abc123def456');
        assert.equal(cleanCommitSha(TOKEN), null);
        assert.equal(cleanCommitSha('xyz'), null);
        assert.equal(cleanCommitSha(undefined), null);
    });

    it('normalises timestamps and drops invalid ones', () => {
        assert.equal(cleanTimestamp('2026-11-01T10:00:00Z'), '2026-11-01T10:00:00.000Z');
        assert.equal(cleanTimestamp('not a date'), null);
        assert.equal(cleanTimestamp(null), null);
    });

    it('cleans free text, caps length and redacts sensitive text', () => {
        assert.equal(cleanText('  build\n  '), 'build');
        assert.equal(cleanText('x'.repeat(500)).length, 100);
        assert.equal(cleanText(`uses ${TOKEN}`), '[redacted]');
        assert.equal(cleanText('mail dev@example.com'), '[redacted]');
        assert.equal(cleanText(''), null);
        assert.equal(cleanText({}), null);
    });

    it('only allows known run statuses, conclusions and version strings', () => {
        assert.equal(cleanRunStatus('completed'), 'completed');
        assert.equal(cleanRunStatus(TOKEN), null);
        assert.equal(cleanRunConclusion('success'), 'success');
        assert.equal(cleanRunConclusion('anything else'), null);
        assert.equal(cleanAlgorithmVersion('msts-v2.0.0'), 'msts-v2.0.0');
        assert.equal(cleanAlgorithmVersion('v1 dev@example.com'), null);
    });
});

describe('buildEvidencePackage data minimization', () => {
    it('keeps everything verification needs', () => {
        const pkg = buildEvidencePackage(baseInput());
        assert.equal(pkg.contribution.username, 'kiran');
        assert.equal(pkg.contribution.repository, 'org/repo');
        assert.equal(pkg.contribution.prNumber, 7);
        assert.equal(pkg.contribution.prUrl, 'https://github.com/org/repo/pull/7');
        assert.equal(pkg.contribution.mergedAt, '2026-11-01T10:00:00.000Z');
        assert.equal(pkg.ciEvidence.commitSha, 'abc123def456');
        assert.equal(pkg.ciEvidence.verified, true);
        assert.deepEqual(pkg.ciEvidence.runs, [{ name: 'build', status: 'completed', conclusion: 'success' }]);
        assert.equal(pkg.scoreInputs.complexity, 0.6);
        assert.deepEqual(pkg.scoreInputs.weights, { impact: 0.2, complexity: 0.2 });
        assert.equal(pkg.score, 14.2);
        assert.deepEqual(pkg.algorithm, { name: 'MSTS Contribution Scoring', version: 'msts-v2.0.0' });
    });

    it('drops extra contributor, profile and credential fields', () => {
        const input = baseInput();
        Object.assign(input.contribution, { email: 'a@b.com', accessToken: TOKEN, displayName: 'Kiran S', avatarUrl: 'https://x/y.png', githubId: '12345', wallet: '0xabc' });
        Object.assign(input.ci, { token: TOKEN, actor: 'someone' });
        Object.assign(input.scoreInputs, { githubToken: TOKEN, email: 'a@b.com' });
        const text = JSON.stringify(buildEvidencePackage(input));
        for (const leaked of ['a@b.com', TOKEN, 'Kiran S', 'avatar', '12345', '0xabc', 'someone']) {
            assert.ok(!text.includes(leaked), `${leaked} must not be published`);
        }
    });

    it('rebuilds the PR URL so credentials and query strings cannot be carried in', () => {
        const input = baseInput();
        input.contribution.prUrl = `https://x-access-token:${TOKEN}@github.com/org/repo/pull/7?token=${TOKEN}`;
        const pkg = buildEvidencePackage(input);
        assert.equal(pkg.contribution.prUrl, 'https://github.com/org/repo/pull/7');
        assert.ok(!JSON.stringify(pkg).includes('ghp_'));
    });

    it('only publishes known weight names', () => {
        const input = baseInput();
        input.scoreInputs.weights = { impact: 0.2, 'owner@example.com': 1, secretWeight: 2 };
        assert.deepEqual(buildEvidencePackage(input).scoreInputs.weights, { impact: 0.2 });
    });

    it('redacts sensitive check run names and unknown run values', () => {
        const input = baseInput();
        input.ci.runs = [{ name: `deploy ${TOKEN}`, status: 'weird', conclusion: TOKEN }];
        const pkg = buildEvidencePackage(input);
        assert.deepEqual(pkg.ciEvidence.runs, [{ name: '[redacted]', status: null, conclusion: null }]);
    });

    it('drops a commit SHA that is not hex', () => {
        const input = baseInput();
        input.ci.commitSha = TOKEN;
        assert.equal(buildEvidencePackage(input).ciEvidence.commitSha, null);
    });

    it('refuses invalid identifiers instead of publishing them', () => {
        for (const bad of [
            { username: 'dev@example.com' },
            { username: TOKEN },
            { repository: 'org/repo?x=1' },
            { prNumber: 'seven' }
        ]) {
            const input = baseInput();
            Object.assign(input.contribution, bad);
            assert.throws(() => buildEvidencePackage(input));
        }
    });

    it('refuses an algorithm version that is not a plain version string', () => {
        const input = baseInput();
        input.algorithm.version = 'v2 dev@example.com';
        assert.throws(() => buildEvidencePackage(input));
    });

    it('gives the same package for the same input', () => {
        assert.equal(JSON.stringify(buildEvidencePackage(baseInput())), JSON.stringify(buildEvidencePackage(baseInput())));
    });
});

describe('storeEvidencePackage privacy gate', () => {
    it('refuses to publish a package containing a token or email, and never calls storage', async () => {
        let stored = 0;
        const store = async () => { stored++; return 'x'; };
        for (const bad of [{ note: TOKEN }, { note: 'dev@example.com' }, { apiKey: 'x' }]) {
            await assert.rejects(
                storeEvidencePackage({ ...buildEvidencePackage(baseInput()), ...bad }, { store }),
                EvidencePrivacyError
            );
        }
        assert.equal(stored, 0);
    });

    it('still stores a clean package', async () => {
        const digest = await sha256.digest(new TextEncoder().encode('ok'));
        const cid = CID.createV1(0x0129, digest).toString();
        const out = await storeEvidencePackage(buildEvidencePackage(baseInput()), { store: async () => cid });
        assert.equal(out, cid);
    });
});
