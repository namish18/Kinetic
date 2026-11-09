import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    DETAIL_REFRESH_DAYS,
    DETAIL_REFRESH_MIN_AGE_HOURS,
    attributionFromEvent,
    buildSearchQuery,
    detailsFromPR,
    eventFromSearchItem,
    needsDetails,
    syncIndex,
    toPRShape,
    upsertEvents
} from '../services/contributionIndex.js';
import { extractPRMetrics, calculatePRScore } from '../services/contributionService.js';

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});

const NOW = new Date('2026-11-07T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function jsonResponse(body, { status = 200, headers = {} } = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json', ...headers }
    });
}

function searchItem(n, { repo = 'nodejs/node', login = 'alice', mergedAt = '2026-11-01T10:00:00Z', createdAt = '2026-10-30T09:00:00Z' } = {}) {
    return {
        number: n,
        created_at: createdAt,
        title: `PR ${n}`,
        html_url: `https://github.com/${repo}/pull/${n}`,
        repository_url: `https://api.github.com/repos/${repo}`,
        user: { login, id: 1, avatar_url: 'https://avatars.example/1' },
        pull_request: { url: `https://api.github.com/repos/${repo}/pulls/${n}`, merged_at: mergedAt }
    };
}

const rawPR = {
    number: 7,
    title: 'PR 7',
    html_url: 'https://github.com/nodejs/node/pull/7',
    created_at: '2026-10-30T09:00:00Z',
    merged_at: '2026-11-01T10:00:00Z',
    merged: true,
    base: { repo: { full_name: 'nodejs/node' } },
    head: { sha: 'abc' },
    merge_commit_sha: 'def',
    merged_by: { login: 'bob', id: 2 },
    additions: 120,
    deletions: 300,
    changed_files: 6,
    commits: 3,
    comments: 2,
    review_comments: 4,
    labels: [{ name: 'priority-high' }, { name: 'lib' }]
};

/** In-memory stand-ins for the Mongoose models used by syncIndex. */
function fakeModels({ cursors = [], events = [], bulkWriteError = null } = {}) {
    const calls = { eventWrites: [], cursorUpdates: [] };
    const Event = {
        async bulkWrite(ops) {
            calls.eventWrites.push(ops);
            if (bulkWriteError && ops[0]?.updateOne?.upsert) throw bulkWriteError;
            return { upsertedCount: ops.filter(o => o.updateOne.upsert).length };
        },
        find() {
            return { select: () => ({ lean: async () => events }) };
        }
    };
    const SyncState = {
        find() {
            return { lean: async () => cursors };
        },
        async updateOne(filter, update, options) {
            calls.cursorUpdates.push({ filter, update, options });
        }
    };
    return { Event, SyncState, calls };
}

test('buildSearchQuery: full history without a cursor, merged-since with one', () => {
    assert.equal(
        buildSearchQuery(['author:alice'], null),
        'author:alice is:pr is:merged updated:>2024-01-01'
    );
    assert.equal(
        buildSearchQuery(['repo:a/b', 'repo:c/d'], new Date('2026-11-05T08:30:00.123Z')),
        'repo:a/b repo:c/d is:pr is:merged merged:>=2026-11-04T08:30:00Z'
    );
});

test('an indexed event scores exactly like the raw GitHub PR', () => {
    const event = { ...eventFromSearchItem(searchItem(7), NOW), ...detailsFromPR(rawPR, NOW) };

    assert.equal(event.repoKey, 'nodejs/node');
    assert.equal(event.authorKey, 'alice');
    assert.equal(event.mergeCommitSha, 'def');
    assert.deepEqual(extractPRMetrics(toPRShape(event)), extractPRMetrics(rawPR));
    assert.equal(toPRShape(event).merged_at, rawPR.merged_at);
});

test('needsDetails: missing details, recent refresh window at most once a day, registered repos only', () => {
    const registered = new Set(['nodejs/node']);
    // Details fetched after attribution was added always carry mergedBy
    const base = { repoKey: 'nodejs/node', mergedBy: { login: 'bob', id: 2 } };
    const recent = new Date(NOW.getTime() - (DETAIL_REFRESH_DAYS - 1) * DAY);
    const old = new Date(NOW.getTime() - (DETAIL_REFRESH_DAYS + 1) * DAY);
    const HOUR = 60 * 60 * 1000;
    const fetchedOld = new Date(NOW.getTime() - (DETAIL_REFRESH_MIN_AGE_HOURS + 1) * HOUR);
    const fetchedRecently = new Date(NOW.getTime() - (DETAIL_REFRESH_MIN_AGE_HOURS - 1) * HOUR);

    assert.equal(needsDetails({ ...base, detailsFetchedAt: null, mergedAt: old }, registered, NOW), true);
    assert.equal(needsDetails({ ...base, detailsFetchedAt: null, mergedAt: NOW }, registered, NOW), true);
    assert.equal(needsDetails({ ...base, detailsFetchedAt: fetchedOld, mergedAt: recent }, registered, NOW), true);
    assert.equal(needsDetails({ ...base, detailsFetchedAt: fetchedRecently, mergedAt: recent }, registered, NOW), false);
    assert.equal(needsDetails({ ...base, detailsFetchedAt: fetchedOld, mergedAt: old }, registered, NOW), false);
    assert.equal(needsDetails({ repoKey: 'other/repo', detailsFetchedAt: null, mergedAt: recent }, registered, NOW), false);
});

test('event mapping carries repository, PR, commit SHA, author and merge event', () => {
    const event = { ...eventFromSearchItem(searchItem(7), NOW), ...detailsFromPR(rawPR, NOW) };

    assert.deepEqual(event.mergedBy, { login: 'bob', id: 2 });
    assert.deepEqual(attributionFromEvent(event), {
        repo: 'nodejs/node',
        prNumber: 7,
        commitSha: 'def',
        headSha: 'abc',
        author: 'alice',
        authorId: 1,
        mergedAt: '2026-11-01T10:00:00Z',
        mergedBy: { login: 'bob', id: 2 }
    });

    // GitHub reported no merger: stored as null, so it is not "missing"
    const noMerger = detailsFromPR({ ...rawPR, merged_by: null }, NOW);
    assert.equal(noMerger.mergedBy, null);
    assert.equal(attributionFromEvent({ ...event, ...noMerger }).mergedBy, null);
});

test('indexed PRs keep created_at, so the velocity penalty applies to them', () => {
    const fromSearch = eventFromSearchItem(searchItem(7), NOW);
    assert.deepEqual(fromSearch.createdAt, new Date('2026-10-30T09:00:00Z'));
    assert.equal(detailsFromPR(rawPR, NOW).createdAt.toISOString(), '2026-10-30T09:00:00.000Z');

    const event = { ...fromSearch, ...detailsFromPR(rawPR, NOW) };
    assert.equal(toPRShape(event).created_at, rawPR.created_at);

    // Two indexed PRs opened 4 minutes apart: same timestamps as the raw PRs
    const a = toPRShape({ ...event, createdAt: new Date('2026-11-03T10:00:00Z') });
    const b = toPRShape({ ...event, createdAt: new Date('2026-11-03T10:04:00Z') });
    const timestamps = [a.created_at, b.created_at];
    const metrics = extractPRMetrics(b);
    const penalized = calculatePRScore(metrics, null, { reputation: 100, timestamps });
    const single = calculatePRScore(metrics, null, { reputation: 100, timestamps: [a.created_at] });
    assert.equal(penalized.spamPenalty, 0.7273);
    assert.equal(penalized.isSpamFlagged, true);
    assert.ok(penalized.score < single.score);

    // An event indexed before createdAt existed still maps cleanly
    const { createdAt, ...legacy } = event;
    assert.equal(toPRShape(legacy).created_at, null);
});

test('toPRShape round-trip is unchanged by attribution fields', () => {
    const event = { ...eventFromSearchItem(searchItem(7), NOW), ...detailsFromPR(rawPR, NOW) };
    const { mergedBy, mergeCommitSha, headSha, ...withoutAttribution } = event;

    assert.deepEqual(toPRShape(event), toPRShape(withoutAttribution));
    assert.deepEqual(extractPRMetrics(toPRShape(event)), extractPRMetrics(rawPR));
});

test('needsDetails: details fetched before attribution existed are fetched once more', () => {
    const registered = new Set(['nodejs/node']);
    const HOUR = 60 * 60 * 1000;
    const old = new Date(NOW.getTime() - (DETAIL_REFRESH_DAYS + 1) * DAY);
    const recent = new Date(NOW.getTime() - (DETAIL_REFRESH_DAYS - 1) * DAY);
    const fetchedRecently = new Date(NOW.getTime() - (DETAIL_REFRESH_MIN_AGE_HOURS - 1) * HOUR);
    const legacy = { repoKey: 'nodejs/node', detailsFetchedAt: new Date('2026-10-01T00:00:00Z'), mergedAt: old, mergeCommitSha: 'def' };

    // Old PR whose details predate mergedBy: backfilled
    assert.equal(needsDetails(legacy, registered, NOW), true);
    // After the backfill (mergedBy set, or null when GitHub has none) it is done
    assert.equal(needsDetails({ ...legacy, mergedBy: { login: 'bob', id: 2 } }, registered, NOW), false);
    assert.equal(needsDetails({ ...legacy, mergedBy: null }, registered, NOW), false);
    // Backfilled recent PRs still follow the 24h / 14-day refresh rule
    assert.equal(needsDetails({ ...legacy, mergedAt: recent, detailsFetchedAt: fetchedRecently, mergedBy: null }, registered, NOW), false);
    // Unregistered repos are never fetched
    assert.equal(needsDetails({ ...legacy, repoKey: 'other/repo' }, registered, NOW), false);
});

test('syncIndex: backfills merge attribution for an index created before it existed', async () => {
    const { Event, SyncState, calls } = fakeModels({
        cursors: [{ scope: 'author:alice', lastMergedAt: new Date('2026-11-06T00:00:00Z') }],
        events: [{
            repoKey: 'nodejs/node', prNumber: 7, apiUrl: 'https://api.github.com/repos/nodejs/node/pulls/7',
            mergedAt: new Date('2026-10-01T10:00:00Z'), detailsFetchedAt: new Date('2026-10-02T00:00:00Z'), mergeCommitSha: 'def'
        }]
    });
    const urls = [];
    globalThis.fetch = async (url) => {
        urls.push(String(url));
        if (String(url).includes('/search/issues')) return jsonResponse({ total_count: 0, items: [] });
        return jsonResponse(rawPR);
    };

    const meta = await syncIndex({
        scopes: [{ key: 'author:alice', qualifier: 'author:alice' }],
        detailFilter: { authorKey: 'alice' },
        registeredKeys: new Set(['nodejs/node']),
        headers: {},
        Event, SyncState, now: NOW
    });

    assert.equal(meta.detailRequests, 1);
    assert.equal(meta.githubRequests, 2);
    assert.ok(urls.includes('https://api.github.com/repos/nodejs/node/pulls/7'));
    const detailWrite = calls.eventWrites.find(ops => !ops[0].updateOne.upsert);
    assert.deepEqual(detailWrite[0].updateOne.update.$set.mergedBy, { login: 'bob', id: 2 });
    assert.equal(detailWrite[0].updateOne.update.$set.mergeCommitSha, 'def');
});

test('upsertEvents upserts by { repoKey, prNumber } without touching stats', async () => {
    const { Event, calls } = fakeModels();

    const result = await upsertEvents(Event, [searchItem(1), searchItem(2)], NOW);

    assert.equal(result.upserted, 2);
    const op = calls.eventWrites[0][0].updateOne;
    assert.deepEqual(op.filter, { repoKey: 'nodejs/node', prNumber: 1 });
    assert.equal(op.upsert, true);
    assert.equal(op.update.$set.stats, undefined);
    assert.equal(op.update.$set.detailsFetchedAt, undefined);
});

test('upsertEvents counts E11000 duplicate-key errors as already indexed', async () => {
    const error = Object.assign(new Error('E11000 duplicate key error'), {
        code: 11000,
        writeErrors: [{ code: 11000 }, { code: 11000 }],
        result: { upsertedCount: 1 }
    });
    const { Event } = fakeModels({ bulkWriteError: error });

    const result = await upsertEvents(Event, [searchItem(1), searchItem(2), searchItem(3)], NOW);

    assert.deepEqual(result, { upserted: 1, duplicates: 2 });
});

test('upsertEvents rethrows errors other than duplicate keys', async () => {
    const error = Object.assign(new Error('write failed'), { writeErrors: [{ code: 11000 }, { code: 121 }] });
    const { Event } = fakeModels({ bulkWriteError: error });

    await assert.rejects(upsertEvents(Event, [searchItem(1)], NOW), /write failed/);
});

test('syncIndex: clean first sync advances the cursor with $max and fetches details', async () => {
    const { Event, SyncState, calls } = fakeModels({
        events: [{ repoKey: 'nodejs/node', prNumber: 7, apiUrl: 'https://api.github.com/repos/nodejs/node/pulls/7', mergedAt: new Date('2026-11-01T10:00:00Z'), detailsFetchedAt: null }]
    });
    const requested = [];
    globalThis.fetch = async (url) => {
        requested.push(url);
        if (url.includes('/search/')) return jsonResponse({ total_count: 1, items: [searchItem(7)] });
        return jsonResponse(rawPR);
    };

    const meta = await syncIndex({
        scopes: [{ key: 'author:alice', qualifier: 'author:alice' }],
        detailFilter: { authorKey: 'alice' },
        registeredKeys: new Set(['nodejs/node']),
        headers: {},
        Event, SyncState, now: NOW
    });

    assert.match(decodeURIComponent(requested[0]), /author:alice is:pr is:merged updated:>2024-01-01/);
    assert.equal(meta.githubRequests, 2);
    assert.equal(meta.newEvents, 1);
    assert.equal(meta.stale, false);
    assert.deepEqual(meta.cursorsAdvanced, ['author:alice']);
    assert.deepEqual(calls.cursorUpdates[0].update.$max, { lastMergedAt: NOW });
    assert.equal(calls.cursorUpdates[0].options.upsert, true);
    const detailWrite = calls.eventWrites[1][0].updateOne;
    assert.equal(detailWrite.update.$set.stats.reviewComments, 4);
});

/** Search mock: 100 items per page, 5000 total, so results are capped at 1000. */
function cappedSearch(itemFor) {
    const state = { pages: 0, urls: [] };
    globalThis.fetch = async (url) => {
        state.pages++;
        state.urls.push(url);
        const items = Array.from({ length: 100 }, (_, i) => itemFor((state.pages - 1) * 100 + i));
        return jsonResponse({ total_count: 5000, items }, { headers: { link: `<${url}&p=${state.pages + 1}>; rel="next"` } });
    };
    return state;
}

test('syncIndex: a truncated first sync sorts newest first and advances to the newest mergedAt', async () => {
    const { Event, SyncState, calls } = fakeModels();
    // Newest first; only repo a/one appears in the capped results
    const search = cappedSearch(n => searchItem(n, {
        repo: 'a/one',
        mergedAt: new Date(Date.parse('2026-11-06T00:00:00Z') - n * 60_000).toISOString()
    }));

    const meta = await syncIndex({
        scopes: ['a/one', 'a/two'].map(r => ({ key: `repo:${r}`, qualifier: `repo:${r}` })),
        detailFilter: {},
        registeredKeys: new Set(['a/one', 'a/two']),
        headers: {},
        Event, SyncState, now: NOW
    });

    assert.equal(search.pages, 10);
    assert.match(search.urls[0], /&sort=updated&order=desc/);
    assert.equal(meta.truncated, true);
    assert.equal(meta.newEvents, 1000);
    assert.deepEqual(meta.cursorsAdvanced, ['repo:a/one']);
    assert.deepEqual(meta.historyTruncated, ['repo:a/one']);
    assert.equal(calls.cursorUpdates.length, 1);
    const { filter, update } = calls.cursorUpdates[0];
    assert.deepEqual(filter, { scope: 'repo:a/one' });
    assert.deepEqual(update.$max, { lastMergedAt: new Date('2026-11-06T00:00:00Z') });
    assert.equal(update.$set.historyTruncated, true);
});

test('syncIndex: a truncated incremental search is not clean and does not advance cursors', async () => {
    const { Event, SyncState, calls } = fakeModels({
        cursors: [{ scope: 'repo:nodejs/node', lastMergedAt: new Date('2026-10-01T00:00:00Z'), historyTruncated: true }]
    });
    const search = cappedSearch(n => searchItem(n));

    const meta = await syncIndex({
        scopes: [{ key: 'repo:nodejs/node', qualifier: 'repo:nodejs/node' }],
        detailFilter: {},
        registeredKeys: new Set(['nodejs/node']),
        headers: {},
        Event, SyncState, now: NOW
    });

    assert.equal(search.pages, 10);
    assert.doesNotMatch(search.urls[0], /sort=/);
    assert.equal(meta.truncated, true);
    assert.deepEqual(meta.cursorsAdvanced, []);
    assert.deepEqual(meta.historyTruncated, ['repo:nodejs/node']);
    assert.equal(calls.cursorUpdates.length, 0);
});

test('syncIndex: repos with cursors share one incremental search; new repos get a full one', async () => {
    const { Event, SyncState, calls } = fakeModels({
        cursors: [
            { scope: 'repo:a/one', lastMergedAt: new Date('2026-11-05T00:00:00Z') },
            { scope: 'repo:a/two', lastMergedAt: new Date('2026-11-03T00:00:00Z') }
        ]
    });
    const queries = [];
    globalThis.fetch = async (url) => {
        queries.push(new URL(url).searchParams.get('q'));
        return jsonResponse({ total_count: 0, items: [] });
    };

    const meta = await syncIndex({
        scopes: ['a/one', 'a/two', 'a/new'].map(r => ({ key: `repo:${r}`, qualifier: `repo:${r}` })),
        detailFilter: {},
        registeredKeys: new Set(['a/one', 'a/two', 'a/new']),
        headers: {},
        Event, SyncState, now: NOW
    });

    assert.deepEqual(queries, [
        'repo:a/one repo:a/two is:pr is:merged merged:>=2026-11-02T00:00:00Z',
        'repo:a/new is:pr is:merged updated:>2024-01-01'
    ]);
    assert.deepEqual(meta.cursorsAdvanced, ['repo:a/one', 'repo:a/two', 'repo:a/new']);
    assert.equal(calls.cursorUpdates.length, 3);
});

test('syncIndex: GitHub unavailable marks the result stale and keeps cursors', async () => {
    const { Event, SyncState, calls } = fakeModels({
        cursors: [{ scope: 'author:alice', lastMergedAt: new Date('2026-11-05T00:00:00Z') }],
        events: [{ repoKey: 'nodejs/node', prNumber: 7, apiUrl: 'https://api.github.com/repos/nodejs/node/pulls/7', mergedAt: NOW, detailsFetchedAt: null }]
    });
    let requests = 0;
    globalThis.fetch = async () => {
        requests++;
        return jsonResponse({ message: 'Bad credentials' }, { status: 401 });
    };

    const meta = await syncIndex({
        scopes: [{ key: 'author:alice', qualifier: 'author:alice' }],
        detailFilter: { authorKey: 'alice' },
        registeredKeys: new Set(['nodejs/node']),
        headers: {},
        Event, SyncState, now: NOW
    });

    assert.equal(meta.stale, true);
    assert.deepEqual(meta.errors, ['GitHub API 401: Bad credentials']);
    assert.equal(calls.cursorUpdates.length, 0);
    assert.equal(requests, 1, 'no detail requests after a failed search');
    assert.equal(meta.detailRequests, 0);
});
