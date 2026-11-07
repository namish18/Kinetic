/**
 * GitHub Search helpers
 *
 * Paginates the GitHub search API (following `Link: rel="next"`) while
 * respecting its limits: at most 1000 results per query, primary and
 * secondary rate limits, and non-OK responses.
 */

const GITHUB_API = 'https://api.github.com';
const SEARCH_RESULT_CAP = 1000;

/**
 * True when a response is a GitHub rate-limit response, judged only by its
 * headers: x-ratelimit-remaining: 0 (primary) or retry-after (secondary).
 */
export function isRateLimited(res) {
    if (res.status !== 403 && res.status !== 429) return false;
    return res.headers.get('x-ratelimit-remaining') === '0' || res.headers.has('retry-after');
}

/**
 * ISO timestamp of when the rate limit lifts, if the headers say so.
 */
export function rateLimitResetAt(res) {
    const retryAfter = res.headers.get('retry-after');
    if (retryAfter && !Number.isNaN(Number(retryAfter))) {
        return new Date(Date.now() + Number(retryAfter) * 1000).toISOString();
    }
    const reset = res.headers.get('x-ratelimit-reset');
    if (reset && !Number.isNaN(Number(reset))) {
        return new Date(Number(reset) * 1000).toISOString();
    }
    return null;
}

/**
 * Builds a readable error message from a non-OK GitHub response.
 */
export async function githubErrorMessage(res) {
    let detail = '';
    try {
        const body = await res.json();
        detail = body?.message || '';
    } catch {
        // body was not JSON
    }
    return `GitHub API ${res.status}${detail ? `: ${detail}` : ''}`;
}

function nextLink(res) {
    const link = res.headers.get('link');
    if (!link) return null;
    const match = link.match(/<([^>]+)>\s*;\s*rel="next"/);
    return match ? match[1] : null;
}

/**
 * Fetches every page of a GitHub issue/PR search, up to GitHub's 1000-result cap.
 *
 * Never throws for HTTP errors: it stops paging and reports what happened, so
 * callers can return a partial result instead of crashing or returning 0.
 *
 * @returns {Promise<{ items: object[], totalCount: number, truncated: boolean,
 *   incomplete: boolean, rateLimited: boolean, resetAt: string|null, error: string|null,
 *   requests: number }>}
 */
export async function fetchAllSearchResults(query, headers, options = {}) {
    const perPage = options.perPage || 100;
    const maxResults = options.maxResults || SEARCH_RESULT_CAP;

    const result = {
        items: [],
        totalCount: 0,
        truncated: false,
        incomplete: false,
        rateLimited: false,
        resetAt: null,
        error: null,
        requests: 0
    };

    const sort = options.sort ? `&sort=${options.sort}&order=${options.order || 'desc'}` : '';
    let url = `${GITHUB_API}/search/issues?q=${encodeURIComponent(query)}&per_page=${perPage}${sort}`;

    while (url) {
        result.requests++;
        const res = await fetch(url, { headers });

        if (!res.ok) {
            if (isRateLimited(res)) {
                result.rateLimited = true;
                result.resetAt = rateLimitResetAt(res);
                result.error = 'GitHub API rate limit exceeded';
            } else {
                result.error = await githubErrorMessage(res);
            }
            break;
        }

        const data = await res.json();
        result.totalCount = data.total_count || 0;
        if (data.incomplete_results) result.incomplete = true;
        result.items.push(...(data.items || []));

        if (result.items.length >= maxResults) {
            result.items = result.items.slice(0, maxResults);
            result.truncated = result.totalCount > maxResults;
            break;
        }

        url = nextLink(res);
    }

    if (result.truncated) {
        console.warn(`GitHub search capped at ${maxResults} of ${result.totalCount} results for query: ${query}`);
    }

    return result;
}

/**
 * Lowercased "owner/repo" from a search item's repository_url.
 */
export function repoFullNameFromUrl(repositoryUrl) {
    const match = (repositoryUrl || '').match(/\/repos\/([^/]+\/[^/]+)$/);
    return match ? match[1].toLowerCase() : null;
}

/**
 * Maps items with at most `limit` calls in flight, keeping the original order.
 */
export async function mapWithConcurrency(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;

    async function worker() {
        while (next < items.length) {
            const index = next++;
            results[index] = await fn(items[index], index);
        }
    }

    const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
    await Promise.all(workers);
    return results;
}

/**
 * Fetches PR detail objects with limited concurrency, in the original order.
 * A failed request yields null; a rate-limit response stops further requests.
 */
export async function fetchPRDetails(prUrls, headers, options = {}) {
    const concurrency = options.concurrency || 4;
    const state = { requests: 0, errors: 0, rateLimited: false, resetAt: null };

    const prs = await mapWithConcurrency(prUrls, concurrency, async (url) => {
        if (state.rateLimited) return null;
        state.requests++;
        let res;
        try {
            res = await fetch(url, { headers });
        } catch {
            state.errors++;
            return null;
        }
        if (!res.ok) {
            if (isRateLimited(res)) {
                state.rateLimited = true;
                state.resetAt = rateLimitResetAt(res);
            } else {
                state.errors++;
            }
            return null;
        }
        return res.json();
    });

    return { prs, ...state };
}
