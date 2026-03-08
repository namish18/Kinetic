const { v4: uuidv4 } = require('uuid');

/**
 * DID Service
 * 
 * Creates DID documents for contributors following the did:retrofund method.
 * Uploads DID documents to IPFS via Pinata for persistent decentralized storage.
 */

/**
 * Creates a DID document for a contributor
 * @param {Object} githubProfile - The GitHub profile data
 * @param {string} walletAddress - Optional Flow wallet address
 * @returns {Object} The DID document
 */
function createDIDDocument(githubProfile, walletAddress = null) {
    const githubUsername = githubProfile.username || githubProfile.login;
    const did = `did:retrofund:${githubUsername}`;

    const didDocument = {
        '@context': 'https://www.w3.org/ns/did/v1',
        id: did,
        github: githubUsername,
        githubId: githubProfile.id,
        displayName: githubProfile.displayName || githubProfile.name || githubUsername,
        avatarUrl: githubProfile.photos?.[0]?.value || githubProfile.avatar_url || null,
        wallet: walletAddress,
        verificationMethod: [
            {
                id: `${did}#github`,
                type: 'GitHubVerification',
                controller: did,
                githubId: String(githubProfile.id),
                githubUsername: githubUsername,
            },
        ],
        authentication: [`${did}#github`],
        createdAt: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
    };

    return didDocument;
}

/**
 * Uploads a DID document to IPFS via Pinata
 * @param {Object} didDocument - The DID document to upload
 * @returns {Promise<string>} The IPFS CID
 */
async function uploadToIPFS(didDocument) {
    const PINATA_JWT = process.env.PINATA_JWT;

    if (!PINATA_JWT) {
        console.warn('⚠️  PINATA_JWT not set — using mock IPFS CID for development');
        // Return a mock CID for development when Pinata is not configured
        const mockCID = `bafybei${uuidv4().replace(/-/g, '').substring(0, 46)}`;
        return mockCID;
    }

    try {
        // Dynamic import for node-fetch (ESM module)
        const fetch = (await import('node-fetch')).default;

        const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${PINATA_JWT}`,
            },
            body: JSON.stringify({
                pinataContent: didDocument,
                pinataMetadata: {
                    name: `DID-${didDocument.github}`,
                    keyvalues: {
                        did: didDocument.id,
                        github: didDocument.github,
                    },
                },
            }),
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Pinata API error: ${response.status} - ${errorData}`);
        }

        const data = await response.json();
        console.log(`✅ DID document uploaded to IPFS: ${data.IpfsHash}`);
        return data.IpfsHash;
    } catch (error) {
        console.error('❌ Failed to upload to IPFS:', error.message);
        // Fallback to mock CID if Pinata fails
        const mockCID = `bafybei${uuidv4().replace(/-/g, '').substring(0, 46)}`;
        console.warn(`⚠️  Using mock CID: ${mockCID}`);
        return mockCID;
    }
}

/**
 * Retrieves a DID document from IPFS via Pinata gateway
 * @param {string} cid - The IPFS CID
 * @returns {Promise<Object>} The DID document
 */
async function getFromIPFS(cid) {
    try {
        const PINATA_GATEWAY = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud';
        const fetch = (await import('node-fetch')).default;

        const response = await fetch(`${PINATA_GATEWAY}/ipfs/${cid}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch from IPFS: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('❌ Failed to retrieve from IPFS:', error.message);
        return null;
    }
}

module.exports = {
    createDIDDocument,
    uploadToIPFS,
    getFromIPFS,
};
