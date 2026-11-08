/**
 * Privacy and data minimization for public IPFS evidence packages.
 *
 * Evidence packages are published to IPFS, so anything in them is public and
 * permanent. Two layers protect them:
 *   1. Field sanitizers: every published value is validated or rebuilt from
 *      safe parts, never copied through as free text.
 *   2. A final check that scans the finished package for emails, tokens and
 *      credentials, and refuses to publish if it finds any.
 *
 * Findings only ever name the kind of data and where it was found, never the
 * value, so a secret cannot end up in a log line or an error message.
 */

export class EvidencePrivacyError extends Error {
    constructor(findings) {
        super(`Evidence package blocked by privacy check: ${findings.map(f => `${f.type} at ${f.path}`).join(', ')}`);
        this.name = 'EvidencePrivacyError';
        this.findings = findings;
    }
}

const VALUE_PATTERNS = [
    { type: 'email address', regex: /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/i },
    { type: 'GitHub token', regex: /\bgh[pousr]_[A-Za-z0-9]{20,}/ },
    { type: 'GitHub token', regex: /\bgithub_pat_[A-Za-z0-9_]{20,}/ },
    { type: 'JSON web token', regex: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/ },
    { type: 'bearer credential', regex: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/i },
    { type: 'AWS access key', regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
    { type: 'Slack token', regex: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
    { type: 'API secret key', regex: /\bsk-[A-Za-z0-9_-]{20,}/ },
    { type: 'private key', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
    { type: 'credentials in URL', regex: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i }
];

const SENSITIVE_KEY = /(token|secret|password|passwd|e-?mail|authorization|cookie|private[-_ ]?key|api[-_ ]?key|credential)/i;

/**
 * Scans any value (object, array, string) for sensitive data.
 * Returns [{ type, path }]. Never returns the matched value.
 */
export function findSensitiveData(value, path = '$') {
    const findings = [];
    if (typeof value === 'string') {
        for (const { type, regex } of VALUE_PATTERNS) {
            if (regex.test(value)) findings.push({ type, path });
        }
    } else if (Array.isArray(value)) {
        value.forEach((item, i) => findings.push(...findSensitiveData(item, `${path}[${i}]`)));
    } else if (value && typeof value === 'object') {
        for (const [key, item] of Object.entries(value)) {
            const childPath = `${path}.${key.length > 40 ? 'long-key' : key}`;
            if (SENSITIVE_KEY.test(key)) findings.push({ type: 'sensitive field name', path: childPath });
            findings.push(...findSensitiveData(key, `${childPath} (key)`).map(f => ({ ...f, path: childPath })));
            findings.push(...findSensitiveData(item, childPath));
        }
    }
    return findings;
}

/** Throws EvidencePrivacyError if the package contains anything sensitive. */
export function assertPublicSafe(evidencePackage) {
    const findings = findSensitiveData(evidencePackage);
    if (findings.length > 0) throw new EvidencePrivacyError(findings);
    return evidencePackage;
}

const GITHUB_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})(?:\[bot\])?$/;
const REPOSITORY = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const COMMIT_SHA = /^[0-9a-f]{6,64}$/i;
const ALGORITHM_VERSION = /^[A-Za-z0-9._+-]{1,64}$/;

const RUN_STATUSES = new Set(['queued', 'in_progress', 'completed', 'waiting', 'requested', 'pending']);
const RUN_CONCLUSIONS = new Set(['success', 'failure', 'neutral', 'cancelled', 'skipped', 'timed_out', 'action_required', 'stale', 'startup_failure']);

// Only these weight names are ever published
export const WEIGHT_KEYS = ['impact', 'complexity', 'quality', 'review', 'priority'];

/** A public GitHub login, or null. */
export function cleanLogin(value) {
    return typeof value === 'string' && GITHUB_LOGIN.test(value) ? value : null;
}

/** An owner/name repository, or null. */
export function cleanRepository(value) {
    return typeof value === 'string' && REPOSITORY.test(value) ? value : null;
}

/** A positive integer PR number, or null. */
export function cleanPrNumber(value) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * The PR URL is rebuilt from the repository and number instead of being
 * copied, so credentials, query strings or other hosts can never be carried in.
 */
export function buildPullUrl(repository, prNumber) {
    return `https://github.com/${repository}/pull/${prNumber}`;
}

/** A hex commit SHA, or null. */
export function cleanCommitSha(value) {
    return typeof value === 'string' && COMMIT_SHA.test(value) ? value : null;
}

/** An ISO timestamp, or null. */
export function cleanTimestamp(value) {
    if (value === undefined || value === null) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Free text (check run name, algorithm name): control characters removed,
 * length capped, and replaced with "[redacted]" if it looks sensitive.
 */
export function cleanText(value, maxLength = 100) {
    if (typeof value !== 'string') return null;
    const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
    if (!text) return null;
    return findSensitiveData(text).length > 0 ? '[redacted]' : text;
}

export function cleanRunStatus(value) {
    return RUN_STATUSES.has(value) ? value : null;
}

export function cleanRunConclusion(value) {
    return RUN_CONCLUSIONS.has(value) ? value : null;
}

/** An algorithm version string, or null. */
export function cleanAlgorithmVersion(value) {
    return typeof value === 'string' && ALGORITHM_VERSION.test(value) ? value : null;
}
