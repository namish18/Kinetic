/**
 * Proof-of-Build gate
 *
 * A contribution is scored only if GitHub Actions passed on its own commit: the
 * PR's head commit or its merge commit. Runs are looked up by commit SHA in the
 * repository the PR was merged into, so a run from another commit or from a fork
 * cannot count. The verdict is stored on the indexed contribution, so a verified
 * contribution stays verified after GitHub expires the run.
 */

import ContributionEvent from '../models/ContributionEvent.js';
import { DETAIL_REFRESH_DAYS } from './contributionIndex.js';
import { githubErrorMessage, isRateLimited, mapWithConcurrency } from './githubSearch.js';
import { verifyProofOfBuild } from './kineticMechanisms.js';

const GITHUB_API = 'https://api.github.com';
const RUNS_PER_PAGE = 100;
const MAX_CHECKS_PER_SYNC = 100;
const CHECK_CONCURRENCY = 4;
const RECHECK_MINUTES = 60;

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

// Only runs the commit itself triggered. A scheduled or manual run merely sits on whichever commit is newest.
const BUILD_EVENTS = new Set(['push', 'pull_request', 'merge_group']);
const FAILED_CONCLUSIONS = new Set(['failure', 'timed_out', 'startup_failure']);

// The status to report when no commit verified. An unknown result comes first, so it is retried rather than stored.
const STATUS_PRIORITY = ['error', 'pending', 'failed', 'none'];
const STATUS_REASONS = {
    pending: 'CI is still running on this commit',
    failed: 'a CI run failed on this commit',
    none: 'no CI run was triggered by this commit'
};

/**
 * Judges the workflow runs of one commit. It passes if at least one run succeeded
 * and the latest run of every workflow finished without failing.
 *
 * @returns {{ status: 'verified'|'failed'|'pending'|'none', run?: object }}
 */
export function classifyRuns(runs, sha) {
    const expected = sha.toLowerCase();
    const latest = new Map();
    for (const run of runs) {
        if (run.head_sha?.toLowerCase() !== expected || !BUILD_EVENTS.has(run.event)) continue;
        const key = `${run.workflow_id}:${run.event}`;
        if (!latest.has(key) || run.run_number > latest.get(key).run_number) latest.set(key, run);
    }

    const current = [...latest.values()];
    if (current.some(run => run.status === 'completed' && FAILED_CONCLUSIONS.has(run.conclusion))) {
        return { status: 'failed' };
    }
    if (current.some(run => run.status !== 'completed')) return { status: 'pending' };

    const run = current.find(candidate => candidate.conclusion === 'success');
    return run ? { status: 'verified', run } : { status: 'none' };
}

/**
 * The commits CI may have run on for a pull request, most direct first.
 */
export function commitsForEvent({ headSha, mergeCommitSha }) {
    return [
        { sha: headSha, kind: 'head' },
        { sha: mergeCommitSha, kind: 'merge' }
    ].filter(commit => commit.sha);
}

async function listRuns(repo, sha, headers) {
    try {
        const res = await fetch(`${GITHUB_API}/repos/${repo}/actions/runs?head_sha=${sha}&per_page=${RUNS_PER_PAGE}`, { headers });
        if (!res.ok) {
            if (isRateLimited(res)) return { error: 'GitHub API rate limit exceeded', rateLimited: true };
            return { error: await githubErrorMessage(res) };
        }
        const data = await res.json();
        const runs = data.workflow_runs || [];
        // A failed run could be on a page we did not read, so an incomplete list proves nothing.
        if ((data.total_count || 0) > runs.length) return { error: `More than ${RUNS_PER_PAGE} workflow runs on commit ${sha}` };
        return { runs };
    } catch (error) {
        return { error: `Could not reach GitHub: ${error.message}` };
    }
}

/**
 * Finds out whether a pull request's commits have a Proof-of-Build.
 * Never throws. 'error' means the answer is unknown, so callers must not score
 * the contribution and must not store the result.
 *
 * @returns {Promise<{ status: string, reason?: string, runId?: number, sha?: string, kind?: string, rateLimited?: boolean }>}
 */
export async function checkProofOfBuild({ repo, commits, token }) {
    if (!token) return { status: 'error', reason: 'GITHUB_PAT is not set, so CI runs cannot be verified' };

    const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` };
    const outcomes = [];

    for (const commit of commits) {
        const listed = await listRuns(repo, commit.sha, headers);
        if (listed.rateLimited) return { status: 'error', reason: listed.error, rateLimited: true };
        if (listed.error) {
            outcomes.push({ status: 'error', reason: listed.error });
            continue;
        }

        const { status, run } = classifyRuns(listed.runs, commit.sha);
        if (status !== 'verified') {
            outcomes.push({ status, reason: STATUS_REASONS[status] });
            continue;
        }

        // verifyProofOfBuild has the final word. It returns a boolean or an evidence object with `verified`.
        const confirmed = await verifyProofOfBuild(repo, run.id, token, { expectedShas: [commit] });
        if (confirmed === true || confirmed?.verified === true) {
            return { status: 'verified', runId: run.id, sha: commit.sha, kind: commit.kind };
        }
        outcomes.push({ status: 'error', reason: `CI run ${run.id} could not be confirmed` });
    }

    for (const status of STATUS_PRIORITY) {
        const outcome = outcomes.find(candidate => candidate.status === status);
        if (outcome) return outcome;
    }
    return { status: 'none', reason: STATUS_REASONS.none };
}

/**
 * True when a contribution's CI verdict should be looked up. A verified result is
 * final. Others can still change shortly after merge (a re-run, or CI on the merge
 * commit), so they are looked up again for the same window as PR details.
 */
export function needsProofCheck(event, now = new Date()) {
    const proof = event.proofOfBuild;
    if (!proof) return true;
    if (proof.status === 'verified') return false;

    const recentlyMerged = Boolean(event.mergedAt) && new Date(event.mergedAt).getTime() >= now.getTime() - DETAIL_REFRESH_DAYS * DAY_MS;
    const checkedLongAgo = new Date(proof.checkedAt).getTime() <= now.getTime() - RECHECK_MINUTES * MINUTE_MS;
    return recentlyMerged && checkedLongAgo;
}

/**
 * Looks up and stores CI verdicts for indexed contributions that need one, newest
 * first and at most MAX_CHECKS_PER_SYNC at a time. The rest wait for the next sync.
 */
export async function refreshProofOfBuild({ filter, token, Event = ContributionEvent, now = new Date() }) {
    const events = await Event.find(filter)
        .select('repo repoKey prNumber headSha mergeCommitSha mergedAt proofOfBuild')
        .sort({ mergedAt: -1 })
        .lean();

    const due = events.filter(event => commitsForEvent(event).length > 0 && needsProofCheck(event, now));
    const targets = due.slice(0, MAX_CHECKS_PER_SYNC);
    const meta = { checked: 0, errors: 0, rateLimited: false, deferred: due.length - targets.length };

    const results = await mapWithConcurrency(targets, CHECK_CONCURRENCY, async (event) => {
        if (meta.rateLimited) return null;
        const result = await checkProofOfBuild({ repo: event.repo, commits: commitsForEvent(event), token });
        if (result.rateLimited) meta.rateLimited = true;
        if (result.status === 'error') {
            meta.errors += 1;
            meta.lastError ??= result.reason;
            return null;
        }
        meta.checked += 1;
        return result;
    });

    const updates = [];
    results.forEach((result, i) => {
        if (!result) return;
        const { status, runId, sha, kind } = result;
        updates.push({
            updateOne: {
                filter: { repoKey: targets[i].repoKey, prNumber: targets[i].prNumber },
                update: { $set: { proofOfBuild: { status, runId, sha, kind, checkedAt: now } } }
            }
        });
    });
    if (updates.length > 0) await Event.bulkWrite(updates, { ordered: false });

    return meta;
}

export function isProofVerified(event) {
    return event.proofOfBuild?.status === 'verified';
}

/**
 * Counts contributions by CI verdict, for score responses.
 */
export function summarizeProof(events) {
    const counts = { verified: 0, failed: 0, pending: 0, none: 0, unchecked: 0 };
    for (const event of events) counts[event.proofOfBuild?.status ?? 'unchecked'] += 1;
    return counts;
}
