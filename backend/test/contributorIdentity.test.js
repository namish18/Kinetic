import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import nacl from 'tweetnacl';

import {
    publicKeyToDidKey,
    didKeyToPublicKey,
    buildDIDDocument,
    buildDIDFromPublicKey,
    verifyContributorSignature,
    buildIdentityDocument,
    authenticateDID
} from '../services/didService.js';

describe('DID-01: Contributor-Controlled Identity Service', () => {
    it('generates did:key and W3C DID document purely from contributor public key', () => {
        // Contributor generates their keypair locally
        const contributorKeyPair = nacl.sign.keyPair();
        const { publicKey } = contributorKeyPair;

        const { didString, didDocument, rawPublicKey } = buildDIDFromPublicKey(publicKey);

        assert.ok(didString.startsWith('did:key:z'), 'DID must follow did:key:z format');
        assert.deepEqual(rawPublicKey, publicKey);
        assert.equal(didDocument.id, didString);
        assert.equal(didDocument.verificationMethod.length, 1);
        assert.equal(didDocument.verificationMethod[0].controller, didString);
        assert.equal(didDocument.verificationMethod[0].type, 'Ed25519VerificationKey2018');
        assert.ok(didDocument.authentication.includes(didDocument.verificationMethod[0].id));
    });

    it('round-trips public key to did:key and extracts public key back', () => {
        const contributorKeyPair = nacl.sign.keyPair();
        const did = publicKeyToDidKey(contributorKeyPair.publicKey);
        const extracted = didKeyToPublicKey(did);

        assert.deepEqual(extracted, contributorKeyPair.publicKey);
    });

    it('verifies cryptographic proof of possession with contributor signature', () => {
        const contributorKeyPair = nacl.sign.keyPair();
        const challengeMessage = 'Register Kinetic DID for contributor @alice at 2026-11-08T20:00:00Z';
        const messageBytes = new TextEncoder().encode(challengeMessage);

        // Contributor signs with their local private key
        const detachedSignature = nacl.sign.detached(messageBytes, contributorKeyPair.secretKey);

        // Server verifies signature using only public key and challenge
        const isValid = verifyContributorSignature({
            publicKey: contributorKeyPair.publicKey,
            signature: detachedSignature,
            message: challengeMessage
        });
        assert.equal(isValid, true, 'Valid signature must verify successfully');

        // Tampered message fails verification
        const isTamperedMsgValid = verifyContributorSignature({
            publicKey: contributorKeyPair.publicKey,
            signature: detachedSignature,
            message: 'Tampered challenge message'
        });
        assert.equal(isTamperedMsgValid, false, 'Tampered message must fail verification');

        // Wrong signer fails verification
        const otherKeyPair = nacl.sign.keyPair();
        const isWrongKeyValid = verifyContributorSignature({
            publicKey: otherKeyPair.publicKey,
            signature: detachedSignature,
            message: challengeMessage
        });
        assert.equal(isWrongKeyValid, false, 'Signature from different keypair must fail');
    });

    it('verifies hex-encoded public key and signature strings', () => {
        const contributorKeyPair = nacl.sign.keyPair();
        const challenge = 'Kinetic DID Registration Nonce: 987654321';
        const signature = nacl.sign.detached(new TextEncoder().encode(challenge), contributorKeyPair.secretKey);

        const pubKeyHex = Buffer.from(contributorKeyPair.publicKey).toString('hex');
        const sigHex = Buffer.from(signature).toString('hex');

        const isValid = verifyContributorSignature({
            publicKey: pubKeyHex,
            signature: sigHex,
            message: challenge
        });
        assert.equal(isValid, true, 'Hex strings must verify successfully');
    });

    it('builds enriched identity document without private key material', () => {
        const contributorKeyPair = nacl.sign.keyPair();
        const { didString, didDocument } = buildDIDFromPublicKey(contributorKeyPair.publicKey);

        const profile = {
            id: 123456,
            username: 'contributor-bob',
            displayName: 'Bob Builder',
            photos: [{ value: 'https://example.com/bob.png' }]
        };

        const identityDoc = buildIdentityDocument(profile, didString, didDocument, '0x01cf0e2f2f715450');

        assert.equal(identityDoc.id, didString);
        assert.equal(identityDoc.github, 'contributor-bob');
        assert.equal(identityDoc.githubId, '123456');
        assert.equal(identityDoc.displayName, 'Bob Builder');
        assert.equal(identityDoc.wallet, '0x01cf0e2f2f715450');
        // Ensure no private key material is included in the document
        assert.equal(identityDoc.secretKey, undefined);
        assert.equal(identityDoc.privateKey, undefined);
    });

    it('authenticates and builds DID from contributor-controlled public key using authenticateDID', () => {
        const contributorKeyPair = nacl.sign.keyPair();
        const { didString, didDocument } = authenticateDID(contributorKeyPair.publicKey);
        assert.ok(didString.startsWith('did:key:z'));
        assert.equal(didDocument.id, didString);

        // Also accepts proof object
        const challenge = 'Challenge string';
        const sig = nacl.sign.detached(new TextEncoder().encode(challenge), contributorKeyPair.secretKey);
        const res = authenticateDID({
            publicKey: contributorKeyPair.publicKey,
            signature: sig,
            message: challenge
        });
        assert.equal(res.didString, didString);
    });

    it('throws error if legacy server-derived authenticateDID is called with githubId or non-key', () => {
        assert.throws(
            () => authenticateDID(12345),
            /Server-derived private key generation from GitHub ID has been removed \(DID-01\)/
        );
        assert.throws(
            () => authenticateDID('987654'),
            /Server-derived private key generation from GitHub ID has been removed \(DID-01\)/
        );
    });

    it('simulates end-to-end contributor key registration and resolution workflow', async () => {
        // Step 1: Contributor creates keypair client-side
        const contributorKeyPair = nacl.sign.keyPair();
        const pubKeyHex = Buffer.from(contributorKeyPair.publicKey).toString('hex');

        // Step 2: Contributor creates challenge & detached signature
        const challenge = 'Kinetic DID Registration for @charlie at 2026-11-08T21:00:00Z';
        const signatureBytes = nacl.sign.detached(new TextEncoder().encode(challenge), contributorKeyPair.secretKey);
        const signatureHex = Buffer.from(signatureBytes).toString('hex');

        // Step 3: Mock user document in MongoDB
        const mockUser = {
            id: 'mock_user_123',
            github: 'charlie',
            displayName: 'Charlie OSS',
            did: null,
            ipfsCID: null,
            didDocument: null,
            wallet: '0x01cf0e2f2f715450',
            saved: false,
            async save() {
                this.saved = true;
            }
        };

        // Step 4: Server verification of proof of possession
        const isValid = verifyContributorSignature({
            publicKey: pubKeyHex,
            signature: signatureHex,
            message: challenge
        });
        assert.equal(isValid, true, 'Cryptographic proof must be verified');

        // Step 5: Server builds DID document & identity document (no private key)
        const { didString, didDocument } = buildDIDFromPublicKey(pubKeyHex);
        const identityDoc = buildIdentityDocument(mockUser, didString, didDocument, mockUser.wallet);

        mockUser.did = didString;
        mockUser.didDocument = identityDoc;
        mockUser.ipfsCID = 'bafyrei_mock_cid_12345';
        await mockUser.save();

        assert.equal(mockUser.saved, true);
        assert.ok(mockUser.did.startsWith('did:key:z'));
        assert.equal(mockUser.didDocument.id, mockUser.did);
        assert.equal(mockUser.didDocument.github, 'charlie');
        assert.equal(mockUser.didDocument.secretKey, undefined, 'Server must never store secretKey');

        // Step 6: Contributor self-resolves DID without generating or storing private keys on server
        assert.equal(mockUser.did, didString);
        assert.equal(mockUser.didDocument.verificationMethod[0].controller, didString);
    });

    it('rejects registration when cryptographic signature fails verification', () => {
        const contributorKeyPair = nacl.sign.keyPair();
        const pubKeyHex = Buffer.from(contributorKeyPair.publicKey).toString('hex');
        const challenge = 'Valid challenge string';
        
        // Signed with a different keypair
        const attackerKeyPair = nacl.sign.keyPair();
        const fakeSig = nacl.sign.detached(new TextEncoder().encode(challenge), attackerKeyPair.secretKey);
        const fakeSigHex = Buffer.from(fakeSig).toString('hex');

        const isValid = verifyContributorSignature({
            publicKey: pubKeyHex,
            signature: fakeSigHex,
            message: challenge
        });

        assert.equal(isValid, false, 'Signature from non-owner must be rejected');
    });
});
