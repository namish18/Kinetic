import { createHash } from 'node:crypto';
import { CID } from 'multiformats/cid';
import ContributionScore from '../models/ContributionScore.js';

export const EVIDENCE_SCHEMA = 'kinetic-evidence/v1';

const SCORE_INPUT_KEYS = ['complexity', 'impact', 'quality', 'review', 'priority', 'reputation', 'spamPenalty'];

function pickNumbers(source, keys) {
    const out = {};
    for (const key of keys) {
        const value = Number(source?.[key]);
        if (source?.[key] !== undefined && Number.isFinite(value)) out[key] = value;
    }
    return out;
}

/**
 * True only for a real, parseable IPFS CID.
 * Rejects the old sha256- fallback ids and made up strings.
 */
export function isValidCid(value) {
    if (typeof value !== 'string' || value.startsWith('sha256-')) return false;
    try {
        CID.parse(value);
        return true;
    } catch {
        return false;
    }
}

/**
 * Fetches public CI evidence (check runs) for a merged PR's commit.
 * If only the PR number is known, the merge commit is looked up first.
 * The token is only used for the requests and is never part of the result.
 * If CI info can't be read, verified stays null instead of guessing.
 */
export async function fetchCIEvidence({ repository, prNumber, commitSha, token, fetchFn = fetch }) {
    const headers = {
        Accept: 'application/vnd.github.v3+json',
        ...(token && { Authorization: `Bearer ${token}` })
    };

    try {
        let sha = commitSha || null;
        if (!sha && repository && prNumber !== undefined) {
            const prRes = await fetchFn(`https://api.github.com/repos/${repository}/pulls/${prNumber}`, { headers });
            if (prRes.ok) sha = (await prRes.json()).merge_commit_sha || null;
        }

        const empty = { commitSha: sha, verified: null, runs: [] };
        if (!repository || !sha) return empty;

        const res = await fetchFn(`https://api.github.com/repos/${repository}/commits/${sha}/check-runs`, { headers });
        if (!res.ok) return empty;

        const data = await res.json();
        const runs = (data.check_runs || []).map(r => ({
            name: r.name,
            status: r.status,
            conclusion: r.conclusion ?? null
        }));
        const verified = runs.length > 0 && runs.every(r => r.status === 'completed' && r.conclusion === 'success');
        return { commitSha: sha, verified, runs };
    } catch {
        return { commitSha: commitSha || null, verified: null, runs: [] };
    }
}

// How long a package with final CI results is trusted before CI is checked again.
export const EVIDENCE_RECHECK_MS = 24 * 60 * 60 * 1000;

/**
 * CI is "pending" while it can still change: it could not be read, no check
 * runs exist yet, or some run has not completed. A completed failure is final.
 */
export function isCIPending(ci) {
    if (!ci || ci.verified === null || ci.verified === undefined) return true;
    const runs = ci.runs || [];
    return runs.length === 0 || runs.some(r => r.status !== 'completed');
}

/**
 * Fingerprint of an evidence package. Same package, same digest.
 * Used to tell whether the evidence itself changed, whatever the score did.
 */
export function hashEvidencePackage(evidencePackage) {
    return createHash('sha256').update(JSON.stringify(evidencePackage)).digest('hex');
}

/**
 * Decides whether evidence needs to be looked at again. This only limits
 * GitHub calls: whether a new package is stored is decided by its digest.
 * Refresh when there is no valid package yet, the score or algorithm version
 * changed, CI was still pending last time, or the last check is older than
 * EVIDENCE_RECHECK_MS.
 */
export function shouldRefreshEvidence(previous, { score, algorithmVersion, now = new Date() } = {}) {
    if (!previous || !isValidCid(previous.evidenceCID)) return true;
    if (previous.score !== score) return true;
    if (algorithmVersion && previous.algorithmVersion !== algorithmVersion) return true;
    if (previous.evidencePending) return true;
    if (!previous.evidenceDigest || !previous.evidenceCheckedAt) return true;
    return new Date(now).getTime() - new Date(previous.evidenceCheckedAt).getTime() >= EVIDENCE_RECHECK_MS;
}

/**
 * Builds the evidence package for one scored contribution.
 * Only known fields are copied in, so nothing else can leak into it.
 * Same input always gives the same package (and the same CID).
 */
export function buildEvidencePackage({ contribution, ci, scoreInputs, score, algorithm, generatedAt } = {}) {
    if (!contribution?.username || !contribution?.repository || contribution?.prNumber === undefined) {
        throw new Error('Evidence package needs contribution username, repository and prNumber');
    }
    if (!algorithm?.version) {
        throw new Error('Evidence package needs an algorithm version');
    }

    const inputs = pickNumbers(scoreInputs, SCORE_INPUT_KEYS);
    if (scoreInputs?.weights && typeof scoreInputs.weights === 'object') {
        inputs.weights = pickNumbers(scoreInputs.weights, Object.keys(scoreInputs.weights));
    }

    return {
        schema: EVIDENCE_SCHEMA,
        ...(generatedAt && { generatedAt: new Date(generatedAt).toISOString() }),
        contribution: {
            username: contribution.username,
            repository: contribution.repository,
            prNumber: contribution.prNumber,
            prUrl: contribution.prUrl || null,
            mergedAt: contribution.mergedAt || null
        },
        ciEvidence: {
            commitSha: ci?.commitSha || contribution.commitSha || null,
            verified: typeof ci?.verified === 'boolean' ? ci.verified : null,
            runs: (ci?.runs || []).map(r => ({
                name: r.name,
                status: r.status,
                conclusion: r.conclusion ?? null
            }))
        },
        scoreInputs: inputs,
        score: Number.isFinite(Number(score)) ? Number(score) : null,
        algorithm: {
            name: algorithm.name || null,
            version: algorithm.version
        }
    };
}

async function storeWithHelia(evidencePackage) {
    const { getHelia } = await import('./didService.js');
    const { j } = await getHelia();
    const cid = await j.add(evidencePackage);
    return cid.toString();
}

/**
 * Stores the package on IPFS and returns its real CID.
 * Throws if storing fails or the CID is not valid. Never makes one up.
 */
export async function storeEvidencePackage(evidencePackage, { store = storeWithHelia } = {}) {
    const cid = await store(evidencePackage);
    if (!isValidCid(cid)) throw new Error('IPFS did not return a valid CID');
    return cid;
}

/**
 * Reads an evidence package back from the local Helia node by CID.
 */
export async function getEvidencePackage(cid) {
    if (!isValidCid(cid)) return null;
    const { getHelia } = await import('./didService.js');
    const { j } = await getHelia();
    try {
        return await j.get(CID.parse(cid));
    } catch {
        return null;
    }
}

/**
 * Builds the evidence package, stores it on IPFS if it changed, and links its
 * CID to the contribution.
 *
 * - If the package is identical to the one already linked (same digest), nothing
 *   new is stored; only the check time and pending flag are updated.
 * - The CID is only returned once the database confirms it was saved on the
 *   matching contribution record. If no record matched or the write failed,
 *   this returns null and logs the reason.
 * - Never throws, so scoring never fails because of evidence.
 */
export async function recordContributionEvidence(input, { store, model = ContributionScore, logger = console, previous = null, now = new Date() } = {}) {
    try {
        const evidencePackage = buildEvidencePackage(input);
        const digest = hashEvidencePackage(evidencePackage);
        const pending = isCIPending(input.ci);

        const unchanged = Boolean(previous) && previous.evidenceDigest === digest && isValidCid(previous.evidenceCID);
        const cid = unchanged
            ? previous.evidenceCID
            : await storeEvidencePackage(evidencePackage, store ? { store } : undefined);

        const { username, repository, prNumber } = input.contribution;
        const updated = await model.findOneAndUpdate(
            { username, repository, prNumber },
            { $set: { evidenceCID: cid, evidenceDigest: digest, evidencePending: pending, evidenceCheckedAt: new Date(now) } },
            { new: true }
        );

        if (!updated) {
            logger.warn(`Evidence package ${cid} was stored but no contribution record matched ${repository}#${prNumber} for ${username}; CID not linked`);
            return null;
        }
        if (updated.evidenceCID !== cid) {
            logger.warn(`Evidence CID ${cid} was not persisted on ${repository}#${prNumber}`);
            return null;
        }
        return cid;
    } catch (err) {
        logger.warn(`Evidence package not stored: ${err.message}`);
        return null;
    }
}

/**
 * Full evidence step for one scored contribution: decide whether to refresh,
 * read CI evidence, then record it. Returns the linked CID, or null when
 * nothing was linked. Never throws.
 *
 * deps (all optional, for tests): fetchCI, record, logger, now
 */
export async function ensureContributionEvidence({ contribution, scoreInputs, score, algorithm, previous, token }, deps = {}) {
    const { fetchCI = fetchCIEvidence, record = recordContributionEvidence, logger = console, now = new Date(), store, model } = deps;
    try {
        if (!shouldRefreshEvidence(previous, { score, algorithmVersion: algorithm?.version, now })) {
            return previous.evidenceCID;
        }
        const ci = await fetchCI({
            repository: contribution.repository,
            prNumber: contribution.prNumber,
            token
        });
        return await record(
            { contribution, ci, scoreInputs, score, algorithm },
            { previous, logger, now, ...(store && { store }), ...(model && { model }) }
        );
    } catch (err) {
        logger.warn(`Evidence step failed: ${err.message}`);
        return null;
    }
}

/**
 * Looks up the stored evidence CIDs for a list of contributions, in one query.
 * Returns a Map keyed by evidenceKey(); a contribution only appears in it when
 * it has a valid CID. Anything else (not scored yet, no package, invalid value,
 * database error) is simply absent, so callers show "no CID" and never a made up one.
 * Never throws.
 */
export const evidenceKey = ({ username, repository, prNumber }) => `${username}|${repository}|${prNumber}`;

export async function getEvidenceCIDs(contributions, { model = ContributionScore, logger = console } = {}) {
    const found = new Map();
    if (!Array.isArray(contributions) || contributions.length === 0) return found;
    try {
        const records = await model
            .find({ $or: contributions.map(({ username, repository, prNumber }) => ({ username, repository, prNumber })) })
            .select('username repository prNumber evidenceCID')
            .lean();
        for (const record of records) {
            if (isValidCid(record.evidenceCID)) found.set(evidenceKey(record), record.evidenceCID);
        }
    } catch (err) {
        logger.warn(`Evidence CID lookup failed: ${err.message}`);
    }
    return found;
}
