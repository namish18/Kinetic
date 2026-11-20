import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import User from '../models/User.js';
import ContributionScore from '../models/ContributionScore.js';
import ContributionEvent from '../models/ContributionEvent.js';
import ContributionSyncState from '../models/ContributionSyncState.js';
import { computeOrgContributors } from '../services/contributionService.js';
import { getEvidenceCIDs } from '../services/evidenceService.js';

async function realCid(text = 'evidence') {
    const digest = await sha256.digest(new TextEncoder().encode(text));
    return CID.createV1(0x0129, digest).toString();
}

const silent = { warn() { }, error() { }, log() { } };

const eventFor = (prNumber, author = 'kiran') => ({
    prNumber,
    title: `PR ${prNumber}`,
    url: `https://github.com/org/repo/pull/${prNumber}`,
    mergedAt: new Date('2026-11-01T10:00:00Z'),
    repo: 'org/repo',
    repoKey: 'org/repo',
    author,
    authorKey: author,
    authorAvatar: 'https://example.com/a.png',
    stats: { additions: 420, deletions: 130, changedFiles: 9, commits: 5, comments: 2, reviewComments: 6, merged: true, labels: [] }
});

describe('computeOrgContributors uses real CIDs only', () => {
    const originals = {};
    let storedScores;
    let failLookup;

    beforeEach(() => {
        storedScores = [];
        failLookup = false;
        originals.userFindById = User.findById;
        originals.userFindOne = User.findOne;
        originals.syncFind = ContributionSyncState.find;
        originals.syncUpdate = ContributionSyncState.updateOne;
        originals.eventFind = ContributionEvent.find;
        originals.scoreFind = ContributionScore.find;
        originals.fetch = globalThis.fetch;
        originals.warn = console.warn;
        console.warn = () => { };

        User.findById = async () => ({ role: 'organization', repositories: [{ name: 'org/repo' }] });
        User.findOne = async () => null;
        ContributionSyncState.find = () => ({ lean: async () => [] });
        ContributionSyncState.updateOne = async () => ({});
        ContributionEvent.find = () => {
            const chain = {
                sorted: false,
                sort() { chain.sorted = true; return chain; },
                select() { return chain; },
                lean: async () => (chain.sorted ? [eventFor(1), eventFor(2), eventFor(3)] : [])
            };
            return chain;
        };
        ContributionScore.find = () => ({
            select() { return this; },
            lean: async () => {
                if (failLookup) throw new Error('mongo down');
                return storedScores;
            }
        });
        globalThis.fetch = async () => Response.json({ items: [], total_count: 0 });
    });

    afterEach(() => {
        User.findById = originals.userFindById;
        User.findOne = originals.userFindOne;
        ContributionSyncState.find = originals.syncFind;
        ContributionSyncState.updateOne = originals.syncUpdate;
        ContributionEvent.find = originals.eventFind;
        ContributionScore.find = originals.scoreFind;
        globalThis.fetch = originals.fetch;
        console.warn = originals.warn;
    });


    it('returns the stored evidence CID for a contribution that has one', async () => {
        const cid = await realCid('pr1');
        storedScores = [{ username: 'kiran', repository: 'org/repo', prNumber: 1, evidenceCID: cid }];

        const out = await computeOrgContributors('org1', 'tok');

        assert.equal(out.recentEvents.length, 3);
        assert.equal(out.recentEvents.filter(e => e.cid === cid).length, 1);
        assert.equal(out.recentEvents.filter(e => e.cid === null).length, 2);
    });

    it('returns null, not a made up CID, when no evidence is stored', async () => {
        const out = await computeOrgContributors('org1', 'tok');
        assert.ok(out.recentEvents.length > 0);
        for (const e of out.recentEvents) assert.equal(e.cid, null);
    });

    it('returns null when the stored value is not a valid CID', async () => {
        storedScores = [
            { username: 'kiran', repository: 'org/repo', prNumber: 1, evidenceCID: 'sha256-abc123' },
            { username: 'kiran', repository: 'org/repo', prNumber: 2, evidenceCID: 'bafybei1a2b3c4d' }
        ];
        const out = await computeOrgContributors('org1', 'tok');
        for (const e of out.recentEvents) assert.equal(e.cid, null);
    });

    it('does not expose the internal prNumber field', async () => {
        const out = await computeOrgContributors('org1', 'tok');
        for (const e of out.recentEvents) assert.equal('prNumber' in e, false);
    });

    it('still returns contributors with null CIDs when the CID lookup fails', async () => {
        const normal = await computeOrgContributors('org1', 'tok');
        failLookup = true;
        const failed = await computeOrgContributors('org1', 'tok');

        assert.equal(failed.recentEvents.length, normal.recentEvents.length);
        for (const e of failed.recentEvents) assert.equal(e.cid, null);
        assert.deepEqual(failed.contributors, normal.contributors);
    });

    it('does not change contributor scores when CIDs are present', async () => {
        const without = await computeOrgContributors('org1', 'tok');
        storedScores = [{ username: 'kiran', repository: 'org/repo', prNumber: 1, evidenceCID: await realCid('pr1') }];
        const withCid = await computeOrgContributors('org1', 'tok');
        assert.deepEqual(withCid.contributors, without.contributors);
    });

    it('contributionService.js no longer generates random identifiers', () => {
        const source = readFileSync(new URL('../services/contributionService.js', import.meta.url), 'utf8');
        assert.doesNotMatch(source, /Math\.random/);
        assert.doesNotMatch(source, /bafybei\$\{/);
    });
});

describe('getEvidenceCIDs', () => {
    it('returns an empty map without querying when there is nothing to look up', async () => {
        let queried = false;
        const model = { find() { queried = true; } };
        const out = await getEvidenceCIDs([], { model, logger: silent });
        assert.equal(out.size, 0);
        assert.equal(queried, false);
    });

    it('only keeps valid CIDs', async () => {
        const good = await realCid('good');
        const model = {
            find: () => ({
                select() { return this; },
                lean: async () => [
                    { username: 'a', repository: 'o/r', prNumber: 1, evidenceCID: good },
                    { username: 'a', repository: 'o/r', prNumber: 2, evidenceCID: null },
                    { username: 'a', repository: 'o/r', prNumber: 3, evidenceCID: 'sha256-xyz' }
                ]
            })
        };
        const out = await getEvidenceCIDs(
            [1, 2, 3].map(n => ({ username: 'a', repository: 'o/r', prNumber: n })),
            { model, logger: silent }
        );
        assert.equal(out.size, 1);
        assert.equal(out.get('a|o/r|1'), good);
    });
});
