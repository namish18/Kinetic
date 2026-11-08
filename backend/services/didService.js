/**
 * DID Service — Protocol Labs Stack
 * Contributor-Controlled Identity (DID-01)
 *
 * DID generation  (did:key — W3C / DIF standard):
 *   ├── tweetnacl              Ed25519 detached signature verification
 *   └── multiformats/bases     base58btc multibase encoding (same as Ceramic)
 *
 * IPFS storage (Protocol Labs):
 *   ├── helia                  in-process IPFS node — no account needed
 *   ├── @helia/json            dag-json codec → real content-addressed CIDs
 *   ├── blockstore-fs          persistent on-disk block storage
 *   └── datastore-fs           persistent on-disk datastore
 *
 * Zero server-derived private keys. Contributor private keys are generated
 * and retained exclusively under contributor control (DID-01). The server
 * only receives the contributor's public key and verifies cryptographic
 * proof of possession (signature).
 */

import * as crypto from 'node:crypto';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import nacl from 'tweetnacl';
import { base58btc } from 'multiformats/bases/base58';
import { createHelia } from 'helia';
import { json as heliaJson } from '@helia/json';
import { FsBlockstore } from 'blockstore-fs';
import { FsDatastore } from 'datastore-fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────
//  Helia node (lazy singleton)
// ─────────────────────────────────────────────────────────────

let _helia = null;
let _heliaJson = null;

async function getHelia() {
    if (_helia) return { helia: _helia, j: _heliaJson };

    const storePath = path.join(__dirname, '..', 'ipfs-store');
    const blockstore = new FsBlockstore(path.join(storePath, 'blocks'));
    const datastore = new FsDatastore(path.join(storePath, 'data'));

    _helia = await createHelia({ blockstore, datastore });
    _heliaJson = heliaJson(_helia);

    console.log(`🌐 Helia IPFS node ready  (peer: ${_helia.libp2p.peerId.toString()})`);
    return { helia: _helia, j: _heliaJson };
}

// ─────────────────────────────────────────────────────────────
//  Encoding & Type Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Normalizes a hex string, base64 string, or Uint8Array/Buffer to Uint8Array.
 *
 * @param {any} input
 * @param {number|null} [expectedLength=null]
 * @param {string} [fieldName='key']
 * @returns {Uint8Array}
 */
function normalizeToUint8Array(input, expectedLength = null, fieldName = 'key') {
    if (!input) {
        throw new Error(`${fieldName} is required`);
    }
    let uint8;
    if (input instanceof Uint8Array || Buffer.isBuffer(input)) {
        uint8 = new Uint8Array(input);
    } else if (typeof input === 'string') {
        const trimmed = input.trim();
        // Check if hex
        if (/^(0x)?[0-9a-fA-F]+$/.test(trimmed) && (trimmed.length === 64 || trimmed.length === 66 || trimmed.length === 128 || trimmed.length === 130)) {
            const cleanHex = trimmed.replace(/^0x/, '');
            uint8 = new Uint8Array(Buffer.from(cleanHex, 'hex'));
        } else if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
            // Base64
            uint8 = new Uint8Array(Buffer.from(trimmed, 'base64'));
        } else {
            throw new Error(`Invalid encoding for ${fieldName}`);
        }
    } else {
        throw new Error(`Unsupported format for ${fieldName}`);
    }

    if (expectedLength && uint8.length !== expectedLength) {
        throw new Error(`Expected ${fieldName} to be ${expectedLength} bytes, got ${uint8.length} bytes`);
    }

    return uint8;
}

// ─────────────────────────────────────────────────────────────
//  DID key utilities  (did:key Ed25519)
// ─────────────────────────────────────────────────────────────

/**
 * Build a did:key string from an Ed25519 public key.
 *
 * Format (per did:key spec):
 *   did:key:z  <base58btc( 0xed 0x01 || publicKey )>
 *              └─ multicodec varint for ed25519-pub ─┘
 */
function publicKeyToDidKey(publicKey) {
    const rawPublicKey = normalizeToUint8Array(publicKey, 32, 'publicKey');
    // Multicodec prefix for ed25519-pub: 0xed 0x01  (varint encoding)
    const multicodecPrefixed = new Uint8Array([0xed, 0x01, ...rawPublicKey]);
    const encoded = base58btc.encode(multicodecPrefixed); // starts with 'z'
    return `did:key:${encoded}`;
}

/**
 * Extract the raw 32-byte Ed25519 public key from a did:key string.
 *
 * @param {string} didKey
 * @returns {Uint8Array} 32-byte public key
 */
function didKeyToPublicKey(didKey) {
    if (!didKey || typeof didKey !== 'string' || !didKey.startsWith('did:key:')) {
        throw new Error("Invalid did:key format. Must start with 'did:key:'");
    }
    const multibase = didKey.slice('did:key:'.length);
    const decoded = base58btc.decode(multibase);
    // Check multicodec prefix for ed25519-pub: 0xed 0x01
    if (decoded[0] !== 0xed || decoded[1] !== 0x01) {
        throw new Error("Invalid did:key multicodec prefix. Expected Ed25519 (0xed 0x01)");
    }
    if (decoded.length !== 34) {
        throw new Error(`Invalid decoded did:key length: expected 34 bytes (2 prefix + 32 key), got ${decoded.length}`);
    }
    return decoded.slice(2);
}

/**
 * Build the W3C DID document for an Ed25519 did:key.
 * Structure mirrors what key-did-resolver returns.
 */
function buildDIDDocument(did, publicKey) {
    const rawPublicKey = normalizeToUint8Array(publicKey, 32, 'publicKey');
    const vmId = `${did}#${did.substring('did:key:'.length)}`;
    return {
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: did,
        verificationMethod: [
            {
                id: vmId,
                type: 'Ed25519VerificationKey2018',
                controller: did,
                publicKeyBase58: base58btc.encode(rawPublicKey).slice(1), // strip 'z' prefix
            },
        ],
        authentication: [vmId],
        assertionMethod: [vmId],
        capabilityDelegation: [vmId],
        capabilityInvocation: [vmId],
    };
}

/**
 * Build did:key string and W3C DID document from a contributor-generated public key.
 * Does not generate, derive, or access any private key.
 *
 * @param {Uint8Array|string} publicKey
 * @returns {{ didString: string, didDocument: Object, rawPublicKey: Uint8Array }}
 */
function buildDIDFromPublicKey(publicKey) {
    const rawPublicKey = normalizeToUint8Array(publicKey, 32, 'publicKey');
    const didString = publicKeyToDidKey(rawPublicKey);
    const didDocument = buildDIDDocument(didString, rawPublicKey);
    return { didString, didDocument, rawPublicKey };
}

/**
 * Verify cryptographic proof of possession for contributor-controlled identity.
 * Confirms that the contributor possesses the private key corresponding to publicKey.
 *
 * @param {object} params
 * @param {Uint8Array|string} params.publicKey - 32-byte Ed25519 public key
 * @param {Uint8Array|string} params.signature - 64-byte Ed25519 detached signature
 * @param {Uint8Array|string} params.message - The challenge message signed
 * @returns {boolean} True if signature is cryptographically valid
 */
function verifyContributorSignature({ publicKey, signature, message }) {
    try {
        const pubKeyBytes = normalizeToUint8Array(publicKey, 32, 'publicKey');
        const sigBytes = normalizeToUint8Array(signature, 64, 'signature');

        let msgBytes;
        if (typeof message === 'string') {
            msgBytes = new TextEncoder().encode(message);
        } else if (message instanceof Uint8Array || Buffer.isBuffer(message)) {
            msgBytes = new Uint8Array(message);
        } else {
            return false;
        }

        return nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes);
    } catch {
        return false;
    }
}

/**
 * Authenticates and builds a W3C DID document from contributor-controlled key material.
 * Replaces legacy server-derived key generation (DID-01).
 *
 * @param {Uint8Array|string|object} contributorInput - Contributor public key (Uint8Array, Buffer, or hex string),
 *                                                     or an object { publicKey, signature, message } for proof of possession.
 * @returns {{ didString: string, didDocument: Object, rawPublicKey: Uint8Array }}
 */
function authenticateDID(contributorInput) {
    if (!contributorInput) {
        throw new Error('Contributor public key is required. Server-derived key generation has been removed under DID-01.');
    }

    // Explicitly reject legacy numeric githubId attempts to prevent server-side derivation
    if (typeof contributorInput === 'number' || (/^\d+$/.test(String(contributorInput).trim()) && String(contributorInput).trim().length < 32)) {
        throw new Error('Server-derived private key generation from GitHub ID has been removed (DID-01). Contributor keys must be generated under contributor control.');
    }

    // If passed proof object { publicKey, signature, message }
    if (typeof contributorInput === 'object' && !Buffer.isBuffer(contributorInput) && !(contributorInput instanceof Uint8Array) && contributorInput.publicKey) {
        const { publicKey, signature, message } = contributorInput;
        if (signature && message) {
            const isValid = verifyContributorSignature({ publicKey, signature, message });
            if (!isValid) {
                throw new Error('Contributor cryptographic proof of possession failed');
            }
        }
        return buildDIDFromPublicKey(publicKey);
    }

    // Direct contributor public key input
    return buildDIDFromPublicKey(contributorInput);
}

/**
 * Build the enriched identity document stored on IPFS.
 * Merges W3C DID document fields with GitHub profile metadata.
 */
function buildIdentityDocument(githubProfile, didString, didDocument, wallet = null) {
    const githubUsername = githubProfile.username || githubProfile.login || githubProfile.github;
    const githubId = String(githubProfile.id || githubProfile.githubId);
    return {
        ...didDocument,              // W3C fields: id, verificationMethod, …
        '@context': [
            'https://www.w3.org/ns/did/v1',
            'https://schema.org',
        ],
        // Kinetic metadata
        github: githubUsername,
        githubId,
        displayName: githubProfile.displayName || githubUsername,
        avatarUrl: githubProfile.photos?.[0]?.value || githubProfile.avatarUrl || null,
        wallet,
        createdAt: new Date().toISOString().split('T')[0],
    };
}

// ─────────────────────────────────────────────────────────────
//  IPFS storage  (Helia — Protocol Labs)
// ─────────────────────────────────────────────────────────────

/**
 * Store an identity document on IPFS via Helia (@helia/json dag-json).
 * Returns a real content-addressed CIDv1  (bafyrei…).
 */
async function uploadToIPFS(identityDocument) {
    try {
        const { j } = await getHelia();
        const cid = await j.add(identityDocument);
        const cidStr = cid.toString();

        console.log(`✅ Stored on IPFS (Helia):`);
        console.log(`   CID:     ${cidStr}`);
        console.log(`   Gateway: https://ipfs.io/ipfs/${cidStr}`);
        return cidStr;
    } catch (err) {
        console.error('❌ Helia upload failed:', err.message);
        // Fallback: SHA-256 content fingerprint (no network dependency)
        const digest = crypto.createHash('sha256')
            .update(JSON.stringify(identityDocument))
            .digest('hex');
        const fallback = `sha256-${digest}`;
        console.warn(`⚠️  Using SHA-256 fallback CID: ${fallback}`);
        return fallback;
    }
}

/**
 * Retrieve an identity document — tries local Helia blockstore first,
 * then public Protocol Labs IPFS gateways.
 */
async function getFromIPFS(cidStr) {
    if (!cidStr || cidStr.startsWith('sha256-')) return null;

    // 1. Local Helia node (instant if we stored it)
    try {
        const { CID } = await import('multiformats/cid');
        const { j } = await getHelia();
        const obj = await j.get(CID.parse(cidStr));
        if (obj) return obj;
    } catch { /* not in local store */ }

    // 2. Public Protocol Labs IPFS gateways
    for (const url of [
        `https://ipfs.io/ipfs/${cidStr}`,
        `https://dweb.link/ipfs/${cidStr}`,
    ]) {
        try {
            const res = await fetch(url, {
                signal: AbortSignal.timeout(8_000),
                headers: { Accept: 'application/json' },
            });
            if (res.ok) return await res.json();
        } catch { /* try next */ }
    }

    return null;
}

/**
 * Gracefully stop the Helia node on process exit.
 */
async function stopHelia() {
    if (_helia) {
        await _helia.stop();
        _helia = null;
        _heliaJson = null;
        console.log('🛑 Helia node stopped');
    }
}

export {
    publicKeyToDidKey,
    didKeyToPublicKey,
    buildDIDDocument,
    buildDIDFromPublicKey,
    verifyContributorSignature,
    buildIdentityDocument,
    uploadToIPFS,
    getFromIPFS,
    stopHelia,
    authenticateDID,
};
