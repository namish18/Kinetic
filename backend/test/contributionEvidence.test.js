
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    normalizeEvidence,
    hashEvidence,
    createContributionEvidence,
    verifyContributionScore
} from '../services/contributionEvidenceService.js';

// In-memory fake database for isolated tests.
function createFakeEvidenceModel() {
    const records = new Map();
    let nextId = 1;

    return {
        records,

        async findOne({ evidenceHash }) {
            return [...records.values()].find(
                record => record.evidenceHash === evidenceHash
            ) || null;
        },

        async findById(id) {
            return records.get(String(id)) || null;
        },

        async create(data) {
            const id = String(nextId++);

            const record = {
                _id: id,
                ...structuredClone(data)
            };

            records.set(id, record);
            return record;
        }
    };
}

const algorithmVersion = 'msts-v2.0.0';

function createPayload() {
    return {
        algorithmVersion,
        scoringInputs: {
            base: 8
        },
        configurationSnapshot: {
            bonus: 2
        },
        score: 10
    };
}

async function createTestEvidence() {
    const EvidenceModel = createFakeEvidenceModel();
    const payload = createPayload();

    const evidence = await createContributionEvidence(
        payload,
        EvidenceModel
    );

    // Fixed: include evidence schema version metadata.
    const scoreRecord = {
        evidenceReference: evidence.reference,
        evidenceHash: evidence.evidenceHash,
        evidenceSchemaVersion: evidence.schemaVersion,
        algorithmVersion,
        score: 10
    };

    return {
        EvidenceModel,
        evidence,
        scoreRecord
    };
}

const algorithmRegistry = {
    [algorithmVersion]: (inputs, configuration) =>
        inputs.base + configuration.bonus
};

// 1. Evidence normalization should sort object keys.
test('normalizes evidence with deterministic object keys', () => {
    const first = normalizeEvidence({
        b: 2,
        a: 1
    });

    const second = normalizeEvidence({
        a: 1,
        b: 2
    });

    assert.deepEqual(first, second);
    assert.equal(hashEvidence(first), hashEvidence(second));
});

// 2. Evidence should be saved successfully.
test('creates contribution evidence successfully', async () => {
    const EvidenceModel = createFakeEvidenceModel();

    const result = await createContributionEvidence(
        createPayload(),
        EvidenceModel
    );

    assert.ok(result.reference);
    assert.match(result.evidenceHash, /^[a-f0-9]{64}$/);
    assert.equal(result.schemaVersion, 1);
    assert.equal(EvidenceModel.records.size, 1);
});

// 3. Duplicate evidence should not create another record.
test('reuses existing evidence with the same hash', async () => {
    const EvidenceModel = createFakeEvidenceModel();
    const payload = createPayload();

    const first = await createContributionEvidence(
        payload,
        EvidenceModel
    );

    const second = await createContributionEvidence(
        payload,
        EvidenceModel
    );

    assert.equal(first.reference, second.reference);
    assert.equal(first.evidenceHash, second.evidenceHash);
    assert.equal(EvidenceModel.records.size, 1);
});

// 4. Incomplete evidence should be rejected.
test('rejects incomplete contribution evidence', async () => {
    const EvidenceModel = createFakeEvidenceModel();

    await assert.rejects(
        () => createContributionEvidence(
            { score: 10 },
            EvidenceModel
        ),
        /algorithmVersion is required/
    );
});

// 5. Valid evidence should be independently verified.
test('verifies valid contribution evidence', async () => {
    const {
        EvidenceModel,
        scoreRecord
    } = await createTestEvidence();

    const result = await verifyContributionScore({
        scoreRecord,
        EvidenceModel,
        algorithmRegistry
    });

    assert.equal(result.status, 'verified');
    assert.equal(result.verified, true);
    assert.equal(result.score, 10);
});

// 6. Missing evidence reference should be rejected.
test('rejects a score record without evidence reference', async () => {
    const result = await verifyContributionScore({
        scoreRecord: {
            score: 10,
            algorithmVersion
        }
    });

    assert.equal(result.status, 'evidence_not_found');
    assert.equal(result.verified, false);
});

// 7. Evidence that does not exist should be rejected.
test('detects missing evidence record', async () => {
    const EvidenceModel = createFakeEvidenceModel();

    const result = await verifyContributionScore({
        scoreRecord: {
            evidenceReference: 'missing-id',
            evidenceHash: 'a'.repeat(64),
            evidenceSchemaVersion: 1,
            algorithmVersion,
            score: 10
        },
        EvidenceModel
    });

    assert.equal(result.status, 'evidence_not_found');
});

// 8. Modified evidence should fail integrity verification.
test('detects tampered evidence payload', async () => {
    const {
        EvidenceModel,
        evidence,
        scoreRecord
    } = await createTestEvidence();

    const storedRecord = EvidenceModel.records.get(
        evidence.reference
    );

    storedRecord.payload.score = 999;

    const result = await verifyContributionScore({
        scoreRecord,
        EvidenceModel,
        algorithmRegistry
    });

    assert.equal(result.status, 'integrity_mismatch');
    assert.equal(result.verified, false);
});

// 9. Unsupported algorithm versions should be rejected.
test('rejects unsupported algorithm version', async () => {
    const {
        EvidenceModel,
        scoreRecord
    } = await createTestEvidence();

    const result = await verifyContributionScore({
        scoreRecord,
        EvidenceModel,
        algorithmRegistry: {}
    });

    assert.equal(
        result.status,
        'unsupported_algorithm_version'
    );

    assert.equal(result.verified, false);
});

// 10. Recomputed score mismatch should be detected.
test('detects independently recomputed score mismatch', async () => {
    const {
        EvidenceModel,
        scoreRecord
    } = await createTestEvidence();

    const incorrectRegistry = {
        [algorithmVersion]: () => 99
    };

    const result = await verifyContributionScore({
        scoreRecord,
        EvidenceModel,
        algorithmRegistry: incorrectRegistry
    });

    assert.equal(result.status, 'score_mismatch');
    assert.equal(result.verified, false);
    assert.equal(result.recomputedScore, 99);
});

// 11. Invalid evidence hash format should be rejected.
test('rejects invalid evidence hash format', async () => {
    const {
        EvidenceModel,
        evidence,
        scoreRecord
    } = await createTestEvidence();

    EvidenceModel.records.get(
        evidence.reference
    ).evidenceHash = 'invalid-hash';

    const result = await verifyContributionScore({
        scoreRecord,
        EvidenceModel,
        algorithmRegistry
    });

    assert.equal(result.status, 'invalid_evidence');
    assert.equal(result.verified, false);
});
