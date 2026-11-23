import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    fetchAllSearchResults,
    fetchPRDetails,
    repoFullNameFromUrl
} from '../services/githubSearch.js';

const realFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = realFetch;
});

function jsonResponse(body, { status = 200, headers = {} } = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json', ...headers }
    });
}

function makeItems(start, count) {
    return Array.from({ length: count }, (_, i) => ({ id: start + i }));
}

function pageUrl(page) {
    return `https://api.github.com/search/issues?q=x&per_page=100&page=${page}`;
}

/** Mocks fetch with a sequence of responses; records the requested URLs. */
function mockFetch(responses) {
    const calls = [];
    globalThis.fetch = async (url) => {
        calls.push(url);
        const next = responses.shift();
        if (!next) throw new Error(`unexpected fetch: ${url}`);
        return next();
    };
    return calls;
}

test('follows rel="next" across multiple pages', async () => {
    const calls = mockFetch([
        () => jsonResponse({ total_count: 250, items: makeItems(0, 100) }, { headers: { link: `<${pageUrl(2)}>; rel="next", <${pageUrl(3)}>; rel="last"` } }),
        () => jsonResponse({ total_count: 250, items: makeItems(100, 100) }, { headers: { link: `<${pageUrl(3)}>; rel="next", <${pageUrl(1)}>; rel="first"` } }),
        () => jsonResponse({ total_count: 250, items: makeItems(200, 50) }, { headers: { link: `<${pageUrl(1)}>; rel="first"` } })
    ]);

    const result = await fetchAllSearchResults('author:a is:pr', {});

    assert.equal(calls.length, 3);
    assert.match(calls[0], /per_page=100/);
    assert.equal(calls[1], pageUrl(2));
    assert.equal(calls[2], pageUrl(3));
    assert.equal(result.items.length, 250);
    assert.equal(result.totalCount, 250);
    assert.equal(result.truncated, false);
    assert.equal(result.error, null);
});

test('stops when there is no next link', async () => {
    const calls = mockFetch([
        () => jsonResponse({ total_count: 3, items: makeItems(0, 3) })
    ]);

    const result = await fetchAllSearchResults('author:a is:pr', {});

    assert.equal(calls.length, 1);
    assert.equal(result.items.length, 3);
    assert.equal(result.truncated, false);
});

test('stops at the 1000-result cap and flags truncated', async () => {
    const responses = [];
    for (let page = 1; page <= 12; page++) {
        responses.push(() => jsonResponse(
            { total_count: 5000, items: makeItems((page - 1) * 100, 100) },
            { headers: { link: `<${pageUrl(page + 1)}>; rel="next"` } }
        ));
    }
    const calls = mockFetch(responses);

    const result = await fetchAllSearchResults('author:a is:pr', {});

    assert.equal(calls.length, 10);
    assert.equal(result.items.length, 1000);
    assert.equal(result.totalCount, 5000);
    assert.equal(result.truncated, true);
});

test('returns a partial result on a primary rate limit', async () => {
    const reset = Math.floor(Date.now() / 1000) + 600;
    mockFetch([
        () => jsonResponse({ total_count: 300, items: makeItems(0, 100) }, { headers: { link: `<${pageUrl(2)}>; rel="next"` } }),
        () => jsonResponse({ message: 'API rate limit exceeded' }, { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) } })
    ]);

    const result = await fetchAllSearchResults('author:a is:pr', {});

    assert.equal(result.items.length, 100);
    assert.equal(result.rateLimited, true);
    assert.equal(result.resetAt, new Date(reset * 1000).toISOString());
    assert.match(result.error, /rate limit/i);
});

test('treats retry-after as a secondary rate limit', async () => {
    mockFetch([
        () => jsonResponse({ message: 'You have exceeded a secondary rate limit' }, { status: 429, headers: { 'retry-after': '60' } })
    ]);

    const result = await fetchAllSearchResults('author:a is:pr', {});

    assert.equal(result.items.length, 0);
    assert.equal(result.rateLimited, true);
    assert.ok(result.resetAt);
});

test('a 403 without rate-limit headers is a normal error with the GitHub message', async () => {
    mockFetch([
        () => jsonResponse({ message: 'Resource not accessible by integration' }, { status: 403, headers: { 'x-ratelimit-remaining': '25' } })
    ]);

    const result = await fetchAllSearchResults('author:a is:pr', {});

    assert.equal(result.rateLimited, false);
    assert.equal(result.error, 'GitHub API 403: Resource not accessible by integration');
});

test('repoFullNameFromUrl lowercases so the registered-repo pre-filter is case-insensitive', () => {
    const registered = new Set(['Namish18/Kinetic'].map(n => n.toLowerCase()));
    const fromSearch = repoFullNameFromUrl('https://api.github.com/repos/namish18/kinetic');
    const mixedCase = repoFullNameFromUrl('https://api.github.com/repos/NAMISH18/Kinetic');

    assert.equal(fromSearch, 'namish18/kinetic');
    assert.ok(registered.has(fromSearch));
    assert.ok(registered.has(mixedCase));
    assert.equal(repoFullNameFromUrl(undefined), null);
});

test('fetchPRDetails keeps order, limits concurrency and stops on rate limit', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    globalThis.fetch = async (url) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise(r => setTimeout(r, 5));
        inFlight--;
        const n = Number(url.split('/').pop());
        if (n === 3) return jsonResponse({ message: 'Not Found' }, { status: 404 });
        return jsonResponse({ number: n });
    };

    const urls = Array.from({ length: 10 }, (_, i) => `https://api.github.com/repos/o/r/pulls/${i}`);
    const result = await fetchPRDetails(urls, {});

    assert.ok(maxInFlight <= 4);
    assert.equal(result.requests, 10);
    assert.equal(result.errors, 1);
    assert.equal(result.prs[3], null);
    assert.deepEqual(result.prs.filter(Boolean).map(p => p.number), [0, 1, 2, 4, 5, 6, 7, 8, 9]);

    globalThis.fetch = async () => jsonResponse({}, { status: 403, headers: { 'x-ratelimit-remaining': '0' } });
    const limited = await fetchPRDetails(urls, {}, { concurrency: 1 });
    assert.equal(limited.rateLimited, true);
    assert.equal(limited.requests, 1);
});
