/**
 * Persistent Contribution Index
 *
 * Keeps merged PRs in MongoDB (ContributionEvent) so scoring reads indexed
 * history instead of refetching it from GitHub on every request.
 *
 * Sync is incremental per scope ('author:<login>' or 'repo:<owner/repo>'):
 * scopes with a cursor share one search for PRs merged since the oldest
 * cursor; scopes without one get a single full-history search. A cursor only
 * moves forward ($max), and only after a clean search (no error, no rate
 * limit, not incomplete, not truncated at GitHub's 1000-result cap).
 */

import ContributionEvent from '../models/ContributionEvent.js';
import ContributionSyncState from '../models/ContributionSyncState.js';
import { fetchAllSearchResults, fetchPRDetails } from './githubSearch.js';

// Re-fetch details for PRs merged this recently, so review comments added
// shortly after merge are still counted.
export const DETAIL_REFRESH_DAYS = 14;

// First (full) sync uses the same window as the original search.
const FIRST_SYNC_QUALIFIER = 'updated:>2024-01-01';

// Search results can lag behind merges; re-read this much before the cursor.
const CURSOR_OVERLAP_MS = 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

function isoSeconds(date) {
    return new Date(date).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Builds the search query for a group of scope qualifiers.
 * Without a cursor it is a full-history search; with one, only PRs merged
 * since (cursor - overlap).
 */
export function buildSearchQuery(qualifiers, since) {
    const window = since
        ? `merged:>=${isoSeconds(new Date(since).getTime() - CURSOR_OVERLAP_MS)}`
        : FIRST_SYNC_QUALIFIER;
    return `${qualifiers.join(' ')} is:pr is:merged ${window}`;
}

/**
 * Index fields that can be taken from a search item (no extra request).
 */
export function eventFromSearchItem(item, now = new Date()) {
    const match = (item.repository_url || '').match(/\/repos\/([^/]+\/[^/]+)$/);
    const repo = match ? match[1] : null;
    return {
        repo,
        repoKey: repo?.toLowerCase(),
        prNumber: item.number,
        author: item.user?.login,
        authorKey: item.user?.login?.toLowerCase(),
        authorId: item.user?.id,
        authorAvatar: item.user?.avatar_url,
        title: item.title,
        url: item.html_url || item.pull_request?.html_url,
        apiUrl: item.pull_request?.url,
        mergedAt: item.pull_request?.merged_at ? new Date(item.pull_request.merged_at) : null,
        fetchedAt: now
    };
}

/**
 * Index fields taken from a full PR object (GET /repos/:o/:r/pulls/:n).
 */
export function detailsFromPR(pr, now = new Date()) {
    return {
        ...(pr.base?.repo?.full_name && { repo: pr.base.repo.full_name }),
        mergeCommitSha: pr.merge_commit_sha || null,
        headSha: pr.head?.sha || null,
        stats: {
            additions: pr.additions || 0,
            deletions: pr.deletions || 0,
            changedFiles: pr.changed_files || 0,
            commits: pr.commits || 0,
            comments: pr.comments || 0,
            reviewComments: pr.review_comments || 0,
            merged: pr.merged === true,
            labels: (pr.labels || []).map(l => l.name)
        },
        detailsFetchedAt: now
    };
}

/**
 * Rebuilds the GitHub PR fields extractPRMetrics() reads, from an indexed event.
 */
export function toPRShape(event) {
    const s = event.stats || {};
    return {
        number: event.prNumber,
        title: event.title,
        html_url: event.url,
        merged_at: event.mergedAt ? isoSeconds(event.mergedAt) : null,
        base: { repo: { full_name: event.repo } },
        additions: s.additions,
        deletions: s.deletions,
        changed_files: s.changedFiles,
        commits: s.commits,
        comments: s.comments,
        review_comments: s.reviewComments,
        merged: s.merged,
        labels: (s.labels || []).map(name => ({ name }))
    };
}

/**
 * True when an event in a registered repo has no details yet, or was merged
 * within the refresh window.
 */
export function needsDetails(event, registeredKeys, now = new Date()) {
    if (!registeredKeys.has(event.repoKey)) return false;
    if (!event.detailsFetchedAt) return true;
    return Boolean(event.mergedAt) && new Date(event.mergedAt).getTime() >= now.getTime() - DETAIL_REFRESH_DAYS * DAY_MS;
}

function duplicateKeyOnly(error) {
    const writeErrors = [].concat(error?.writeErrors || []);
    if (writeErrors.length > 0) return writeErrors.every(e => (e.code ?? e.err?.code) === 11000);
    return error?.code === 11000;
}

/**
 * Upserts events from search items. Unordered, so one failure doesn't stop
 * the rest; duplicate-key errors (a concurrent request inserted the same PR)
 * count as already indexed.
 */
export async function upsertEvents(Event, items, now = new Date()) {
    const ops = items
        .map(item => eventFromSearchItem(item, now))
        .filter(e => e.repoKey && e.prNumber != null && e.authorKey)
        .map(({ repo, ...fields }) => ({
            updateOne: {
                filter: { repoKey: fields.repoKey, prNumber: fields.prNumber },
                update: { $set: fields, $setOnInsert: { repo, type: 'pr_merge' } },
                upsert: true
            }
        }));

    if (ops.length === 0) return { upserted: 0, duplicates: 0 };

    try {
        const result = await Event.bulkWrite(ops, { ordered: false });
        return { upserted: result.upsertedCount || 0, duplicates: 0 };
    } catch (error) {
        if (!duplicateKeyOnly(error)) throw error;
        return {
            upserted: error.result?.upsertedCount ?? error.insertedCount ?? 0,
            duplicates: [].concat(error.writeErrors || [error]).length
        };
    }
}

/**
 * Moves a scope's cursor forward (never back).
 */
export async function advanceCursor(SyncState, scope, lastMergedAt, now = new Date()) {
    const op = () => SyncState.updateOne(
        { scope },
        { $max: { lastMergedAt }, $set: { lastSyncedAt: now } },
        { upsert: true }
    );
    try {
        await op();
    } catch (error) {
        // A concurrent request created the cursor first; update it instead.
        if (error?.code !== 11000) throw error;
        await op();
    }
}

/**
 * Syncs the index for a set of scopes, then fetches missing / recent PR details.
 *
 * @param {object} args
 * @param {{ key: string, qualifier: string }[]} args.scopes
 * @param {object} args.detailFilter  Mongo filter for events eligible for details
 * @param {Set<string>} args.registeredKeys  lowercased repo names registered on the platform
 * @param {object} args.headers  GitHub request headers
 */
export async function syncIndex({
    scopes,
    detailFilter,
    registeredKeys,
    headers,
    Event = ContributionEvent,
    SyncState = ContributionSyncState,
    now = new Date()
}) {
    const meta = {
        githubRequests: 0,
        searchRequests: 0,
        detailRequests: 0,
        detailErrors: 0,
        newEvents: 0,
        alreadyIndexed: 0,
        truncated: false,
        incomplete: false,
        rateLimited: false,
        rateLimitResetAt: null,
        errors: [],
        cursorsAdvanced: []
    };

    // Group scopes: one shared incremental search, one full search for new scopes
    const cursors = await SyncState.find({ scope: { $in: scopes.map(s => s.key) } }).lean();
    const cursorByScope = new Map(cursors.map(c => [c.scope, c.lastMergedAt]));
    const withCursor = scopes.filter(s => cursorByScope.has(s.key));
    const fresh = scopes.filter(s => !cursorByScope.has(s.key));

    const groups = [];
    if (withCursor.length > 0) {
        const oldest = Math.min(...withCursor.map(s => new Date(cursorByScope.get(s.key)).getTime()));
        groups.push({ scopes: withCursor, since: new Date(oldest) });
    }
    if (fresh.length > 0) groups.push({ scopes: fresh, since: null });

    for (const group of groups) {
        const query = buildSearchQuery(group.scopes.map(s => s.qualifier), group.since);
        const search = await fetchAllSearchResults(query, headers);
        meta.searchRequests += search.requests;

        const written = await upsertEvents(Event, search.items, now);
        meta.newEvents += written.upserted;
        meta.alreadyIndexed += written.duplicates;

        meta.truncated ||= search.truncated;
        meta.incomplete ||= search.incomplete;
        if (search.rateLimited) {
            meta.rateLimited = true;
            meta.rateLimitResetAt = search.resetAt;
        }
        if (search.error) meta.errors.push(search.error);

        const clean = !search.error && !search.incomplete && !search.truncated;
        if (clean) {
            for (const scope of group.scopes) {
                await advanceCursor(SyncState, scope.key, now, now);
                meta.cursorsAdvanced.push(scope.key);
            }
        }
        if (search.rateLimited) break;
    }

    // Fetch details for new events and refresh recently merged ones. Skipped when
    // the search failed: those requests would fail the same way, and events left
    // without details are picked up by the next clean sync.
    if (meta.errors.length === 0) {
        const indexed = await Event
            .find({ ...detailFilter, repoKey: { $in: [...registeredKeys] } })
            .select('repoKey prNumber apiUrl mergedAt detailsFetchedAt')
            .lean();
        const targets = indexed.filter(e => e.apiUrl && needsDetails(e, registeredKeys, now));

        const details = await fetchPRDetails(targets.map(e => e.apiUrl), headers);
        meta.detailRequests = details.requests;
        meta.detailErrors = details.errors;
        if (details.rateLimited) {
            meta.rateLimited = true;
            meta.rateLimitResetAt = details.resetAt;
        }

        const updates = [];
        details.prs.forEach((pr, i) => {
            if (!pr) return;
            updates.push({
                updateOne: {
                    filter: { repoKey: targets[i].repoKey, prNumber: targets[i].prNumber },
                    update: { $set: detailsFromPR(pr, now) }
                }
            });
        });
        if (updates.length > 0) await Event.bulkWrite(updates, { ordered: false });
    }

    meta.githubRequests = meta.searchRequests + meta.detailRequests;
    meta.stale = meta.errors.length > 0 || meta.rateLimited;
    meta.partial = meta.stale || meta.incomplete || meta.detailErrors > 0;
    return meta;
}
