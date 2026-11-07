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
 * Fetches public CI evidence (check runs) for a commit.
 * The token is only used for the request and is never part of the result.
 * If CI info can't be read, verified stays null instead of guessing.
 */
export async function fetchCIEvidence({ repository, commitSha, token, fetchFn = fetch }) {
    const empty = { commitSha: commitSha || null, verified: null, runs: [] };
    if (!repository || !commitSha) return empty;

    try {
        const res = await fetchFn(`https://api.github.com/repos/${repository}/commits/${commitSha}/check-runs`, {
            headers: {
                Accept: 'application/vnd.github.v3+json',
                ...(token && { Authorization: `Bearer ${token}` })
            }
        });
        if (!res.ok) return empty;

        const data = await res.json();
        const runs = (data.check_runs || []).map(r => ({
            name: r.name,
            status: r.status,
            conclusion: r.conclusion ?? null
        }));
        const verified = runs.length > 0 && runs.every(r => r.status === 'completed' && r.conclusion === 'success');
        return { commitSha, verified, runs };
    } catch {
        return empty;
    }
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
 * Builds, stores and links the evidence package to its contribution.
 * Returns the CID, or null if it couldn't be stored. Scoring never fails because of this.
 */
export async function recordContributionEvidence(input, { store, model = ContributionScore, logger = console } = {}) {
    try {
        const evidencePackage = buildEvidencePackage(input);
        const cid = await storeEvidencePackage(evidencePackage, store ? { store } : undefined);

        const { username, repository, prNumber } = input.contribution;
        await model.findOneAndUpdate(
            { username, repository, prNumber },
            { $set: { evidenceCID: cid } }
        );
        return cid;
    } catch (err) {
        logger.warn(`Evidence package not stored: ${err.message}`);
        return null;
    }
}
