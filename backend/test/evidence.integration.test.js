import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import User from '../models/User.js';
import ContributionScore from '../models/ContributionScore.js';
import ContributionEvent from '../models/ContributionEvent.js';
import ContributionSyncState from '../models/ContributionSyncState.js';
import { toPRShape } from '../services/contributionIndex.js';
import { clearVisibilityCache } from '../services/evidenceService.js';
import {
    computeContributionScore,
    extractPRMetrics,
    calculatePRScore,
    calculateHistoricalReputation
} from '../services/contributionService.js';

// These tests run computeContributionScore end to end with in-memory fakes for
// MongoDB and GitHub. IPFS storage is injected, so no Helia node is started.

async function cidFor(text) {
    const digest = await sha256.digest(new TextEncoder().encode(text));
    return CID.createV1(0x0129, digest).toString();
}

const silent = { warn() { }, error() { }, log() { } };

const EVENT = {
    prNumber: 7,
    title: 'Add feature',
    url: 'https://github.com/org/repo/pull/7',
    mergedAt: new Date('2026-11-01T10:00:00Z'),
    repo: 'org/repo',
    repoKey: 'org/repo',
    author: 'kiran',
    authorKey: 'kiran',
    stats: { additions: 420, deletions: 130, changedFiles: 9, commits: 5, comments: 2, reviewComments: 6, merged: true, labels: [] }
};

// What the scoring formulas give for EVENT, worked out with the pure functions
function expectedScore() {
    const pr = toPRShape(EVENT);
    const metrics = extractPRMetrics(pr);
    const { reputation } = calculateHistoricalReputation({
        acceptedPRs: 1,
        avgReviewScore: metrics.review,
        historicalImpact: metrics.impact,
        consistency: 0.5
    });
    const result = calculatePRScore(metrics, null, { reputation, timestamps: [] });
    const points = Math.round(result.score * 20 * 10) / 10;
    return Math.min(100, Math.round(points * 10) / 10);
}

describe('computeContributionScore evidence integration', () => {
    const originals = {};
    let db;          // fake ContributionScore collection (one record)
    let checkRuns;   // what GitHub returns for check runs
    let githubCalls; // URLs requested from GitHub
    let failScoreWrite;
    let failEvidenceWrite;
    let evidenceLinkResult; // 'ok' | 'nomatch'
    let repoResponse;       // what GitHub returns for the repository itself

    beforeEach(() => {
        db = null;
        githubCalls = [];
        failScoreWrite = false;
        failEvidenceWrite = false;
        evidenceLinkResult = 'ok';
        repoResponse = { status: 200, body: { private: false, visibility: 'public' } };
        clearVisibilityCache();
        checkRuns = [{ name: 'build', status: 'completed', conclusion: 'success' }];

        originals.userFindOne = User.findOne;
        originals.userFind = User.find;
        originals.syncFind = ContributionSyncState.find;
        originals.syncUpdate = ContributionSyncState.updateOne;
        originals.eventFind = ContributionEvent.find;
        originals.scoreFindOne = ContributionScore.findOne;
        originals.scoreUpdate = ContributionScore.findOneAndUpdate;
        originals.fetch = globalThis.fetch;

        User.findOne = async () => ({ repositories: [], save: async () => { } });
        User.find = async () => [{ repositories: [{ name: 'org/repo', weights: null }] }];
        ContributionSyncState.find = () => ({ lean: async () => [] });
        ContributionSyncState.updateOne = async () => ({});
        ContributionEvent.find = () => {
            const chain = {
                sorted: false,
                select() { return chain; },
                sort() { chain.sorted = true; return chain; },
                lean: async () => (chain.sorted ? [EVENT] : [])
            };
            return chain;
        };
        ContributionScore.findOne = () => ({
            select() { return this; },
            lean: async () => (db ? { ...db } : null)
        });
        ContributionScore.findOneAndUpdate = async (_filter, update) => {
            const set = update.$set;
            if ('evidenceCID' in set) {
                if (failEvidenceWrite) throw new Error('mongo down');
                if (evidenceLinkResult === 'nomatch' || !db) return null;
                db = { ...db, ...set };
                return { ...db };
            }
            if (failScoreWrite) throw new Error('mongo down');
            db = { ...(db || {}), score: set.score, algorithmVersion: set.algorithmVersion };
            return { ...db };
        };
        globalThis.fetch = async (url) => {
            githubCalls.push(String(url));
            const u = String(url);
            if (u.includes('/search/issues')) return Response.json({ items: [], total_count: 0 });
            if (u.endsWith('/repos/org/repo')) return Response.json(repoResponse.body, { status: repoResponse.status });
            if (u.endsWith('/pulls/7')) return Response.json({ merge_commit_sha: 'abc123' });
            if (u.includes('/check-runs')) return Response.json({ check_runs: checkRuns });
            return new Response('{}', { status: 404 });
        };
    });

    afterEach(() => {
        User.findOne = originals.userFindOne;
        User.find = originals.userFind;
        ContributionSyncState.find = originals.syncFind;
        ContributionSyncState.updateOne = originals.syncUpdate;
        ContributionEvent.find = originals.eventFind;
        ContributionScore.findOne = originals.scoreFindOne;
        ContributionScore.findOneAndUpdate = originals.scoreUpdate;
        globalThis.fetch = originals.fetch;
    });

    const ciCalls = () => githubCalls.filter(u => u.includes('/check-runs')).length;

    it('creates and links an evidence package while scoring', async () => {
        const stored = [];
        const store = async pkg => { stored.push(pkg); return cidFor(JSON.stringify(pkg)); };

        const out = await computeContributionScore('kiran', 'tok', { evidence: { store, logger: silent } });

        assert.equal(out.finalScore, expectedScore());
        assert.equal(stored.length, 1);
        const pkg = stored[0];
        assert.equal(pkg.contribution.repository, 'org/repo');
        assert.equal(pkg.contribution.prNumber, 7);
        assert.equal(pkg.ciEvidence.verified, true);
        assert.equal(pkg.ciEvidence.commitSha, 'abc123');
        assert.ok(pkg.scoreInputs.complexity > 0);
        assert.equal(pkg.algorithm.version, 'msts-v2.0.0');
        assert.equal(db.evidenceCID, await cidFor(JSON.stringify(pkg)));
        assert.equal(db.evidencePending, false);
        assert.ok(!JSON.stringify(pkg).includes('tok'));
    });

    it('refreshes evidence when CI finishes without the score changing', async () => {
        const store = async pkg => cidFor(JSON.stringify(pkg));
        const deps = { store, logger: silent };

        checkRuns = [{ name: 'build', status: 'in_progress', conclusion: null }];
        const first = await computeContributionScore('kiran', 'tok', { evidence: deps });
        const firstCid = db.evidenceCID;
        const scoreBefore = db.score;
        assert.equal(db.evidencePending, true);

        checkRuns = [{ name: 'build', status: 'completed', conclusion: 'success' }];
        const second = await computeContributionScore('kiran', 'tok', { evidence: deps });

        assert.equal(second.finalScore, first.finalScore);
        assert.equal(db.score, scoreBefore);
        assert.notEqual(db.evidenceCID, firstCid);
        assert.equal(db.evidencePending, false);
    });

    it('does not call GitHub again once CI is final and nothing changed', async () => {
        let stores = 0;
        const store = async pkg => { stores++; return cidFor(JSON.stringify(pkg)); };
        const deps = { store, logger: silent };

        await computeContributionScore('kiran', 'tok', { evidence: deps });
        const callsAfterFirst = ciCalls();
        const cid = db.evidenceCID;

        await computeContributionScore('kiran', 'tok', { evidence: deps });

        assert.equal(ciCalls(), callsAfterFirst);
        assert.equal(stores, 1);
        assert.equal(db.evidenceCID, cid);
    });

    it('does not store a second package when a refresh finds the same evidence', async () => {
        let stores = 0;
        const store = async pkg => { stores++; return cidFor(JSON.stringify(pkg)); };
        checkRuns = [{ name: 'build', status: 'queued', conclusion: null }];

        await computeContributionScore('kiran', 'tok', { evidence: { store, logger: silent } });
        await computeContributionScore('kiran', 'tok', { evidence: { store, logger: silent } });

        assert.equal(ciCalls(), 2);   // still pending, so CI was read again
        assert.equal(stores, 1);      // but the package was identical
    });

    it('keeps scoring when the score cannot be saved to MongoDB', async () => {
        failScoreWrite = true;
        let stores = 0;
        const store = async pkg => { stores++; return cidFor(JSON.stringify(pkg)); };

        const out = await computeContributionScore('kiran', 'tok', { evidence: { store, logger: silent } });

        assert.equal(out.finalScore, expectedScore());
        assert.equal(stores, 0);
        assert.equal(db, null);
    });

    it('keeps scoring and links nothing when the CID cannot be saved to MongoDB', async () => {
        failEvidenceWrite = true;
        const store = async pkg => cidFor(JSON.stringify(pkg));

        const out = await computeContributionScore('kiran', 'tok', { evidence: { store, logger: silent } });

        assert.equal(out.finalScore, expectedScore());
        assert.equal(db.score !== undefined, true);
        assert.equal(db.evidenceCID, undefined);
    });

    it('does not report a link when no contribution record matched', async () => {
        evidenceLinkResult = 'nomatch';
        const warnings = [];
        const store = async pkg => cidFor(JSON.stringify(pkg));

        const out = await computeContributionScore('kiran', 'tok', { evidence: { store, logger: { warn: m => warnings.push(m) } } });

        assert.equal(out.finalScore, expectedScore());
        assert.equal(db.evidenceCID, undefined);
        assert.ok(warnings.some(m => /CID not linked/.test(m)));
    });

    it('keeps scoring when IPFS storage fails', async () => {
        const store = async () => { throw new Error('ipfs down'); };

        const out = await computeContributionScore('kiran', 'tok', { evidence: { store, logger: silent } });

        assert.equal(out.finalScore, expectedScore());
        assert.equal(out.prs.length, 1);
        assert.equal(db.evidenceCID, undefined);
    });

    it('keeps scoring when IPFS returns an invalid CID', async () => {
        const store = async () => 'sha256-notacid';

        const out = await computeContributionScore('kiran', 'tok', { evidence: { store, logger: silent } });

        assert.equal(out.finalScore, expectedScore());
        assert.equal(db.evidenceCID, undefined);
    });

    it('gives the same scores whether or not evidence is stored', async () => {
        const ok = await computeContributionScore('kiran', 'tok', {
            evidence: { store: async pkg => cidFor(JSON.stringify(pkg)), logger: silent }
        });
        db = null;
        const failing = await computeContributionScore('kiran', 'tok', {
            evidence: { store: async () => { throw new Error('ipfs down'); }, logger: silent }
        });

        assert.equal(ok.finalScore, failing.finalScore);
        assert.deepEqual(ok.prs, failing.prs);
        assert.equal(ok.reputation, failing.reputation);
    });

    describe('public evidence only', () => {
        it('publishes nothing for a private repository, and scoring is unaffected', async () => {
            repoResponse = { status: 200, body: { private: true, visibility: 'private' } };
            let stores = 0;
            const store = async pkg => { stores++; return cidFor(JSON.stringify(pkg)); };

            const out = await computeContributionScore('kiran', 'tok', { evidence: { store, logger: silent } });

            assert.equal(out.finalScore, expectedScore());
            assert.equal(stores, 0);
            assert.equal(db.evidenceCID, undefined);
            assert.equal(ciCalls(), 0);
        });

        it('publishes nothing when repository visibility cannot be confirmed', async () => {
            repoResponse = { status: 404, body: { message: 'Not Found' } };
            let stores = 0;
            const store = async pkg => { stores++; return cidFor(JSON.stringify(pkg)); };

            const out = await computeContributionScore('kiran', 'tok', { evidence: { store, logger: silent } });

            assert.equal(out.finalScore, expectedScore());
            assert.equal(stores, 0);
            assert.equal(db.evidenceCID, undefined);
        });

        it('publishes on a later run once visibility can be confirmed', async () => {
            const store = async pkg => cidFor(JSON.stringify(pkg));
            repoResponse = { status: 403, body: { message: 'rate limited' } };
            await computeContributionScore('kiran', 'tok', { evidence: { store, logger: silent } });
            assert.equal(db.evidenceCID, undefined);

            repoResponse = { status: 200, body: { private: false, visibility: 'public' } };
            await computeContributionScore('kiran', 'tok', { evidence: { store, logger: silent } });
            assert.ok(db.evidenceCID);
        });

        it('never puts the GitHub token or an email into the published package', async () => {
            const stored = [];
            const store = async pkg => { stored.push(pkg); return cidFor(JSON.stringify(pkg)); };
            checkRuns = [{ name: 'deploy for dev@example.com', status: 'completed', conclusion: 'success' }];

            await computeContributionScore('kiran', 'ghp_abcdefghijklmnopqrstuvwxyz0123456789', { evidence: { store, logger: silent } });

            const text = JSON.stringify(stored[0]);
            assert.ok(!text.includes('ghp_'));
            assert.ok(!text.includes('dev@example.com'));
            assert.equal(stored[0].ciEvidence.runs[0].name, '[redacted]');
        });
    });
});
