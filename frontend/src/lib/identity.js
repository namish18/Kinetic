/**
 * Kinetic Contributor-Controlled Identity Client Library (DID-01)
 *
 * Provides client-side Ed25519 key generation, private key retention,
 * detached signature creation for proof of possession, and API registration.
 *
 * Contributor private keys are NEVER transmitted to or controlled by the server.
 */

import nacl from 'tweetnacl';

const STORAGE_KEY_PREFIX = 'kinetic_contributor_key_';

/**
 * Converts a Uint8Array to a lowercase hex string.
 *
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function toHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Converts a hex string to a Uint8Array.
 *
 * @param {string} hex
 * @returns {Uint8Array}
 */
export function fromHex(hex) {
  const cleanHex = hex.replace(/^0x/, '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Generates an Ed25519 keypair on the contributor's client machine.
 *
 * @returns {{ publicKey: Uint8Array, secretKey: Uint8Array, publicKeyHex: string, secretKeyHex: string }}
 */
export function generateContributorKeyPair() {
  const keyPair = nacl.sign.keyPair();
  return {
    publicKey: keyPair.publicKey,
    secretKey: keyPair.secretKey,
    publicKeyHex: toHex(keyPair.publicKey),
    secretKeyHex: toHex(keyPair.secretKey),
  };
}

/**
 * Stores the contributor's private key locally in browser storage.
 *
 * @param {string} usernameOrId - Contributor identifier (e.g. GitHub username or ID)
 * @param {string|Uint8Array} secretKey - The private key
 */
export function storeContributorPrivateKey(usernameOrId, secretKey) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const hex = typeof secretKey === 'string' ? secretKey : toHex(secretKey);
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${usernameOrId}`, hex);
}

/**
 * Retrieves the contributor's stored private key from browser storage.
 *
 * @param {string} usernameOrId
 * @returns {Uint8Array|null}
 */
export function getStoredContributorPrivateKey(usernameOrId) {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const hex = localStorage.getItem(`${STORAGE_KEY_PREFIX}${usernameOrId}`);
  if (!hex) return null;
  try {
    return fromHex(hex);
  } catch {
    return null;
  }
}

/**
 * Signs an authentication challenge message using the contributor's private key.
 *
 * @param {string} message - Challenge string
 * @param {Uint8Array|string} secretKey - 64-byte Ed25519 secret key
 * @returns {string} 128-char hex-encoded detached signature
 */
export function signChallenge(message, secretKey) {
  const secretKeyBytes = typeof secretKey === 'string' ? fromHex(secretKey) : secretKey;
  const messageBytes = new TextEncoder().encode(message);
  const signature = nacl.sign.detached(messageBytes, secretKeyBytes);
  return toHex(signature);
}

/**
 * Creates and registers a contributor-controlled identity with the Kinetic backend.
 *
 * 1. Checks for an existing local private key or generates a new keypair.
 * 2. Saves the private key locally under contributor control.
 * 3. Creates a cryptographic proof of possession (detached signature).
 * 4. Submits only the public key, signature, and challenge to POST /api/auth/register-did.
 *
 * @param {string} token - JWT bearer token
 * @param {string} username - Contributor GitHub username
 * @param {string} [apiUrl=''] - Backend API base URL
 * @returns {Promise<object>} API response including the registered did:key
 */
export async function initializeAndRegisterIdentity(token, username, apiUrl = '') {
  let secretKey = getStoredContributorPrivateKey(username);
  let publicKey;

  if (secretKey) {
    const keyPair = nacl.sign.keyPair.fromSecretKey(secretKey);
    publicKey = keyPair.publicKey;
  } else {
    const keyPair = generateContributorKeyPair();
    secretKey = keyPair.secretKey;
    publicKey = keyPair.publicKey;
    storeContributorPrivateKey(username, secretKey);
  }

  const publicKeyHex = toHex(publicKey);
  const challenge = `Kinetic DID Registration for @${username} at ${new Date().toISOString()}`;
  const signatureHex = signChallenge(challenge, secretKey);

  const response = await fetch(`${apiUrl}/api/auth/register-did`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      publicKey: publicKeyHex,
      signature: signatureHex,
      message: challenge,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to register contributor identity');
  }

  return data;
}

/**
 * Exports the contributor's identity key as a downloadable JSON backup file.
 *
 * @param {string} username
 */
export function exportContributorKeyBackup(username) {
  const secretKey = getStoredContributorPrivateKey(username);
  if (!secretKey) throw new Error('No private key found in storage');

  const keyPair = nacl.sign.keyPair.fromSecretKey(secretKey);
  const backup = {
    kineticVersion: 'DID-01',
    contributor: username,
    publicKey: toHex(keyPair.publicKey),
    secretKey: toHex(secretKey),
    exportedAt: new Date().toISOString(),
    warning: 'Keep this private key secret. Do not share your private key with anyone.',
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kinetic-identity-${username}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Encodes a byte array to base58btc string with multibase 'z' prefix.
 *
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function base58btcEncode(bytes) {
  const digits = [0];
  for (let i = 0; i < bytes.length; i++) {
    for (let j = 0; j < digits.length; j++) digits[j] <<= 8;
    digits[0] += bytes[i];
    let carry = 0;
    for (let j = 0; j < digits.length; ++j) {
      digits[j] += carry;
      carry = (digits[j] / 58) | 0;
      digits[j] %= 58;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) digits.push(0);
  return 'z' + digits.reverse().map((d) => BASE58_ALPHABET[d]).join('');
}

/**
 * Builds did:key from Ed25519 public key in the browser.
 *
 * @param {Uint8Array} publicKey
 * @returns {string} did:key:z...
 */
export function publicKeyToDidKey(publicKey) {
  const multicodecPrefixed = new Uint8Array([0xed, 0x01, ...publicKey]);
  return `did:key:${base58btcEncode(multicodecPrefixed)}`;
}

/**
 * Gets or initializes contributor-controlled identity key on the client.
 *
 * @param {string} [username='contributor']
 * @returns {{ did: string, publicKeyHex: string, hasLocalKey: boolean }}
 */
export function getOrCreateContributorIdentity(username = 'contributor') {
  let secretKey = getStoredContributorPrivateKey(username);
  let keyPair;
  if (secretKey) {
    keyPair = nacl.sign.keyPair.fromSecretKey(secretKey);
  } else {
    keyPair = nacl.sign.keyPair();
    storeContributorPrivateKey(username, keyPair.secretKey);
  }
  const didString = publicKeyToDidKey(keyPair.publicKey);
  return {
    did: didString,
    publicKeyHex: toHex(keyPair.publicKey),
    hasLocalKey: true,
  };
}

