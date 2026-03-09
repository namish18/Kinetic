/**
 * DID Service — Protocol Labs Stack (No Account / No API Key Required)
 *
 * DID generation:
 *   ├── key-did-provider-ed25519  (Ceramic / Protocol Labs)
 *   ├── key-did-resolver          (Ceramic / Protocol Labs)
 *   └── dids                      (Ceramic / Protocol Labs)
 *
 * IPFS storage:
 *   └── Helia  (Protocol Labs — official JS IPFS implementation)
 *       ├── @helia/json  — stores JSON objects, returns real IPFS CIDs
 *       ├── blockstore-fs — persists blocks to disk (./ipfs-store/blocks)
 *       └── datastore-fs  — persists datastore to disk (./ipfs-store/data)
 *
 * No Storacha account, no Pinata, no API keys of any kind.
 * Helia runs in-process, connects to the public IPFS network via libp2p/Bitswap,
 * and announces stored blocks so any IPFS gateway can retrieve them.
 */

import { DID } from 'dids';
import { Ed25519Provider } from 'key-did-provider-ed25519';
import KeyResolver from 'key-did-resolver';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHelia } from 'helia';
import { json as heliaJson } from '@helia/json';
import { FsBlockstore } from 'blockstore-fs';
import { FsDatastore } from 'datastore-fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────
//  Helia Node (lazy singleton)
// ─────────────────────────────────────────────────────────────

let _helia = null;
let _heliaJson = null;

/**
 * Returns (and lazily creates) the shared Helia node.
 *
 * Uses FsBlockstore + FsDatastore so all IPFS blocks are persisted to disk
 * at   <project-root>/ipfs-store/
 * Surviving server restarts means blocks stay available for the network.
 */
async function getHelia() {
    if (_helia) return { helia: _helia, j: _heliaJson };

    const storePath = path.join(__dirname, '..', 'ipfs-store');

    const blockstore = new FsBlockstore(path.join(storePath, 'blocks'));
    const datastore = new FsDatastore(path.join(storePath, 'data'));

    _helia = await createHelia({ blockstore, datastore });
    _heliaJson = heliaJson(_helia);

    console.log(`🌐 Helia IPFS node started (peer: ${_helia.libp2p.peerId.toString()})`);
    return { helia: _helia, j: _heliaJson };
}

// ─────────────────────────────────────────────────────────────
//  DID Generation  (Ceramic / Protocol Labs)
// ─────────────────────────────────────────────────────────────

/**
 * Derive a deterministic 32-byte Ed25519 seed for a given GitHub user.
 * HMAC-SHA256(githubId, DID_SEED_SECRET) → same DID on every server restart.
 *
 * ⚠️  Never change DID_SEED_SECRET after users have registered — it would
 *     give them a completely different did:key.
 */
function deriveSeed(githubId) {
    const secret = process.env.DID_SEED_SECRET || 'kinetic-did-seed-secret-changeme';
    const hash = crypto.createHmac('sha256', secret).update(String(githubId)).digest();
    return new Uint8Array(hash); // 32 bytes
}

/**
 * Generate and authenticate a real did:key from an Ed25519 keypair.
 * Resolves the full W3C DID document via key-did-resolver.
 *
 * @param {string|number} githubId
 * @returns {{ didString: string, didDocument: Object, did: DID }}
 */
async function authenticateDID(githubId) {
    const seed = deriveSeed(githubId);
    const provider = new Ed25519Provider(seed);
    const did = new DID({ provider, resolver: KeyResolver.getResolver() });

    await did.authenticate();

    // Resolve the full W3C DID document
    const resolution = await did.resolve(did.id);

    return {
        did,
        didString: did.id,
        didDocument: resolution.didDocument,
    };
}

/**
 * Compose the enriched identity document we store on IPFS.
 * Merges the W3C DID document with GitHub profile metadata.
 *
 * @param {Object}      githubProfile
 * @param {string}      didString
 * @param {Object}      didDocument   — from key-did-resolver
 * @param {string|null} wallet
 */
function buildIdentityDocument(githubProfile, didString, didDocument, wallet = null) {
    const githubUsername = githubProfile.username || githubProfile.login;
    return {
        '@context': [
            'https://www.w3.org/ns/did/v1',
            'https://schema.org',
        ],
        // W3C DID document fields (id, verificationMethod, authentication…)
        ...didDocument,
        // Kinetic-specific metadata
        github: githubUsername,
        githubId: String(githubProfile.id),
        displayName: githubProfile.displayName || githubUsername,
        avatarUrl: githubProfile.photos?.[0]?.value || null,
        wallet,
        createdAt: new Date().toISOString().split('T')[0],
    };
}

// ─────────────────────────────────────────────────────────────
//  IPFS Storage  (Helia — Protocol Labs)
// ─────────────────────────────────────────────────────────────

/**
 * Store an identity document on IPFS using Helia (@helia/json).
 *
 * Helia's dag-json codec produces a CIDv1 (bafyrei…) — the same kind of
 * content-addressed CID that any IPFS gateway or peer can retrieve.
 *
 * @param  {Object} identityDocument
 * @returns {Promise<string>} CID string (e.g. "bafyreidxyz…")
 */
async function uploadToIPFS(identityDocument) {
    try {
        const { j } = await getHelia();

        // j.add() hashes the JSON with dag-json, stores the block locally,
        // and announces it to connected IPFS peers via Bitswap.
        const cid = await j.add(identityDocument);
        const cidStr = cid.toString();

        console.log(`✅ Identity document stored on IPFS via Helia`);
        console.log(`   CID: ${cidStr}`);
        console.log(`   🌐 Gateway: https://ipfs.io/ipfs/${cidStr}`);
        console.log(`   🌐 Gateway: https://dweb.link/ipfs/${cidStr}`);

        return cidStr;
    } catch (err) {
        console.error('❌ Helia IPFS storage failed:', err.message);
        // Fallback: deterministic SHA-256 fingerprint (no network dependency)
        const digest = crypto
            .createHash('sha256')
            .update(JSON.stringify(identityDocument))
            .digest('hex');
        const fallback = `sha256-${digest}`;
        console.warn(`⚠️  Using local SHA-256 CID fallback: ${fallback}`);
        return fallback;
    }
}

/**
 * Retrieve an identity document from the local Helia blockstore first,
 * then fall back to public IPFS gateways (ipfs.io, dweb.link — Protocol Labs).
 *
 * @param  {string} cidStr
 * @returns {Promise<Object|null>}
 */
async function getFromIPFS(cidStr) {
    if (!cidStr || cidStr.startsWith('sha256-')) return null;

    // 1. Try local Helia node first (instant if we stored it)
    try {
        const { j } = await getHelia();
        const { CID } = await import('multiformats/cid');
        const cid = CID.parse(cidStr);
        const obj = await j.get(cid);
        if (obj) {
            console.log(`📦 Retrieved from local Helia node: ${cidStr}`);
            return obj;
        }
    } catch {
        // block not in local store — try gateways
    }

    // 2. Fall back to public Protocol Labs IPFS gateways
    const gateways = [
        `https://ipfs.io/ipfs/${cidStr}`,
        `https://dweb.link/ipfs/${cidStr}`,
        `https://cloudflare-ipfs.com/ipfs/${cidStr}`,
    ];

    for (const url of gateways) {
        try {
            const res = await fetch(url, {
                signal: AbortSignal.timeout(8_000),
                headers: { Accept: 'application/json' },
            });
            if (res.ok) {
                console.log(`📦 Retrieved from IPFS gateway: ${url}`);
                return await res.json();
            }
        } catch {
            // try next gateway
        }
    }

    console.warn(`⚠️  Could not retrieve ${cidStr} from Helia or any gateway`);
    return null;
}

/**
 * Gracefully stop the Helia node (call on process exit).
 */
async function stopHelia() {
    if (_helia) {
        await _helia.stop();
        _helia = null;
        _heliaJson = null;
        console.log('🛑 Helia IPFS node stopped');
    }
}

export {
    authenticateDID,
    buildIdentityDocument,
    uploadToIPFS,
    getFromIPFS,
    stopHelia,
};
