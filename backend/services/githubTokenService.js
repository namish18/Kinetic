import {
    createCipheriv,
    createDecipheriv,
    createHash,
    randomBytes,
} from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";

function deriveKey(secret = process.env.GITHUB_TOKEN_ENCRYPTION_KEY) {
    if (typeof secret !== "string" || secret.trim().length < 32) {
        throw new Error("GITHUB_TOKEN_ENCRYPTION_KEY must be configured with at least 32 characters");
    }
    return createHash("sha256").update(secret, "utf8").digest();
}

/**
 * Encrypt a GitHub OAuth access token before it is persisted in MongoDB.
 * The random IV and authentication tag are stored with a versioned payload.
 */
export function encryptGitHubToken(token, secret) {
    if (typeof token !== "string" || token.length === 0) {
        throw new TypeError("A non-empty GitHub access token is required");
    }

    const key = deriveKey(secret);
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([
        cipher.update(token, "utf8"),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [
        VERSION,
        iv.toString("hex"),
        tag.toString("hex"),
        ciphertext.toString("hex"),
    ].join(".");
}

/**
 * Decrypt a previously encrypted GitHub OAuth access token.
 */
export function decryptGitHubToken(payload, secret) {
    if (typeof payload !== "string" || payload.length === 0) {
        throw new TypeError("An encrypted GitHub access token is required");
    }

    const [version, ivHex, tagHex, ciphertextHex, extra] = payload.split(".");
    if (version !== VERSION || !ivHex || !tagHex || !ciphertextHex || extra !== undefined) {
        throw new Error("Stored GitHub access token has an unsupported or invalid format");
    }

    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
        throw new Error("Stored GitHub access token is malformed");
    }

    const decipher = createDecipheriv(ALGORITHM, deriveKey(secret), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
    ]).toString("utf8");
}
