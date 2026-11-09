import { describe, it, afterEach, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import {
    checkProofOfBuild,
    classifyRuns,
    commitsForEvent,
    isProofVerified,
    needsProofCheck,
    refreshProofOfBuild,
    summarizeProof
} from '../services/proofOfBuild.js';
import {
    calculateHistoricalReputation,
    calculatePRScore,
    computeContributionScore,
    computeOrgContributors,
    extractPRMetrics
} from '../services/contributionService.js';
import { toPRShape } from '../services/contributionIndex.js';
import User from '../models/User.js';
import ContributionEvent from '../models/ContributionEvent.js';
import ContributionScore from '../models/ContributionScore.js';
import ContributionSyncState from '../models/ContributionSyncState.js';

const realFetch = globalThis.fetch;
const realPat = process.env.GITHUB_PAT;

const TOKEN = 'test-github-token';
const REPO = 'acme/app';
const NOW = new Date('2026-11-09T12:00:00Z');
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

const sha = (seed) => crypto.createHash('sha1').update(String(seed)).digest('hex');
const HEAD = sha('head');
const MERGE = sha('merge');
const COMMITS = [{ sha: HEAD, kind: 'head' }, { sha: MERGE, kind: 'merge' }];

let nextRunId = 1000;
function run(overrides = {}) {
    nextRunId += 1;
    return {
        id: nextRunId,
        head_sha: HEAD,
        event: 'pull_request',
        status: 'completed',
        conclusion: 'success',
        workflow_id: 1,
        run_number: 1,
        ...overrides
    };
}

function jsonResponse(body, { status = 200, headers = {} } = {}) {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

/**
 * Stands in for GitHub. runsBySha maps a commit to its workflow runs; a run can
 * be fetched by id afterwards, like the real API. Records every URL requested.
 */
function fakeGitHub(runsBySha = {}, overrides = {}) {
    const requests = [];
    const allRuns = new Map(Object.values(runsBySha).flat().map((r) => [String(r.id), r]));
    globalThis.fetch = async (url) => {
        const text = String(url);
        requests.push(text);
        for (const [pattern, reply] of Object.entries(overrides)) {
            if (text.includes(pattern)) return reply(text);
        }
        if (text.includes('/search/issues')) return jsonResponse({ total_count: 0, items: [] });
        const byId = text.match(/\/actions\/runs\/(\d+)$/);
        if (byId) {
            const found = allRuns.get(byId[1]);
            return found ? jsonResponse(found) : jsonResponse({ message: 'Not Found' }, { status: 404 });
        }
        const list = text.match(/\/actions\/runs\?head_sha=([0-9a-f]+)/);
        if (list) {
            const runs = runsBySha[list[1]] || [];
            return jsonResponse({ total_count: runs.length, workflow_runs: runs });
        }
        throw new Error(`unexpected request: ${text}`);
    };
    return requests;
}

afterEach(() => {
    globalThis.fetch = realFetch;
    if (realPat === undefined) delete process.env.GITHUB_PAT;
    else process.env.GITHUB_PAT = realPat;
    mock.restoreAll();
});

describe('classifyRuns', () => {
    it('verifies a commit with a successful run on that commit', () => {
        const good = run();
        assert.deepEqual(classifyRuns([good], HEAD), { status: 'verified', run: good });
    });

    it('does not accept a successful run on a different commit', () => {
        assert.equal(classifyRuns([run({ head_sha: sha('other') })], HEAD).status, 'none');
    });

    it('does not accept a run whose SHA only starts with the commit', () => {
        assert.equal(classifyRuns([run({ head_sha: `${HEAD.slice(0, 38)}ff` })], HEAD).status, 'none');
        assert.equal(classifyRuns([run()], HEAD.slice(0, 8)).status, 'none');
    });

    it('ignores letter case in SHAs', () => {
        assert.equal(classifyRuns([run({ head_sha: HEAD.toUpperCase() })], HEAD).status, 'verified');
        assert.equal(classifyRuns([run()], HEAD.toUpperCase()).status, 'verified');
    });

    it('reports none when there are no runs', () => {
        assert.deepEqual(classifyRuns([], HEAD), { status: 'none' });
    });

    for (const event of ['push', 'pull_request', 'merge_group']) {
        it(`counts a run triggered by ${event}`, () => {
            assert.equal(classifyRuns([run({ event })], HEAD).status, 'verified');
        });
    }

    for (const event of ['schedule', 'workflow_dispatch', 'pull_request_target', 'issue_comment', 'workflow_run']) {
        it(`does not count a run triggered by ${event}`, () => {
            assert.equal(classifyRuns([run({ event })], HEAD).status, 'none');
        });

        it(`does not let a failed ${event} run block a commit`, () => {
            const good = run({ workflow_id: 1 });
            const noise = run({ workflow_id: 2, event, conclusion: 'failure' });
            assert.equal(classifyRuns([good, noise], HEAD).status, 'verified');
        });
    }

    it('handles the run shape GitHub really returns, with a nightly job on the same commit', () => {
        const runs = [
            { id: 42540687907, name: 'CodeQL', event: 'schedule', status: 'completed', conclusion: 'failure', head_sha: HEAD, workflow_id: 84668683, run_number: 2256, run_attempt: 1 },
            { id: 41517558311, name: 'ci', event: 'push', status: 'completed', conclusion: 'success', head_sha: HEAD, workflow_id: 10933076, run_number: 2969, run_attempt: 1 },
        ];
        const result = classifyRuns(runs, HEAD);
        assert.equal(result.status, 'verified');
        assert.equal(result.run.id, 41517558311);
    });

    for (const conclusion of ['failure', 'timed_out', 'startup_failure']) {
        it(`fails a commit when a workflow ended in ${conclusion}, even if another passed`, () => {
            assert.equal(classifyRuns([run({ workflow_id: 1 }), run({ workflow_id: 2, conclusion })], HEAD).status, 'failed');
        });
    }

    for (const conclusion of ['cancelled', 'skipped', 'neutral', 'action_required', 'stale']) {
        it(`treats ${conclusion} as neither proof nor failure`, () => {
            assert.equal(classifyRuns([run({ conclusion })], HEAD).status, 'none');
            assert.equal(classifyRuns([run({ workflow_id: 1 }), run({ workflow_id: 2, conclusion })], HEAD).status, 'verified');
        });
    }

    for (const status of ['queued', 'in_progress', 'waiting', 'requested', 'pending']) {
        it(`waits while a run is ${status}`, () => {
            assert.equal(classifyRuns([run({ workflow_id: 1 }), run({ workflow_id: 2, status, conclusion: null })], HEAD).status, 'pending');
        });
    }

    it('reports a failure ahead of a run still in progress', () => {
        const runs = [run({ workflow_id: 1, conclusion: 'failure' }), run({ workflow_id: 2, status: 'in_progress', conclusion: null })];
        assert.equal(classifyRuns(runs, HEAD).status, 'failed');
    });

    it('uses the newest run of a workflow: a later pass replaces an earlier failure', () => {
        const runs = [run({ run_number: 5, conclusion: 'success' }), run({ run_number: 4, conclusion: 'failure' })];
        assert.equal(classifyRuns(runs, HEAD).status, 'verified');
    });

    it('uses the newest run of a workflow: a later failure replaces an earlier pass', () => {
        const runs = [run({ run_number: 4, conclusion: 'success' }), run({ run_number: 5, conclusion: 'failure' })];
        assert.equal(classifyRuns(runs, HEAD).status, 'failed');
    });

    it('does the same whichever order GitHub lists them', () => {
        const runs = [run({ run_number: 4, conclusion: 'failure' }), run({ run_number: 5, conclusion: 'success' })];
        assert.equal(classifyRuns(runs, HEAD).status, 'verified');
    });

    it('tracks the same workflow separately for each trigger', () => {
        const runs = [run({ event: 'push', run_number: 9, conclusion: 'success' }), run({ event: 'pull_request', run_number: 3, conclusion: 'failure' })];
        assert.equal(classifyRuns(runs, HEAD).status, 'failed');
    });
});

describe('commitsForEvent', () => {
    it('returns the head commit first, then the merge commit', () => {
        assert.deepEqual(commitsForEvent({ headSha: HEAD, mergeCommitSha: MERGE }), COMMITS);
    });

    it('leaves out commits GitHub did not report', () => {
        assert.deepEqual(commitsForEvent({ headSha: null, mergeCommitSha: MERGE }), [{ sha: MERGE, kind: 'merge' }]);
        assert.deepEqual(commitsForEvent({}), []);
    });
});

describe('checkProofOfBuild', () => {
    it('verifies through the run on the head commit, and reports which run proved it', async () => {
        const good = run();
        fakeGitHub({ [HEAD]: [good] });
        assert.deepEqual(await checkProofOfBuild({ repo: REPO, commits: COMMITS, token: TOKEN }), {
            status: 'verified', runId: good.id, sha: HEAD, kind: 'head'
        });
    });

    it('looks in the repository the PR was merged into, for that exact commit', async () => {
        const requests = fakeGitHub({ [HEAD]: [run()] });
        await checkProofOfBuild({ repo: REPO, commits: COMMITS, token: TOKEN });
        assert.ok(requests[0].startsWith(`https://api.github.com/repos/${REPO}/actions/runs?head_sha=${HEAD}&`));
    });

    it('confirms the chosen run through verifyProofOfBuild', async () => {
        const good = run();
        const requests = fakeGitHub({ [HEAD]: [good] });
        await checkProofOfBuild({ repo: REPO, commits: COMMITS, token: TOKEN });
        assert.ok(requests.some((url) => url.endsWith(`/repos/${REPO}/actions/runs/${good.id}`)));
    });

    it('does not trust the list if the run does not confirm', async () => {
        const listed = run();
        fakeGitHub({ [HEAD]: [listed] }, { [`/actions/runs/${listed.id}`]: () => jsonResponse({ ...listed, conclusion: 'failure' }) });
        assert.equal((await checkProofOfBuild({ repo: REPO, commits: [COMMITS[0]], token: TOKEN })).status, 'error');
    });

    it('does not check the merge commit once the head commit is verified', async () => {
        const requests = fakeGitHub({ [HEAD]: [run()] });
        await checkProofOfBuild({ repo: REPO, commits: COMMITS, token: TOKEN });
        assert.equal(requests.filter((url) => url.includes(MERGE)).length, 0);
    });

    it('verifies through CI on the merge commit when the head commit has none', async () => {
        const good = run({ head_sha: MERGE, event: 'push' });
        fakeGitHub({ [MERGE]: [good] });
        assert.deepEqual(await checkProofOfBuild({ repo: REPO, commits: COMMITS, token: TOKEN }), {
            status: 'verified', runId: good.id, sha: MERGE, kind: 'merge'
        });
    });

    it('rejects a contribution whose only passing run is on another commit', async () => {
        const elsewhere = run({ head_sha: sha('someone-elses-commit') });
        fakeGitHub({ [HEAD]: [elsewhere], [MERGE]: [elsewhere] });
        assert.equal((await checkProofOfBuild({ repo: REPO, commits: COMMITS, token: TOKEN })).status, 'none');
    });

    it('needs a token, and asks GitHub nothing without one', async () => {
        const requests = fakeGitHub({ [HEAD]: [run()] });
        const result = await checkProofOfBuild({ repo: REPO, commits: COMMITS, token: undefined });
        assert.equal(result.status, 'error');
        assert.match(result.reason, /GITHUB_PAT/);
        assert.equal(requests.length, 0);
    });

    it('reports none when there are no commits to check', async () => {
        fakeGitHub();
        assert.equal((await checkProofOfBuild({ repo: REPO, commits: [], token: TOKEN })).status, 'none');
    });

    it('reports an unknown answer for a GitHub error', async () => {
        fakeGitHub({}, { '/actions/runs?': () => jsonResponse({ message: 'Server Error' }, { status: 500 }) });
        assert.equal((await checkProofOfBuild({ repo: REPO, commits: COMMITS, token: TOKEN })).status, 'error');
    });

    it('reports an unknown answer when GitHub cannot be reached', async () => {
        globalThis.fetch = async () => { throw new Error('network down'); };
        const result = await checkProofOfBuild({ repo: REPO, commits: COMMITS, token: TOKEN });
        assert.equal(result.status, 'error');
        assert.match(result.reason, /network down/);
    });

    it('stops at a rate limit and says so', async () => {
        const requests = fakeGitHub({}, {
            '/actions/runs?': () => jsonResponse({ message: 'rate limited' }, { status: 403, headers: { 'x-ratelimit-remaining': '0' } })
        });
        const result = await checkProofOfBuild({ repo: REPO, commits: COMMITS, token: TOKEN });
        assert.equal(result.status, 'error');
        assert.equal(result.rateLimited, true);
        assert.equal(requests.length, 1);
    });

    it('treats a partial run list as unknown, since a failure could be on the next page', async () => {
        const listed = run();
        fakeGitHub({ [HEAD]: [listed] }, { '/actions/runs?': () => jsonResponse({ total_count: 101, workflow_runs: [listed] }) });
        const result = await checkProofOfBuild({ repo: REPO, commits: [COMMITS[0]], token: TOKEN });
        assert.equal(result.status, 'error');
        assert.match(result.reason, /More than 100/);
    });

    const combinations = [
        ['failed', 'none', 'failed'],
        ['none', 'pending', 'pending'],
        ['failed', 'pending', 'pending'],
        ['none', 'none', 'none'],
    ];
    const runsFor = {
        failed: (head_sha) => [run({ head_sha, conclusion: 'failure' })],
        pending: (head_sha) => [run({ head_sha, status: 'in_progress', conclusion: null })],
        none: () => [],
    };
    for (const [head, merge, expected] of combinations) {
        it(`reports ${expected} when the head commit is ${head} and the merge commit is ${merge}`, async () => {
            fakeGitHub({ [HEAD]: runsFor[head](HEAD), [MERGE]: runsFor[merge](MERGE) });
            assert.equal((await checkProofOfBuild({ repo: REPO, commits: COMMITS, token: TOKEN })).status, expected);
        });
    }

    it('reports unknown rather than failed when one commit could not be checked', async () => {
        fakeGitHub({ [MERGE]: [] }, {
            [`head_sha=${HEAD}`]: () => jsonResponse({ total_count: 1, workflow_runs: [run({ conclusion: 'failure' })] }),
            [`head_sha=${MERGE}`]: () => jsonResponse({ message: 'boom' }, { status: 500 }),
        });
        assert.equal((await checkProofOfBuild({ repo: REPO, commits: COMMITS, token: TOKEN })).status, 'error');
    });

    it('still verifies when the other commit could not be checked', async () => {
        const good = run({ head_sha: MERGE, event: 'push' });
        fakeGitHub({ [MERGE]: [good] }, {
            [`head_sha=${HEAD}`]: () => jsonResponse({ message: 'boom' }, { status: 500 }),
        });
        assert.equal((await checkProofOfBuild({ repo: REPO, commits: COMMITS, token: TOKEN })).status, 'verified');
    });
});

describe('needsProofCheck', () => {
    const recent = new Date(NOW.getTime() - DAY);
    const old = new Date(NOW.getTime() - 30 * DAY);
    const longAgo = new Date(NOW.getTime() - 2 * 60 * MINUTE);
    const justNow = new Date(NOW.getTime() - 5 * MINUTE);

    it('checks a contribution that has no verdict', () => {
        assert.equal(needsProofCheck({ mergedAt: old }, NOW), true);
    });

    it('never rechecks a verified contribution', () => {
        assert.equal(needsProofCheck({ mergedAt: recent, proofOfBuild: { status: 'verified', checkedAt: longAgo } }, NOW), false);
    });

    for (const status of ['failed', 'pending', 'none']) {
        it(`rechecks ${status} when recently merged and last checked a while ago`, () => {
            assert.equal(needsProofCheck({ mergedAt: recent, proofOfBuild: { status, checkedAt: longAgo } }, NOW), true);
        });

        it(`does not recheck ${status} just after the last check`, () => {
            assert.equal(needsProofCheck({ mergedAt: recent, proofOfBuild: { status, checkedAt: justNow } }, NOW), false);
        });

        it(`stops rechecking ${status} once the contribution is old`, () => {
            assert.equal(needsProofCheck({ mergedAt: old, proofOfBuild: { status, checkedAt: longAgo } }, NOW), false);
        });
    }
});

function fakeEventModel(events) {
    return {
        writes: [],
        find() {
            const query = { select: () => query, sort: () => query, lean: async () => events };
            return query;
        },
        async bulkWrite(ops) { this.writes.push(...ops); }
    };
}

function indexed(n, overrides = {}) {
    return {
        repo: REPO,
        repoKey: REPO,
        prNumber: n,
        headSha: sha(`head-${n}`),
        mergeCommitSha: sha(`merge-${n}`),
        mergedAt: new Date(NOW.getTime() - n * MINUTE),
        ...overrides
    };
}

describe('refreshProofOfBuild', () => {
    it('stores a verified result with its evidence', async () => {
        const event = indexed(1);
        const good = run({ head_sha: event.headSha });
        fakeGitHub({ [event.headSha]: [good] });
        const Event = fakeEventModel([event]);
        const meta = await refreshProofOfBuild({ filter: {}, token: TOKEN, Event, now: NOW });

        assert.deepEqual(Event.writes, [{
            updateOne: {
                filter: { repoKey: REPO, prNumber: 1 },
                update: { $set: { proofOfBuild: { status: 'verified', runId: good.id, sha: event.headSha, kind: 'head', checkedAt: NOW } } }
            }
        }]);
        assert.deepEqual(meta, { checked: 1, errors: 0, rateLimited: false, deferred: 0 });
    });

    it('stores failed, pending and none so they are not looked up constantly', async () => {
        const events = [indexed(1), indexed(2), indexed(3)];
        fakeGitHub({
            [events[0].headSha]: [run({ head_sha: events[0].headSha, conclusion: 'failure' })],
            [events[1].headSha]: [run({ head_sha: events[1].headSha, status: 'queued', conclusion: null })],
        });
        const Event = fakeEventModel(events);
        await refreshProofOfBuild({ filter: {}, token: TOKEN, Event, now: NOW });
        assert.deepEqual(Event.writes.map((w) => w.updateOne.update.$set.proofOfBuild.status), ['failed', 'pending', 'none']);
    });

    it('never stores an unknown answer, so it is tried again', async () => {
        fakeGitHub({}, { '/actions/runs?': () => jsonResponse({ message: 'boom' }, { status: 500 }) });
        const Event = fakeEventModel([indexed(1)]);
        const meta = await refreshProofOfBuild({ filter: {}, token: TOKEN, Event, now: NOW });
        assert.deepEqual(Event.writes, []);
        assert.equal(meta.errors, 1);
        assert.match(meta.lastError, /500/);
    });

    it('does not look up a contribution already verified', async () => {
        const requests = fakeGitHub();
        const Event = fakeEventModel([indexed(1, { proofOfBuild: { status: 'verified', checkedAt: NOW } })]);
        await refreshProofOfBuild({ filter: {}, token: TOKEN, Event, now: NOW });
        assert.equal(requests.length, 0);
    });

    it('skips a contribution with no commit SHAs yet', async () => {
        const requests = fakeGitHub();
        const Event = fakeEventModel([indexed(1, { headSha: null, mergeCommitSha: null })]);
        await refreshProofOfBuild({ filter: {}, token: TOKEN, Event, now: NOW });
        assert.equal(requests.length, 0);
        assert.deepEqual(Event.writes, []);
    });

    it('checks at most 100 per sync, and reports the rest as deferred', async () => {
        fakeGitHub();
        const Event = fakeEventModel(Array.from({ length: 130 }, (_, i) => indexed(i + 1)));
        const meta = await refreshProofOfBuild({ filter: {}, token: TOKEN, Event, now: NOW });
        assert.equal(meta.checked, 100);
        assert.equal(meta.deferred, 30);
    });

    it('stops asking GitHub after a rate limit', async () => {
        const requests = fakeGitHub({}, {
            '/actions/runs?': () => jsonResponse({ message: 'limited' }, { status: 429, headers: { 'retry-after': '60' } })
        });
        const Event = fakeEventModel(Array.from({ length: 40 }, (_, i) => indexed(i + 1)));
        const meta = await refreshProofOfBuild({ filter: {}, token: TOKEN, Event, now: NOW });
        assert.equal(meta.rateLimited, true);
        assert.ok(requests.length <= 4, `made ${requests.length} requests`);
        assert.deepEqual(Event.writes, []);
    });

    it('stores nothing and reports the reason without a token', async () => {
        const Event = fakeEventModel([indexed(1)]);
        const meta = await refreshProofOfBuild({ filter: {}, token: null, Event, now: NOW });
        assert.deepEqual(Event.writes, []);
        assert.match(meta.lastError, /GITHUB_PAT/);
    });
});

describe('isProofVerified and summarizeProof', () => {
    it('only accepts the verified status', () => {
        assert.equal(isProofVerified({ proofOfBuild: { status: 'verified' } }), true);
        for (const status of ['failed', 'pending', 'none', undefined]) {
            assert.equal(isProofVerified({ proofOfBuild: { status } }), false);
        }
        assert.equal(isProofVerified({}), false);
    });

    it('counts each verdict', () => {
        const events = [
            { proofOfBuild: { status: 'verified' } },
            { proofOfBuild: { status: 'verified' } },
            { proofOfBuild: { status: 'failed' } },
            { proofOfBuild: { status: 'none' } },
            {},
        ];
        assert.deepEqual(summarizeProof(events), { verified: 2, failed: 1, pending: 0, none: 1, unchecked: 1 });
    });
});

describe('scoring is gated by Proof-of-Build', () => {
    const repoConfig = {
        name: REPO,
        targetBranches: ['main'],
        weights: { impact: 0.3, complexity: 0.2, quality: 0.2, review: 0.2, priority: 0.1 },
        bountyPool: 100,
    };
    const CONTRIBUTOR = 'alice';

    function storedEvent(n, proofStatus, overrides = {}) {
        return {
            type: 'pr_merge',
            repo: REPO,
            repoKey: REPO,
            prNumber: n,
            author: CONTRIBUTOR,
            authorKey: CONTRIBUTOR,
            authorAvatar: 'https://avatars.example/a',
            title: `PR ${n}`,
            url: `https://github.com/${REPO}/pull/${n}`,
            mergedAt: new Date(NOW.getTime() - n * DAY),
            headSha: sha(`head-${n}`),
            mergeCommitSha: sha(`merge-${n}`),
            stats: { additions: 200, deletions: 40, changedFiles: 8, commits: 4, comments: 1, reviewComments: 3, merged: true, labels: [] },
            detailsFetchedAt: NOW,
            ...(proofStatus && { proofOfBuild: { status: proofStatus, checkedAt: new Date(), ...(proofStatus === 'verified' && { runId: n, sha: sha(`head-${n}`), kind: 'head' }) } }),
            ...overrides
        };
    }

    let store;
    let persisted;

    function query(value) {
        const q = { select: () => q, sort: () => q, lean: async () => value };
        return q;
    }

    function useStore(events, { org = null } = {}) {
        store = events;
        persisted = mock.method(ContributionScore, 'findOneAndUpdate', async () => ({}));
        mock.method(ContributionEvent, 'find', () => query(store));
        mock.method(ContributionEvent, 'bulkWrite', async (ops) => {
            for (const { updateOne } of ops) {
                const target = store.find((e) => e.prNumber === updateOne.filter.prNumber);
                Object.assign(target, updateOne.update.$set);
            }
        });
        mock.method(ContributionSyncState, 'find', () => query([]));
        mock.method(ContributionSyncState, 'updateOne', async () => ({}));
        mock.method(User, 'find', async () => [{ repositories: [repoConfig] }]);
        mock.method(User, 'findOne', async () => null);
        mock.method(User, 'findById', async () => org);
    }

    const pointsFor = (verifiedEvents, event) => {
        const metrics = verifiedEvents.map((e) => extractPRMetrics(toPRShape(e)));
        const accepted = metrics.length;
        const { reputation } = calculateHistoricalReputation({
            acceptedPRs: accepted,
            avgReviewScore: metrics.reduce((sum, m) => sum + m.review, 0) / accepted,
            historicalImpact: metrics.reduce((sum, m) => sum + m.impact, 0),
            consistency: accepted === 1 ? 0.5 : undefined,
        });
        const { score } = calculatePRScore(extractPRMetrics(toPRShape(event)), repoConfig.weights, { reputation, timestamps: [] });
        return Math.round(score * 20 * 10) / 10;
    };

    it('scores a verified contribution exactly as before', async () => {
        fakeGitHub();
        const event = storedEvent(1, 'verified');
        useStore([event]);
        const result = await computeContributionScore(CONTRIBUTOR, TOKEN);
        assert.equal(result.prs.length, 1);
        assert.equal(result.prs[0].score, pointsFor([event], event));
        assert.equal(result.finalScore, pointsFor([event], event));
        assert.equal(result.prs[0].proofOfBuild.status, 'verified');
    });

    for (const status of ['failed', 'pending', 'none']) {
        it(`does not score a contribution whose verdict is ${status}`, async () => {
            fakeGitHub();
            useStore([storedEvent(1, status)]);
            const result = await computeContributionScore(CONTRIBUTOR, TOKEN);
            assert.equal(result.finalScore, 0);
            assert.deepEqual(result.prs, []);
            assert.deepEqual(result.unverifiedPrs.map((p) => p.proofOfBuild), [status]);
            assert.equal(persisted.mock.callCount(), 0);
        });
    }

    it('checks an unverified contribution with GitHub, then scores it when CI passed', async () => {
        const event = storedEvent(1, null);
        fakeGitHub({ [event.headSha]: [run({ head_sha: event.headSha })] });
        useStore([event]);
        const result = await computeContributionScore(CONTRIBUTOR, TOKEN);
        assert.equal(result.prs.length, 1);
        assert.ok(result.finalScore > 0);
        assert.equal(result.meta.proofOfBuild.checked, 1);
    });

    it('does not score a contribution whose only passing run is on another commit', async () => {
        const event = storedEvent(1, null);
        fakeGitHub({ [event.headSha]: [run({ head_sha: sha('another-commit') })] });
        useStore([event]);
        const result = await computeContributionScore(CONTRIBUTOR, TOKEN);
        assert.equal(result.finalScore, 0);
        assert.deepEqual(result.unverifiedPrs.map((p) => p.proofOfBuild), ['none']);
    });

    it('scores nothing when GitHub cannot confirm anything, and marks it unchecked', async () => {
        fakeGitHub({}, { '/actions/runs?': () => jsonResponse({ message: 'boom' }, { status: 500 }) });
        useStore([storedEvent(1, null)]);
        const result = await computeContributionScore(CONTRIBUTOR, TOKEN);
        assert.equal(result.finalScore, 0);
        assert.deepEqual(result.unverifiedPrs.map((p) => p.proofOfBuild), ['unchecked']);
        assert.equal(result.meta.proofOfBuild.errors, 1);
    });

    it('scores nothing new without a token, but keeps what is already verified', async () => {
        delete process.env.GITHUB_PAT;
        const requests = fakeGitHub();
        useStore([storedEvent(1, 'verified'), storedEvent(2, null)]);
        const result = await computeContributionScore(CONTRIBUTOR, null);
        assert.deepEqual(result.prs.map((p) => p.id), [1]);
        assert.deepEqual(result.unverifiedPrs.map((p) => p.id), [2]);
        assert.equal(requests.filter((url) => url.includes('/actions/')).length, 0);
    });

    it('an unverified contribution adds nothing to the score or to reputation', async () => {
        fakeGitHub();
        const verified = storedEvent(1, 'verified');
        useStore([verified]);
        const alone = await computeContributionScore(CONTRIBUTOR, TOKEN);

        mock.restoreAll();
        fakeGitHub();
        useStore([verified, storedEvent(2, 'failed'), storedEvent(3, 'none')]);
        const withOthers = await computeContributionScore(CONTRIBUTOR, TOKEN);

        assert.equal(withOthers.finalScore, alone.finalScore);
        assert.equal(withOthers.reputation, alone.reputation);
        assert.equal(withOthers.reputationEvidence.acceptedPRs, 1);
    });

    it('reports every contribution that was not scored, and the counts', async () => {
        fakeGitHub();
        useStore([storedEvent(1, 'verified'), storedEvent(2, 'failed'), storedEvent(3, 'pending')]);
        const result = await computeContributionScore(CONTRIBUTOR, TOKEN);
        assert.deepEqual(result.unverifiedPrs, [
            { id: 2, repo: REPO, link: `https://github.com/${REPO}/pull/2`, proofOfBuild: 'failed' },
            { id: 3, repo: REPO, link: `https://github.com/${REPO}/pull/3`, proofOfBuild: 'pending' },
        ]);
        assert.deepEqual(
            { verified: result.meta.proofOfBuild.verified, failed: result.meta.proofOfBuild.failed, pending: result.meta.proofOfBuild.pending },
            { verified: 1, failed: 1, pending: 1 }
        );
    });

    it('only persists scores for verified contributions', async () => {
        fakeGitHub();
        useStore([storedEvent(1, 'verified'), storedEvent(2, 'failed')]);
        await computeContributionScore(CONTRIBUTOR, TOKEN);
        assert.equal(persisted.mock.callCount(), 1);
        assert.equal(persisted.mock.calls[0].arguments[0].prNumber, 1);
    });

    const ORG = { role: 'organization', repositories: [repoConfig] };

    it('organization totals count only verified contributions', async () => {
        fakeGitHub();
        useStore([storedEvent(1, 'verified'), storedEvent(2, 'failed'), storedEvent(3, 'none')], { org: ORG });
        const { contributors, recentEvents, meta } = await computeOrgContributors('org-id', TOKEN);
        assert.equal(contributors.length, 1);
        assert.equal(contributors[0].prCount, 1);
        assert.equal(recentEvents.length, 1);
        assert.equal(meta.proofOfBuild.verified, 1);
        assert.equal(meta.proofOfBuild.failed, 1);
    });

    it('a contributor with nothing verified earns nothing from the organization', async () => {
        fakeGitHub();
        useStore([storedEvent(1, 'failed')], { org: ORG });
        const { contributors, recentEvents } = await computeOrgContributors('org-id', TOKEN);
        assert.deepEqual(contributors, []);
        assert.deepEqual(recentEvents, []);
    });

    it('organization scoring looks up contributions that have no verdict', async () => {
        const event = storedEvent(1, null);
        fakeGitHub({ [event.headSha]: [run({ head_sha: event.headSha })] });
        useStore([event], { org: ORG });
        const { contributors } = await computeOrgContributors('org-id', TOKEN);
        assert.equal(contributors.length, 1);
    });
});

describe('webhook payouts are gated by Proof-of-Build', () => {
    const SECRET = crypto.randomBytes(32).toString('hex');
    const WALLET = '0x1234567890abcdef';
    let server;
    let baseUrl;
    let realWebhookSecret;

    const orgUser = {
        role: 'organization',
        repositories: [{ name: REPO, targetBranches: ['main'], weights: { impact: 0.2, complexity: 0.2, quality: 0.2, review: 0.2, priority: 0.2 } }],
    };

    before(async () => {
        realWebhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
        process.env.GITHUB_WEBHOOK_SECRET = SECRET;
        const router = (await import('../routes/webhook.js')).default;
        const app = express();
        app.use(express.json({ verify: (req, _res, buffer) => { req.rawBody = buffer; } }));
        app.use('/webhook', router);
        await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    after(async () => {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
        if (realWebhookSecret === undefined) delete process.env.GITHUB_WEBHOOK_SECRET;
        else process.env.GITHUB_WEBHOOK_SECRET = realWebhookSecret;
    });

    beforeEach(() => {
        process.env.GITHUB_PAT = TOKEN;
    });

    function mergedPayload() {
        return {
            action: 'closed',
            repository: { full_name: REPO },
            pull_request: {
                number: 5,
                merged: true,
                user: { login: 'alice' },
                base: { ref: 'main', repo: { full_name: REPO } },
                head: { sha: HEAD },
                merge_commit_sha: MERGE,
                additions: 120, deletions: 30, changed_files: 5, commits: 3, comments: 0, review_comments: 4, labels: [],
            },
        };
    }

    async function deliver(payload, wallet = null) {
        mock.method(User, 'findOne', async (query) => (query.role ? orgUser : { github: 'alice', reputation: 100, wallet }));
        const raw = JSON.stringify(payload);
        const github = globalThis.fetch;
        const signature = `sha256=${crypto.createHmac('sha256', SECRET).update(raw).digest('hex')}`;
        // The request to the test server must not go through the stand-in for GitHub.
        globalThis.fetch = async (url, init) => (String(url).startsWith(baseUrl) ? realFetch(url, init) : github(url, init));
        const response = await fetch(`${baseUrl}/webhook/github`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-github-event': 'pull_request', 'x-hub-signature-256': signature },
            body: raw,
        });
        return { status: response.status, body: await response.json() };
    }

    it('scores a merged PR whose commit passed CI', async () => {
        const good = run();
        fakeGitHub({ [HEAD]: [good] });
        const { status, body } = await deliver(mergedPayload());
        assert.equal(status, 200);
        assert.ok(body.score > 0);
        assert.ok(body.payout > 0);
        assert.equal(body.proofOfBuild.runId, good.id);
    });

    it('accepts CI that ran on the merge commit instead of the head commit', async () => {
        const good = run({ head_sha: MERGE, event: 'push' });
        fakeGitHub({ [MERGE]: [good] });
        const { body } = await deliver(mergedPayload());
        assert.ok(body.score > 0);
        assert.equal(body.proofOfBuild.kind, 'merge');
    });

    const blocked = {
        'no CI run exists': {},
        'CI failed': { [HEAD]: [run({ conclusion: 'failure' })] },
        'CI is still running': { [HEAD]: [run({ status: 'in_progress', conclusion: null })] },
        'the only passing run is on another commit': { [HEAD]: [run({ head_sha: sha('elsewhere') })] },
    };
    for (const [name, runs] of Object.entries(blocked)) {
        it(`neither scores nor pays when ${name}`, async () => {
            fakeGitHub(runs);
            // A linked wallet means a payout would be attempted if the gate let this through.
            const { status, body } = await deliver(mergedPayload(), WALLET);
            assert.equal(status, 200);
            assert.equal(body.score, 0);
            assert.equal(body.payout, 0);
            assert.equal(body.flowStatus, 'skipped');
            assert.notEqual(body.proofOfBuild.status, 'verified');
        });
    }

    it('neither scores nor pays when the check itself fails', async () => {
        fakeGitHub({}, { '/actions/runs?': () => jsonResponse({ message: 'boom' }, { status: 500 }) });
        const { status, body } = await deliver(mergedPayload(), WALLET);
        assert.equal(status, 200);
        assert.equal(body.score, 0);
        assert.equal(body.proofOfBuild.status, 'error');
    });

    it('neither scores nor pays without a GitHub token', async () => {
        delete process.env.GITHUB_PAT;
        fakeGitHub({ [HEAD]: [run()] });
        const { body } = await deliver(mergedPayload(), WALLET);
        assert.equal(body.score, 0);
        assert.match(body.proofOfBuild.reason, /GITHUB_PAT/);
    });

    it('does not ask GitHub about a repository nobody tracks', async () => {
        const requests = fakeGitHub();
        const payload = mergedPayload();
        mock.method(User, 'findOne', async () => null);
        const raw = JSON.stringify(payload);
        const signature = `sha256=${crypto.createHmac('sha256', SECRET).update(raw).digest('hex')}`;
        const response = await realFetch(`${baseUrl}/webhook/github`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-github-event': 'pull_request', 'x-hub-signature-256': signature },
            body: raw,
        });
        assert.equal(response.status, 200);
        assert.equal(requests.length, 0);
    });
});
