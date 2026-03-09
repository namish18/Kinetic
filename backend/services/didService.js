/**
 * DID Service — Protocol Labs Stack
 *
 * Uses:
 *  - key-did-provider-ed25519 (Ceramic/Protocol Labs) for cryptographically
 *    secure did:key generation using Ed25519 keypairs
 *  - key-did-resolver (Ceramic/Protocol Labs) for W3C DID document resolution
 *  - dids package (Ceramic) for the DID interface / authentication
 *  - @web3-storage/w3up-client (Protocol Labs / Storacha) for IPFS storage
 *    using UCAN-based authorization — no Pinata, no third-party services
 *
 * DID format produced: did:key:z6Mk...  (Ed25519 multibase)
 * Storage: IPFS via web3.storage (Storacha) — content-addressed, Filecoin-backed
 */

import { DID } from 'dids';
import { Ed25519Provider } from 'key-did-provider-ed25519';
import KeyResolver from 'key-did-resolver';
import * as crypto from 'node:crypto';
import * as w3up from '@web3-storage/w3up-client';
import * as Signer from '@ucanto/principal/ed25519';
import { StoreMemory } from '@web3-storage/access/stores/store-memory';

// ============================================================
//  DID GENERATION  (Ceramic / Protocol Labs libraries)
// ============================================================

/**
 * Generate a cryptographically secure 32-byte seed for the Ed25519 keypair.
 * We derive the seed deterministically from the (githubId + a server secret)
 * so the same GitHub user always gets the same DID across server restarts.
 *
 * @param {string} githubId — GitHub numeric user ID
 * @returns {Uint8Array} 32-byte seed
 */
function deriveSeed(githubId) {
    const secret = process.env.DID_SEED_SECRET || 'kinetic-did-seed-secret-changeme';
    const hash = crypto.createHmac('sha256', secret).update(String(githubId)).digest();
    return new Uint8Array(hash); // 32 bytes
}

/**
 * Authenticate a DID using the Ed25519Provider and key-did-resolver.
 * Returns the fully resolved did:key string and the resolved DID document.
 *
 * @param {string} githubId
 * @returns {{ did: DID, didString: string, didDocument: Object }}
 */
async function authenticateDID(githubId) {
    const seed = deriveSeed(githubId);
    const provider = new Ed25519Provider(seed);

    const did = new DID({
        provider,
        resolver: KeyResolver.getResolver(),
    });

    await did.authenticate();

    // Resolve the full W3C DID document
    const resolution = await did.resolve(did.id);
    const didDocument = resolution.didDocument;

    return { did, didString: did.id, didDocument };
}

/**
 * Build the enriched identity document we store on IPFS.
 * This wraps the W3C DID document with GitHub profile metadata.
 *
 * @param {Object} githubProfile - GitHub OAuth profile (passport-github2 format)
 * @param {string} didString     - e.g. "did:key:z6Mk..."
 * @param {Object} didDocument   - W3C DID document from key-did-resolver
 * @param {string|null} wallet   - optional Flow wallet address
 * @returns {Object}
 */
function buildIdentityDocument(githubProfile, didString, didDocument, wallet = null) {
    const githubUsername = githubProfile.username || githubProfile.login;

    return {
        '@context': [
            'https://www.w3.org/ns/did/v1',
            'https://schema.org',
        ],
        // W3C DID document (resolved from did:key)
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

// ============================================================
//  IPFS STORAGE  (Protocol Labs / Storacha — w3up-client)
// ============================================================

/**
 * Initialise the w3up-client using a server-side agent whose private key
 * is stored in the environment variable W3UP_PRINCIPAL_KEY.
 *
 * If the env var is missing we fall back to a fresh in-memory agent each
 * startup — useful for local dev, but the agent won't have any delegations.
 *
 * @returns {import('@web3-storage/w3up-client').Client}
 */
async function getW3upClient() {
    const principalKey = process.env.W3UP_PRINCIPAL_KEY;
    const spaceDID = process.env.W3UP_SPACE_DID;

    let client;

    if (principalKey) {
        // Production: use a server-side Ed25519 signer persisted in env var
        const principal = Signer.parse(principalKey);
        client = await w3up.create({
            principal,
            store: new StoreMemory(),
        });
    } else {
        // Dev: ephemeral agent (no uploads will succeed without a registered space)
        client = await w3up.create({ store: new StoreMemory() });
        console.warn('⚠️  W3UP_PRINCIPAL_KEY not set — w3up uploads will fail');
    }

    // Set the current space if configured
    if (spaceDID) {
        try {
            await client.setCurrentSpace(spaceDID);
        } catch (e) {
            console.warn(`⚠️  Could not set space ${spaceDID}: ${e.message}`);
        }
    }

    return client;
}

/**
 * Upload an identity document as JSON to IPFS via Storacha (Protocol Labs).
 * Returns the root CID of the uploaded file.
 *
 * @param {Object} identityDocument
 * @returns {Promise<string>} IPFS CID string
 */
async function uploadToIPFS(identityDocument) {
    const json = JSON.stringify(identityDocument, null, 2);

    // Skip real upload in development if not configured
    if (!process.env.W3UP_PRINCIPAL_KEY || !process.env.W3UP_SPACE_DID) {
        console.warn('⚠️  W3UP_PRINCIPAL_KEY / W3UP_SPACE_DID not set — computing content CID locally (no upload)');
        return computeLocalCID(json);
    }

    try {
        const client = await getW3upClient();

        // Upload the JSON blob as a single file
        const blob = new Blob([json], { type: 'application/json' });
        const file = new File([blob], `${identityDocument.id || 'did'}.json`, {
            type: 'application/json',
        });

        const cid = await client.uploadFile(file);
        const cidString = cid.toString();

        console.log(`✅ Identity document uploaded to IPFS (Storacha): ${cidString}`);
        console.log(`   🌐 Gateway URL: https://w3s.link/ipfs/${cidString}`);

        return cidString;
    } catch (error) {
        console.error('❌ Storacha upload failed:', error.message);
        // Return a deterministic local CID so the system stays functional
        return computeLocalCID(json);
    }
}

/**
 * Retrieve an identity document from IPFS using the public w3s.link gateway
 * (operated by Protocol Labs / Storacha).
 *
 * @param {string} cid
 * @returns {Promise<Object|null>}
 */
async function getFromIPFS(cid) {
    // Dual gateway: prefer w3s.link (Storacha), fallback to dweb.link (Protocol Labs)
    const gateways = [
        `https://w3s.link/ipfs/${cid}`,
        `https://dweb.link/ipfs/${cid}`,
        `https://ipfs.io/ipfs/${cid}`,
    ];

    for (const url of gateways) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (res.ok) return await res.json();
        } catch {
            // try next gateway
        }
    }

    console.warn(`⚠️  Could not retrieve ${cid} from any IPFS gateway`);
    return null;
}

/**
 * Compute a content-based SHA-256 hex digest when real IPFS upload isn't
 * available. Prefixed with "sha256-" to make it clear it's not a real CID.
 *
 * @param {string} json
 * @returns {string}
 */
function computeLocalCID(json) {
    const digest = crypto.createHash('sha256').update(json).digest('hex');
    return `sha256-${digest}`;
}

export {
    authenticateDID,
    buildIdentityDocument,
    uploadToIPFS,
    getFromIPFS,
};
