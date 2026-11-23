import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    isValidGithubUsername,
    normalizeRepoName,
    isValidRepoIdentifier,
    isValidFlowAddress,
    isValidBranchName,
    isValidWeightValue,
    isValidAmount,
    validateGithubUsernameParam,
    validateFlowWallet,
    validateCompareUsers,
    validateAddRepository,
    validateRepoIdParam,
    validateUpdateBranches,
    validateRepoConfig,
    validateProofOfBuild,
    validateQuadraticFunding,
    isValidEd25519PublicKey,
    isValidEd25519Signature,
    validateRegisterDID
} from '../middleware/validate.js';

// Helper to mock Express req, res, next
function createMockHttp(reqOverrides = {}) {
    let statusCode = null;
    let responseBody = null;
    let nextCalled = false;

    const req = {
        params: {},
        query: {},
        body: {},
        ...reqOverrides
    };

    const res = {
        status(code) {
            statusCode = code;
            return this;
        },
        json(body) {
            responseBody = body;
            return this;
        }
    };

    const next = () => {
        nextCalled = true;
    };

    return {
        req,
        res,
        next,
        getStatus: () => statusCode,
        getBody: () => responseBody,
        wasNextCalled: () => nextCalled
    };
}

describe('1. GitHub Username Validation', () => {
    it('accepts valid usernames', () => {
        assert.equal(isValidGithubUsername('torvalds'), true);
        assert.equal(isValidGithubUsername('gaearon'), true);
        assert.equal(isValidGithubUsername('a'), true);
        assert.equal(isValidGithubUsername('user-name'), true);
        assert.equal(isValidGithubUsername('User-Name-123'), true);
        assert.equal(isValidGithubUsername('a'.repeat(39)), true);
    });

    it('rejects invalid, missing, or malformed usernames', () => {
        assert.equal(isValidGithubUsername(''), false);
        assert.equal(isValidGithubUsername(null), false);
        assert.equal(isValidGithubUsername(undefined), false);
        assert.equal(isValidGithubUsername(12345), false);
        assert.equal(isValidGithubUsername('-starts-with-hyphen'), false);
        assert.equal(isValidGithubUsername('ends-with-hyphen-'), false);
        assert.equal(isValidGithubUsername('consecutive--hyphens'), false);
        assert.equal(isValidGithubUsername('user@name'), false);
        assert.equal(isValidGithubUsername('user name'), false);
        assert.equal(isValidGithubUsername('user/name'), false);
        assert.equal(isValidGithubUsername('a'.repeat(40)), false);
    });

    it('middleware: allows valid username param and rejects invalid with 400', () => {
        const mw = validateGithubUsernameParam('username');

        // Valid
        const validHttp = createMockHttp({ params: { username: 'octocat' } });
        mw(validHttp.req, validHttp.res, validHttp.next);
        assert.equal(validHttp.wasNextCalled(), true);
        assert.equal(validHttp.getStatus(), null);

        // Invalid
        const invalidHttp = createMockHttp({ params: { username: 'invalid_user!' } });
        mw(invalidHttp.req, invalidHttp.res, invalidHttp.next);
        assert.equal(invalidHttp.wasNextCalled(), false);
        assert.equal(invalidHttp.getStatus(), 400);
        assert.equal(invalidHttp.getBody().success, false);
        assert.equal(invalidHttp.getBody().error, 'Validation Error');
        assert.equal(invalidHttp.getBody().details[0].field, 'username');
    });
});

describe('2. Repository Identifier Validation & Normalization', () => {
    it('normalizes various GitHub repository URL formats into owner/repo', () => {
        assert.equal(normalizeRepoName('owner/repo'), 'owner/repo');
        assert.equal(normalizeRepoName('https://github.com/owner/repo'), 'owner/repo');
        assert.equal(normalizeRepoName('http://github.com/owner/repo.git'), 'owner/repo');
        assert.equal(normalizeRepoName('github.com/owner/repo/'), 'owner/repo');
    });

    it('validates repository identifiers correctly', () => {
        assert.equal(isValidRepoIdentifier('namish18/Kinetic'), true);
        assert.equal(isValidRepoIdentifier('https://github.com/facebook/react'), true);
        assert.equal(isValidRepoIdentifier('owner/repo.js'), true);
        assert.equal(isValidRepoIdentifier('org-team/my_repo-1'), true);

        // Invalid
        assert.equal(isValidRepoIdentifier(''), false);
        assert.equal(isValidRepoIdentifier(null), false);
        assert.equal(isValidRepoIdentifier('just-a-repo'), false);
        assert.equal(isValidRepoIdentifier('-invalidOwner/repo'), false);
        assert.equal(isValidRepoIdentifier('owner/'), false);
        assert.equal(isValidRepoIdentifier('/repo'), false);
        assert.equal(isValidRepoIdentifier('owner/repo!'), false);
        assert.equal(isValidRepoIdentifier('owner/repo/extra/path'), false);
    });

    it('middleware: validateAddRepository rejects missing, malformed, or unexpected fields', () => {
        // Missing body
        const missingHttp = createMockHttp({ body: {} });
        validateAddRepository(missingHttp.req, missingHttp.res, missingHttp.next);
        assert.equal(missingHttp.getStatus(), 400);
        assert.equal(missingHttp.getBody().details[0].field, 'repository');

        // Malformed repo
        const malformedHttp = createMockHttp({ body: { repository: 'invalid repo name' } });
        validateAddRepository(malformedHttp.req, malformedHttp.res, malformedHttp.next);
        assert.equal(malformedHttp.getStatus(), 400);

        // Unexpected field
        const unexpectedHttp = createMockHttp({ body: { repository: 'namish18/Kinetic', rogue: true } });
        validateAddRepository(unexpectedHttp.req, unexpectedHttp.res, unexpectedHttp.next);
        assert.equal(unexpectedHttp.getStatus(), 400);
        assert.match(unexpectedHttp.getBody().details[0].message, /Unexpected field/);

        // Valid
        const validHttp = createMockHttp({ body: { repository: 'https://github.com/namish18/Kinetic' } });
        validateAddRepository(validHttp.req, validHttp.res, validHttp.next);
        assert.equal(validHttp.wasNextCalled(), true);
        assert.equal(validHttp.req.normalizedRepo, 'namish18/Kinetic');
    });

    it('middleware: validateRepoIdParam handles route parameter decoding and validation', () => {
        const mw = validateRepoIdParam('repoId');

        const validHttp = createMockHttp({ params: { repoId: encodeURIComponent('namish18/Kinetic') } });
        mw(validHttp.req, validHttp.res, validHttp.next);
        assert.equal(validHttp.wasNextCalled(), true);
        assert.equal(validHttp.req.normalizedRepoId, 'namish18/Kinetic');

        const invalidHttp = createMockHttp({ params: { repoId: 'invalid-repo' } });
        mw(invalidHttp.req, invalidHttp.res, invalidHttp.next);
        assert.equal(invalidHttp.getStatus(), 400);

        // Malformed URI encoding
        const malformedUriHttp = createMockHttp({ params: { repoId: '%E0%A4%A' } });
        mw(malformedUriHttp.req, malformedUriHttp.res, malformedUriHttp.next);
        assert.equal(malformedUriHttp.getStatus(), 400);
    });
});

describe('3. Flow Blockchain Wallet Validation', () => {
    it('accepts valid 8-byte (16 hex chars + 0x) Flow wallet addresses', () => {
        assert.equal(isValidFlowAddress('0x01cf0e2f2f715450'), true);
        assert.equal(isValidFlowAddress('0x1234567890abcdef'), true);
        assert.equal(isValidFlowAddress('0xABCDEF0123456789'), true);
    });

    it('rejects invalid wallet addresses', () => {
        assert.equal(isValidFlowAddress(''), false);
        assert.equal(isValidFlowAddress(null), false);
        assert.equal(isValidFlowAddress(undefined), false);
        assert.equal(isValidFlowAddress(0x12345), false);
        assert.equal(isValidFlowAddress('01cf0e2f2f715450'), false); // missing 0x
        assert.equal(isValidFlowAddress('0x01cf0e2f2f71545'), false);  // too short (15 hex)
        assert.equal(isValidFlowAddress('0x01cf0e2f2f7154500'), false); // too long (17 hex)
        assert.equal(isValidFlowAddress('0x01cf0e2f2f71545z'), false); // non-hex char 'z'
        assert.equal(isValidFlowAddress('0x71C8418C24311b52C06383301C641177699173B0'), false); // ETH address (40 hex)
    });

    it('middleware: validateFlowWallet enforces valid wallet address and rejects unexpected fields', () => {
        const missingHttp = createMockHttp({ body: {} });
        validateFlowWallet(missingHttp.req, missingHttp.res, missingHttp.next);
        assert.equal(missingHttp.getStatus(), 400);
        assert.equal(missingHttp.getBody().details[0].field, 'wallet');

        const invalidHttp = createMockHttp({ body: { wallet: '0xinvalid' } });
        validateFlowWallet(invalidHttp.req, invalidHttp.res, invalidHttp.next);
        assert.equal(invalidHttp.getStatus(), 400);

        const unexpectedFieldHttp = createMockHttp({ body: { wallet: '0x01cf0e2f2f715450', role: 'admin' } });
        validateFlowWallet(unexpectedFieldHttp.req, unexpectedFieldHttp.res, unexpectedFieldHttp.next);
        assert.equal(unexpectedFieldHttp.getStatus(), 400);
        assert.match(unexpectedFieldHttp.getBody().details[0].message, /Unexpected field/);

        const validHttp = createMockHttp({ body: { wallet: '0x01cf0e2f2f715450' } });
        validateFlowWallet(validHttp.req, validHttp.res, validHttp.next);
        assert.equal(validHttp.wasNextCalled(), true);
    });
});

describe('4. Weights and Amounts Validation', () => {
    it('validates weight values between 0.0 and 1.0', () => {
        assert.equal(isValidWeightValue(0), true);
        assert.equal(isValidWeightValue(0.2), true);
        assert.equal(isValidWeightValue(1.0), true);
        assert.equal(isValidWeightValue(-0.1), false);
        assert.equal(isValidWeightValue(1.1), false);
        assert.equal(isValidWeightValue('0.5'), false);
        assert.equal(isValidWeightValue(NaN), false);
        assert.equal(isValidWeightValue(Infinity), false);
    });

    it('validates amounts with and without zero allowed', () => {
        assert.equal(isValidAmount(100, { allowZero: false }), true);
        assert.equal(isValidAmount(0.01, { allowZero: false }), true);
        assert.equal(isValidAmount(0, { allowZero: false }), false);
        assert.equal(isValidAmount(-50, { allowZero: false }), false);
        assert.equal(isValidAmount('100', { allowZero: false }), false);

        assert.equal(isValidAmount(0, { allowZero: true }), true);
        assert.equal(isValidAmount(500, { allowZero: true }), true);
        assert.equal(isValidAmount(-1, { allowZero: true }), false);
    });

    it('middleware: validateRepoConfig enforces weight ranges, positive bountyPool, and rejects unknown fields', () => {
        // Unknown field
        const unknownHttp = createMockHttp({
            body: {
                targetBranches: ['main'],
                hackerField: 'drop_database'
            }
        });
        validateRepoConfig(unknownHttp.req, unknownHttp.res, unknownHttp.next);
        assert.equal(unknownHttp.getStatus(), 400);
        assert.match(unknownHttp.getBody().details[0].message, /Unexpected field/);

        // Out-of-range weight
        const badWeightHttp = createMockHttp({
            body: {
                weights: { impact: 1.5, complexity: 0.2 }
            }
        });
        validateRepoConfig(badWeightHttp.req, badWeightHttp.res, badWeightHttp.next);
        assert.equal(badWeightHttp.getStatus(), 400);

        // Negative bountyPool
        const badBountyHttp = createMockHttp({
            body: {
                bountyPool: -100
            }
        });
        validateRepoConfig(badBountyHttp.req, badBountyHttp.res, badBountyHttp.next);
        assert.equal(badBountyHttp.getStatus(), 400);

        // Empty body
        const emptyHttp = createMockHttp({ body: {} });
        validateRepoConfig(emptyHttp.req, emptyHttp.res, emptyHttp.next);
        assert.equal(emptyHttp.getStatus(), 400);

        // Valid payload
        const validHttp = createMockHttp({
            body: {
                targetBranches: ['main', 'develop'],
                weights: { impact: 0.3, complexity: 0.2, quality: 0.2, review: 0.15, priority: 0.15 },
                bountyPool: 500
            }
        });
        validateRepoConfig(validHttp.req, validHttp.res, validHttp.next);
        assert.equal(validHttp.wasNextCalled(), true);
    });
});

describe('5. Branch and Compare Query Validation', () => {
    it('validates branch names according to Git rules', () => {
        assert.equal(isValidBranchName('main'), true);
        assert.equal(isValidBranchName('feature/my-branch'), true);
        assert.equal(isValidBranchName('release-1.0'), true);

        assert.equal(isValidBranchName(''), false);
        assert.equal(isValidBranchName('branch with spaces'), false);
        assert.equal(isValidBranchName('branch~1'), false);
        assert.equal(isValidBranchName('branch^2'), false);
        assert.equal(isValidBranchName('branch:colon'), false);
        assert.equal(isValidBranchName('branch..name'), false);
    });

    it('middleware: validateUpdateBranches rejects invalid branches and unexpected fields', () => {
        const emptyHttp = createMockHttp({ body: { targetBranches: [] } });
        validateUpdateBranches(emptyHttp.req, emptyHttp.res, emptyHttp.next);
        assert.equal(emptyHttp.getStatus(), 400);

        const badBranchHttp = createMockHttp({ body: { targetBranches: ['main', 'bad branch with space'] } });
        validateUpdateBranches(badBranchHttp.req, badBranchHttp.res, badBranchHttp.next);
        assert.equal(badBranchHttp.getStatus(), 400);

        const unexpectedHttp = createMockHttp({ body: { targetBranches: ['main'], extra: 123 } });
        validateUpdateBranches(unexpectedHttp.req, unexpectedHttp.res, unexpectedHttp.next);
        assert.equal(unexpectedHttp.getStatus(), 400);
        assert.match(unexpectedHttp.getBody().details[0].message, /Unexpected field/);

        const validHttp = createMockHttp({ body: { targetBranches: ['main', 'dev'] } });
        validateUpdateBranches(validHttp.req, validHttp.res, validHttp.next);
        assert.equal(validHttp.wasNextCalled(), true);
    });

    it('middleware: validateCompareUsers enforces comma-separated valid usernames up to 5', () => {
        // Missing query
        const missingHttp = createMockHttp({ query: {} });
        validateCompareUsers(missingHttp.req, missingHttp.res, missingHttp.next);
        assert.equal(missingHttp.getStatus(), 400);

        // More than 5 users
        const tooManyHttp = createMockHttp({ query: { users: 'u1,u2,u3,u4,u5,u6' } });
        validateCompareUsers(tooManyHttp.req, tooManyHttp.res, tooManyHttp.next);
        assert.equal(tooManyHttp.getStatus(), 400);

        // Invalid user
        const invalidUserHttp = createMockHttp({ query: { users: 'octocat,invalid@user' } });
        validateCompareUsers(invalidUserHttp.req, invalidUserHttp.res, invalidUserHttp.next);
        assert.equal(invalidUserHttp.getStatus(), 400);

        // Valid
        const validHttp = createMockHttp({ query: { users: 'torvalds, gaearon, octocat' } });
        validateCompareUsers(validHttp.req, validHttp.res, validHttp.next);
        assert.equal(validHttp.wasNextCalled(), true);
        assert.deepEqual(validHttp.req.validatedUsers, ['torvalds', 'gaearon', 'octocat']);
    });
});

describe('6. Kinetic Mechanism Payloads (Proof-of-Build & Quadratic Funding)', () => {
    it('middleware: validateProofOfBuild validates repo and numeric runId query params', () => {
        const missingRepoHttp = createMockHttp({ query: { runId: '12345' } });
        validateProofOfBuild(missingRepoHttp.req, missingRepoHttp.res, missingRepoHttp.next);
        assert.equal(missingRepoHttp.getStatus(), 400);

        const nonNumericRunIdHttp = createMockHttp({ query: { repo: 'owner/repo', runId: 'not-a-number' } });
        validateProofOfBuild(nonNumericRunIdHttp.req, nonNumericRunIdHttp.res, nonNumericRunIdHttp.next);
        assert.equal(nonNumericRunIdHttp.getStatus(), 400);

        const validHttp = createMockHttp({ query: { repo: 'namish18/Kinetic', runId: '987654321' } });
        validateProofOfBuild(validHttp.req, validHttp.res, validHttp.next);
        assert.equal(validHttp.wasNextCalled(), true);
        assert.equal(validHttp.req.normalizedRepo, 'namish18/Kinetic');
    });

    it('middleware: validateQuadraticFunding rejects malformed pool amounts, project structures, and unexpected fields', () => {
        // Unexpected root field
        const unexpectedHttp = createMockHttp({
            body: {
                poolAmount: 1000,
                projects: [{ name: 'Project A', voters: [{ mstsScore: 10 }] }],
                unwantedField: 'bad'
            }
        });
        validateQuadraticFunding(unexpectedHttp.req, unexpectedHttp.res, unexpectedHttp.next);
        assert.equal(unexpectedHttp.getStatus(), 400);
        assert.match(unexpectedHttp.getBody().details[0].message, /Unexpected field/);

        // Missing poolAmount
        const missingPoolHttp = createMockHttp({
            body: {
                projects: [{ name: 'Project A', voters: [{ mstsScore: 10 }] }]
            }
        });
        validateQuadraticFunding(missingPoolHttp.req, missingPoolHttp.res, missingPoolHttp.next);
        assert.equal(missingPoolHttp.getStatus(), 400);

        // Negative poolAmount
        const negPoolHttp = createMockHttp({
            body: {
                poolAmount: -500,
                projects: [{ name: 'Project A', voters: [{ mstsScore: 10 }] }]
            }
        });
        validateQuadraticFunding(negPoolHttp.req, negPoolHttp.res, negPoolHttp.next);
        assert.equal(negPoolHttp.getStatus(), 400);

        // Empty projects
        const emptyProjectsHttp = createMockHttp({
            body: {
                poolAmount: 1000,
                projects: []
            }
        });
        validateQuadraticFunding(emptyProjectsHttp.req, emptyProjectsHttp.res, emptyProjectsHttp.next);
        assert.equal(emptyProjectsHttp.getStatus(), 400);

        // Project missing name
        const badProjectHttp = createMockHttp({
            body: {
                poolAmount: 1000,
                projects: [{ voters: [{ mstsScore: 10 }] }]
            }
        });
        validateQuadraticFunding(badProjectHttp.req, badProjectHttp.res, badProjectHttp.next);
        assert.equal(badProjectHttp.getStatus(), 400);

        // Voter with negative mstsScore
        const badVoterHttp = createMockHttp({
            body: {
                poolAmount: 1000,
                projects: [{ name: 'Kinetic', voters: [{ mstsScore: -5 }] }]
            }
        });
        validateQuadraticFunding(badVoterHttp.req, badVoterHttp.res, badVoterHttp.next);
        assert.equal(badVoterHttp.getStatus(), 400);

        // Valid quadratic funding payload
        const validHttp = createMockHttp({
            body: {
                poolAmount: 10000,
                projects: [
                    {
                        name: 'Kinetic Core',
                        voters: [
                            { voter: 'user1', mstsScore: 100 },
                            { voter: 'user2', mstsScore: 25 }
                        ]
                    }
                ]
            }
        });
        validateQuadraticFunding(validHttp.req, validHttp.res, validHttp.next);
        assert.equal(validHttp.wasNextCalled(), true);
    });
});

describe('7. Contributor DID Registration Payload Validation (DID-01)', () => {
    const validPubKey = 'a'.repeat(64);
    const validSig = 'b'.repeat(128);
    const validMsg = 'Challenge non-empty string';

    it('validates Ed25519 public key and signature formats', () => {
        assert.equal(isValidEd25519PublicKey(validPubKey), true);
        assert.equal(isValidEd25519PublicKey('0x' + validPubKey), true);
        assert.equal(isValidEd25519PublicKey('shortKey'), false);
        assert.equal(isValidEd25519PublicKey(null), false);
        assert.equal(isValidEd25519PublicKey(12345), false);

        assert.equal(isValidEd25519Signature(validSig), true);
        assert.equal(isValidEd25519Signature('0x' + validSig), true);
        assert.equal(isValidEd25519Signature('invalidSig'), false);
        assert.equal(isValidEd25519Signature(null), false);
    });

    it('middleware: rejects non-object or missing required fields with 400', () => {
        const notObj = createMockHttp({ body: 'not-an-object' });
        validateRegisterDID(notObj.req, notObj.res, notObj.next);
        assert.equal(notObj.getStatus(), 400);

        const missingAll = createMockHttp({ body: {} });
        validateRegisterDID(missingAll.req, missingAll.res, missingAll.next);
        assert.equal(missingAll.getStatus(), 400);
        assert.equal(missingAll.getBody().details.length, 3);
    });

    it('middleware: rejects malformed keys, invalid signatures, or unexpected fields', () => {
        const malformed = createMockHttp({
            body: {
                publicKey: 'invalid-hex',
                signature: 'short',
                message: '',
                extraField: 'hacker'
            }
        });
        validateRegisterDID(malformed.req, malformed.res, malformed.next);
        assert.equal(malformed.getStatus(), 400);
        assert.ok(malformed.getBody().details.some(d => d.field === 'body'));
        assert.ok(malformed.getBody().details.some(d => d.field === 'publicKey'));
        assert.ok(malformed.getBody().details.some(d => d.field === 'signature'));
        assert.ok(malformed.getBody().details.some(d => d.field === 'message'));
    });

    it('middleware: allows valid contributor registration payload', () => {
        const valid = createMockHttp({
            body: {
                publicKey: validPubKey,
                signature: validSig,
                message: validMsg
            }
        });
        validateRegisterDID(valid.req, valid.res, valid.next);
        assert.equal(valid.wasNextCalled(), true);
    });
});


