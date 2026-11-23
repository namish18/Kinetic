/**
 * Startup configuration rules (SEC-05).
 *
 * validateEnv() only looks at the object it is given. It does not read files,
 * print anything or exit, so every rule can be unit tested. config/loadEnv.js
 * applies the result when the server starts.
 *
 * A reason describes the rule that failed and must never include the value:
 * the values checked here are secrets and credential-bearing connection strings.
 */

// RFC 7518 section 3.2: an HMAC key must be at least as long as the hash output (256 bits for HS256).
const MIN_SECRET_BYTES = 32;

// Random hex uses nearly all 16 digits, so this only rejects values such as "aaaa...".
const MIN_DISTINCT_CHARACTERS = 8;

// Matches anywhere in the value, so variations of documented or old default values are caught too.
const PLACEHOLDER_PATTERN = /change.?me|replace.?me|placeholder|example|^your|<[^>]*>|dev.?session.?secret|did.?seed.?secret/i;
const COMMON_WORDS = new Set(['secret', 'password', 'test', 'dev', 'default', 'dummy', 'none', 'null', 'undefined']);

const isPlaceholder = (value) => PLACEHOLDER_PATTERN.test(value) || COMMON_WORDS.has(value.toLowerCase());

/** Secrets the operator generates. All of them are HMAC keys that can be attacked offline. */
function generatedSecret(value) {
    if (isPlaceholder(value)) return 'is a placeholder or a known default, not a real secret';
    if (Buffer.byteLength(value, 'utf8') < MIN_SECRET_BYTES) return `must be at least ${MIN_SECRET_BYTES} bytes long`;
    if (new Set(value).size < MIN_DISTINCT_CHARACTERS) return 'is too repetitive to be a random secret';
    return null;
}

/** Credentials GitHub issues, so their length and format are GitHub's to decide. */
function issuedCredential(value) {
    if (isPlaceholder(value)) return 'is a placeholder, not a real credential';
    if (/\s/.test(value)) return 'must not contain whitespace';
    return null;
}

function mongodbUri(value) {
    if (/<[^>]+>/.test(value)) return 'still contains a <placeholder>';
    if (!/^mongodb(\+srv)?:\/\/[^\s/]/.test(value)) return 'must be a mongodb:// or mongodb+srv:// connection string';
    return null;
}

function httpUrl(value) {
    try {
        const { protocol } = new URL(value);
        if (protocol === 'http:' || protocol === 'https:') return null;
    } catch {
        // Fall through: URL parse errors can echo their input, so they are never reported.
    }
    return 'must be an absolute http:// or https:// URL';
}

function port(value) {
    const isValid = /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 65535;
    return isValid ? null : 'must be a whole number from 1 to 65535';
}

function flowAddress(value) {
    return /^0x[0-9a-fA-F]{16}$/.test(value) ? null : 'must be 0x followed by 16 hexadecimal characters';
}

function flowPrivateKey(value) {
    return /^(0x)?[0-9a-fA-F]{64}$/.test(value) ? null : 'must be 64 hexadecimal characters';
}

const RULES = {
    MONGODB_URI: { required: true, check: mongodbUri },
    GITHUB_CLIENT_ID: { required: true, check: issuedCredential },
    GITHUB_CLIENT_SECRET: { required: true, check: issuedCredential },
    SESSION_SECRET: { required: true, check: generatedSecret },
    JWT_SECRET: { required: true, check: generatedSecret },
    DID_SEED_SECRET: { required: true, check: generatedSecret },
    GITHUB_WEBHOOK_SECRET: { required: true, check: generatedSecret },
    GITHUB_PAT: { check: issuedCredential },
    GITHUB_CALLBACK_URL: { check: httpUrl },
    FRONTEND_URL: { check: httpUrl },
    PORT: { check: port },
    FLOW_ADDRESS: { check: flowAddress },
    FLOW_CONTRACT_ADDRESS: { check: flowAddress },
    FLOW_PRIVATE_KEY: { check: flowPrivateKey },
};

function checkValue(value, { required, check }) {
    if (value === undefined || value === '') return required ? 'is required but not set' : null;
    if (value !== value.trim()) return 'must not be blank or have spaces around it';
    return check(value);
}

/** Each key protects something different, so one leaked key must not unlock the others. */
function findReusedSecrets(env) {
    const firstUse = new Map();
    const errors = [];
    for (const [name, rule] of Object.entries(RULES)) {
        const value = env[name];
        if (rule.check !== generatedSecret || checkValue(value, rule)) continue; // Already reported by its own rule.
        if (firstUse.has(value)) errors.push({ name, reason: `must be different from ${firstUse.get(value)}` });
        else firstUse.set(value, name);
    }
    return errors;
}

/**
 * @param {Record<string, string|undefined>} env
 * @returns {{ errors: { name: string, reason: string }[], warnings: string[] }}
 */
export function validateEnv(env) {
    const errors = [];
    for (const [name, rule] of Object.entries(RULES)) {
        const reason = checkValue(env[name], rule);
        if (reason) errors.push({ name, reason });
    }
    errors.push(...findReusedSecrets(env));

    // flowService can read payouts with an address alone, but a key or contract is useless without one.
    if (!env.FLOW_ADDRESS && (env.FLOW_PRIVATE_KEY || env.FLOW_CONTRACT_ADDRESS)) {
        errors.push({ name: 'FLOW_ADDRESS', reason: 'is required when FLOW_PRIVATE_KEY or FLOW_CONTRACT_ADDRESS is set' });
    }

    const warnings = [];
    if (!env.FLOW_PRIVATE_KEY) warnings.push('FLOW_PRIVATE_KEY is not set, so on-chain payout transactions will fail until it is configured.');
    if (!env.GITHUB_PAT) warnings.push('GITHUB_PAT is not set, so Proof-of-Build cannot be verified and new contributions will not be scored.');

    return { errors, warnings };
}

export function formatConfigErrors(errors) {
    return [
        'Server configuration is invalid, so the server will not start.',
        '',
        ...errors.map(({ name, reason }) => `  - ${name} ${reason}`),
        '',
        'Set these in the environment or in backend/.env (see backend/.env.example).',
        'Generate each secret separately with:',
        `  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    ].join('\n');
}
