/**
 * DID Service — Protocol Labs Stack
 *
 * DID generation  (did:key — W3C / DIF standard):
 *   ├── tweetnacl              Ed25519 keypair from deterministic seed
 *   └── multiformats/bases     base58btc multibase encoding (same as Ceramic)
 *
 * IPFS storage (Protocol Labs):
 *   ├── helia                  in-process IPFS node — no account needed
 *   ├── @helia/json            dag-json codec → real content-addressed CIDs
 *   ├── blockstore-fs          persistent on-disk block storage
 *   └── datastore-fs           persistent on-disk datastore
 *
 * Zero API keys. Zero accounts. Generates the exact same did:key format
 * as key-did-provider-ed25519 would produce.
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
//  DID key generation  (did:key Ed25519)
// ─────────────────────────────────────────────────────────────

/**
 * Deterministically derive a 32-byte Ed25519 seed from a GitHub user ID.
 * HMAC-SHA256(githubId,  DID_SEED_SECRET)  →  same DID across restarts.
 *
 * ⚠️  Never change DID_SEED_SECRET after users have been created — their
 *     DIDs will change and old references will break.
 */
function deriveSeed(githubId) {
    const secret = process.env.DID_SEED_SECRET || 'kinetic-did-seed-secret-changeme';
    return new Uint8Array(
        crypto.createHmac('sha256', secret).update(String(githubId)).digest()
    );
}

/**
 * Build a did:key string from an Ed25519 public key.
 *
 * Format (per did:key spec):
 *   did:key:z  <base58btc( 0xed 0x01 || publicKey )>
 *              └─ multicodec varint for ed25519-pub ─┘
 *
 * This is identical to what key-did-provider-ed25519 produces internally.
 */
function publicKeyToDidKey(publicKey) {
    // Multicodec prefix for ed25519-pub: 0xed 0x01  (varint encoding)
    const multicodecPrefixed = new Uint8Array([0xed, 0x01, ...publicKey]);
    const encoded = base58btc.encode(multicodecPrefixed); // starts with 'z'
    return `did:key:${encoded}`;
}

/**
 * Build the W3C DID document for an Ed25519 did:key.
 * Structure mirrors what key-did-resolver returns.
 */
function buildDIDDocument(did, publicKey) {
    const vmId = `${did}#${did.substring('did:key:'.length)}`;
    return {
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: did,
        verificationMethod: [
            {
                id: vmId,
                type: 'Ed25519VerificationKey2018',
                controller: did,
                publicKeyBase58: base58btc.encode(publicKey).slice(1), // strip 'z' prefix
            },
        ],
        authentication: [vmId],
        assertionMethod: [vmId],
        capabilityDelegation: [vmId],
        capabilityInvocation: [vmId],
    };
}

/**
 * Generate a cryptographic did:key for a GitHub user.
 *
 * @param {string|number} githubId
 * @returns {{ didString: string, didDocument: Object }}
 */
function authenticateDID(githubId) {
    const seed = deriveSeed(githubId);
    const keyPair = nacl.sign.keyPair.fromSeed(seed);  // sync, deterministic
    const didString = publicKeyToDidKey(keyPair.publicKey);
    const didDocument = buildDIDDocument(didString, keyPair.publicKey);
    return { didString, didDocument };
}

/**
 * Build the enriched identity document stored on IPFS.
 * Merges W3C DID document fields with GitHub profile metadata.
 */
function buildIdentityDocument(githubProfile, didString, didDocument, wallet = null) {
    const githubUsername = githubProfile.username || githubProfile.login;
    return {
        ...didDocument,              // W3C fields: id, verificationMethod, …
        '@context': [
            'https://www.w3.org/ns/did/v1',
            'https://schema.org',
        ],
        // Kinetic metadata
        github: githubUsername,
        githubId: String(githubProfile.id),
        displayName: githubProfile.displayName || githubUsername,
        avatarUrl: githubProfile.photos?.[0]?.value || null,
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
    authenticateDID,
    buildIdentityDocument,
    uploadToIPFS,
    getFromIPFS,
    stopHelia,
};
