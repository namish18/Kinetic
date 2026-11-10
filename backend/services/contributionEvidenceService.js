
import { createHash } from 'node:crypto';
import ContributionEvidence from '../models/ContributionEvidence.js';

export const EVIDENCE_SCHEMA_VERSION = 1;

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function isPlainObject(value) {
    if (value === null || typeof value !== 'object') {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return (
        prototype === Object.prototype ||
        prototype === null
    );
}

/**
 * Converts evidence into deterministic JSON-compatible data.
 * Object keys are sorted recursively so the hash is stable.
 */
export function normalizeEvidence(value, path = '$') {
    if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'boolean'
    ) {
        return value;
    }

    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new TypeError(`Invalid number at ${path}`);
        }

        return value;
    }

    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
            throw new TypeError(`Invalid date at ${path}`);
        }

        return value.toISOString();
    }

    if (Array.isArray(value)) {
        return value.map((item, index) =>
            normalizeEvidence(item, `${path}[${index}]`)
        );
    }

    if (isPlainObject(value)) {
        const normalized = {};

        for (const key of Object.keys(value).sort()) {
            if (value[key] === undefined) {
                throw new TypeError(
                    `Undefined value is not allowed at ${path}.${key}`
                );
            }

            normalized[key] = normalizeEvidence(
                value[key],
                `${path}.${key}`
            );
        }

        return normalized;
    }

    throw new TypeError(`Unsupported evidence value at ${path}`);
}

export function canonicalizeEvidence(payload) {
    return JSON.stringify(normalizeEvidence(payload));
}

export function hashEvidence(payload) {
    return createHash('sha256')
        .update(canonicalizeEvidence(payload), 'utf8')
        .digest('hex');
}

/**
 * Creates an immutable evidence record.
 * The schema version is controlled by this service, not by the caller.
 */
export async function createContributionEvidence(
    payload,
    EvidenceModel = ContributionEvidence
) {
    if (!isPlainObject(payload)) {
        throw new TypeError('Evidence payload must be a plain object.');
    }

    if (
        payload.schemaVersion !== undefined &&
        payload.schemaVersion !== EVIDENCE_SCHEMA_VERSION
    ) {
        throw new Error('Unsupported evidence schema version.');
    }

    const normalizedPayload = normalizeEvidence({
        ...payload,
        schemaVersion: EVIDENCE_SCHEMA_VERSION
    });

    if (
        typeof normalizedPayload.algorithmVersion !== 'string' ||
        !normalizedPayload.algorithmVersion.trim()
    ) {
        throw new Error('algorithmVersion is required.');
    }

    if (
        !normalizedPayload.scoringInputs ||
        typeof normalizedPayload.scoringInputs !== 'object'
    ) {
        throw new Error('scoringInputs are required.');
    }

    if (
        !normalizedPayload.configurationSnapshot ||
        typeof normalizedPayload.configurationSnapshot !== 'object'
    ) {
        throw new Error('configurationSnapshot is required.');
    }

    if (
        typeof normalizedPayload.score !== 'number' ||
        !Number.isFinite(normalizedPayload.score)
    ) {
        throw new Error('A finite score is required.');
    }

    const evidenceHash = hashEvidence(normalizedPayload);

    const existing = await EvidenceModel.findOne({ evidenceHash });

    if (existing) {
        return {
            reference: existing._id,
            evidenceHash: existing.evidenceHash,
            schemaVersion: existing.schemaVersion,
            payload: existing.payload,
            created: false
        };
    }

    try {
        const evidence = await EvidenceModel.create({
            schemaVersion: EVIDENCE_SCHEMA_VERSION,
            evidenceHash,
            payload: normalizedPayload
        });

        return {
            reference: evidence._id,
            evidenceHash: evidence.evidenceHash,
            schemaVersion: evidence.schemaVersion,
            payload: evidence.payload,
            created: true
        };
    } catch (error) {
        // Handle simultaneous duplicate evidence creation.
        if (error?.code === 11000) {
            const duplicate = await EvidenceModel.findOne({
                evidenceHash
            });

            if (duplicate) {
                return {
                    reference: duplicate._id,
                    evidenceHash: duplicate.evidenceHash,
                    schemaVersion: duplicate.schemaVersion,
                    payload: duplicate.payload,
                    created: false
                };
            }
        }

        throw error;
    }
}

/**
 * Independently verifies a persisted contribution score.
 *
 * algorithmRegistry format:
 * {
 *   'msts-v2.0.0': (scoringInputs, configurationSnapshot) => number
 * }
 */
export async function verifyContributionScore({
    scoreRecord,
    EvidenceModel = ContributionEvidence,
    algorithmRegistry = {},
    tolerance = 1e-9
}) {
    const fail = (status, message) => ({
        verified: false,
        status,
        message
    });

    if (!scoreRecord) {
        return fail(
            'score_not_found',
            'Contribution score was not found.'
        );
    }

    if (
        !Number.isFinite(tolerance) ||
        tolerance < 0
    ) {
        return fail(
            'invalid_tolerance',
            'Verification tolerance is invalid.'
        );
    }

    const evidenceReference = scoreRecord.evidenceReference;
    const expectedHash = scoreRecord.evidenceHash;

    if (!evidenceReference || !expectedHash) {
        return fail(
            'evidence_not_found',
            'This contribution score has no linked evidence.'
        );
    }

    // Validate the hash saved in the contribution score.
    if (
        typeof expectedHash !== 'string' ||
        !SHA256_PATTERN.test(expectedHash)
    ) {
        return fail(
            'invalid_evidence',
            'The stored score evidence hash has an invalid format.'
        );
    }

    let evidence;

    try {
        evidence = await EvidenceModel.findById(evidenceReference);
    } catch {
        return fail(
            'invalid_evidence',
            'The evidence record could not be retrieved.'
        );
    }

    if (!evidence) {
        return fail(
            'evidence_not_found',
            'The linked evidence record does not exist.'
        );
    }

    // FIX: Validate the hash stored inside the evidence record too.
    // This must happen BEFORE calculating and comparing hashes.
    if (
        typeof evidence.evidenceHash !== 'string' ||
        !SHA256_PATTERN.test(evidence.evidenceHash)
    ) {
        return fail(
            'invalid_evidence',
            'The evidence record hash has an invalid format.'
        );
    }

    if (
        evidence.schemaVersion !== EVIDENCE_SCHEMA_VERSION ||
        scoreRecord.evidenceSchemaVersion !== evidence.schemaVersion
    ) {
        return fail(
            'unsupported_evidence_schema',
            'The evidence schema version is not supported.'
        );
    }

    if (
        !evidence.payload ||
        typeof evidence.payload !== 'object'
    ) {
        return fail(
            'invalid_evidence',
            'The evidence payload is missing or invalid.'
        );
    }

    let calculatedHash;

    try {
        calculatedHash = hashEvidence(evidence.payload);
    } catch {
        return fail(
            'invalid_evidence',
            'The evidence payload cannot be canonicalized.'
        );
    }

    if (
        calculatedHash !== evidence.evidenceHash ||
        calculatedHash !== expectedHash
    ) {
        return fail(
            'integrity_mismatch',
            'Evidence integrity check failed. The evidence may have been altered.'
        );
    }

    const payload = evidence.payload;

    if (
        payload.schemaVersion !== EVIDENCE_SCHEMA_VERSION ||
        payload.algorithmVersion !== scoreRecord.algorithmVersion ||
        payload.score !== scoreRecord.score
    ) {
        return fail(
            'score_mismatch',
            'The persisted score metadata does not match its evidence.'
        );
    }

    const scorer = algorithmRegistry[payload.algorithmVersion];

    if (typeof scorer !== 'function') {
        return fail(
            'unsupported_algorithm_version',
            `No independent verifier is registered for ${payload.algorithmVersion}.`
        );
    }

    let recomputedScore;

    try {
        recomputedScore = await scorer(
            payload.scoringInputs,
            payload.configurationSnapshot
        );

        if (
            recomputedScore &&
            typeof recomputedScore === 'object' &&
            Object.prototype.hasOwnProperty.call(recomputedScore, 'score')
        ) {
            recomputedScore = recomputedScore.score;
        }
    } catch {
        return fail(
            'verification_error',
            'The independent scoring algorithm could not reproduce the score.'
        );
    }

    if (
        typeof recomputedScore !== 'number' ||
        !Number.isFinite(recomputedScore)
    ) {
        return fail(
            'invalid_evidence',
            'The independent algorithm returned an invalid score.'
        );
    }

    // FIX: Return recomputedScore as expected by the tests.
    if (Math.abs(recomputedScore - payload.score) > tolerance) {
        return {
            ...fail(
                'score_mismatch',
                'The independently reproduced score does not match the stored score.'
            ),
            expectedScore: payload.score,
            recomputedScore,
            reproducedScore: recomputedScore
        };
    }

    return {
        verified: true,
        status: 'verified',
        message: 'Evidence integrity and contribution score were successfully verified.',
        score: payload.score,
        algorithmVersion: payload.algorithmVersion,
        evidenceHash: calculatedHash,
        schemaVersion: evidence.schemaVersion
    };
}
