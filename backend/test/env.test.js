import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { validateEnv, formatConfigErrors } from '../config/env.js';

const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const SECRETS = ['SESSION_SECRET', 'JWT_SECRET', 'DID_SEED_SECRET', 'GITHUB_WEBHOOK_SECRET'];
const CREDENTIALS = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'];
const REQUIRED = ['MONGODB_URI', ...CREDENTIALS, ...SECRETS];

const FLOW_ADDRESS = '0xad4936d3ee4b3b32';
const FLOW_KEY = 'ab'.repeat(32);

const randomSecret = () => crypto.randomBytes(32).toString('hex');

function validEnv(overrides = {}) {
    return {
        MONGODB_URI: 'mongodb://localhost:27017/kinetic',
        GITHUB_CLIENT_ID: 'Iv1.0123456789abcdef',
        GITHUB_CLIENT_SECRET: '0123456789abcdef0123456789abcdef01234567',
        SESSION_SECRET: randomSecret(),
        JWT_SECRET: randomSecret(),
        DID_SEED_SECRET: randomSecret(),
        GITHUB_WEBHOOK_SECRET: randomSecret(),
        ...overrides,
    };
}

function backendSourceFiles() {
    const files = [];
    (function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (['node_modules', 'test', 'tests', 'flow', 'ipfs-store'].includes(entry.name)) continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) files.push(full);
        }
    })(backendDir);
    return files;
}

const reasonFor = (env, name) => validateEnv(env).errors.find(e => e.name === name)?.reason;

describe('validateEnv: valid configuration', () => {
    it('accepts a complete configuration', () => {
        assert.deepEqual(validateEnv(validEnv()).errors, []);
    });

    it('accepts every optional value in a valid format', () => {
        const env = validEnv({
            PORT: '8080',
            FRONTEND_URL: 'https://kinetic.example.org',
            GITHUB_CALLBACK_URL: 'https://api.kinetic.dev/api/auth/github/callback',
            GITHUB_PAT: 'ghp_0123456789abcdefghijklmnopqrstuvwxyz',
            FLOW_ADDRESS,
            FLOW_CONTRACT_ADDRESS: FLOW_ADDRESS,
            FLOW_PRIVATE_KEY: FLOW_KEY,
        });
        assert.deepEqual(validateEnv(env).errors, []);
    });

    it('treats an empty optional value as not set', () => {
        const env = validEnv({ PORT: '', FRONTEND_URL: '', GITHUB_PAT: '', FLOW_ADDRESS: '', FLOW_PRIVATE_KEY: '' });
        assert.deepEqual(validateEnv(env).errors, []);
    });
});

describe('validateEnv: required values', () => {
    for (const name of REQUIRED) {
        it(`rejects a missing ${name}`, () => {
            const env = validEnv();
            delete env[name];
            assert.equal(reasonFor(env, name), 'is required but not set');
        });

        it(`rejects an empty ${name}`, () => {
            assert.equal(reasonFor(validEnv({ [name]: '' }), name), 'is required but not set');
        });

        it(`rejects a whitespace-only ${name}`, () => {
            assert.match(reasonFor(validEnv({ [name]: '   ' }), name), /spaces/);
        });
    }

    it('reports every problem at once rather than only the first', () => {
        const { errors } = validateEnv({});
        assert.deepEqual(errors.map(e => e.name).sort(), [...REQUIRED].sort());
    });
});

describe('validateEnv: generated secrets', () => {
    for (const name of SECRETS) {
        it(`rejects a short ${name}`, () => {
            assert.match(reasonFor(validEnv({ [name]: 'abcdefgh'.repeat(4).slice(0, 31) }), name), /at least 32 bytes/);
        });

        it(`accepts a ${name} of exactly 32 bytes`, () => {
            assert.equal(reasonFor(validEnv({ [name]: 'abcdefgh'.repeat(4) }), name), undefined);
        });
    }

    it('counts bytes, not characters', () => {
        const sixteenTwoByteCharacters = 'αβγδεζηθικλμνξοπ';
        assert.equal(reasonFor(validEnv({ JWT_SECRET: sixteenTwoByteCharacters }), 'JWT_SECRET'), undefined);
    });

    const weakValues = [
        'dev_session_secret',
        'kinetic-did-seed-secret-changeme',
        'changeme-changeme-changeme-changeme-1234',
        'CHANGE_ME_CHANGE_ME_CHANGE_ME_CHANGE_ME',
        'your_session_secret_goes_here_1234567890',
        'replace_me_with_a_long_random_value_12345',
        '<a-secure-random-string-of-32-bytes-or-more>',
        'placeholder-placeholder-placeholder-1234',
        'an-example-value-that-is-long-enough-1234',
    ];
    for (const value of weakValues) {
        it(`rejects the placeholder "${value}"`, () => {
            assert.match(reasonFor(validEnv({ SESSION_SECRET: value }), 'SESSION_SECRET'), /placeholder/);
        });
    }

    it('rejects a long but repetitive secret', () => {
        assert.match(reasonFor(validEnv({ JWT_SECRET: 'a'.repeat(64) }), 'JWT_SECRET'), /repetitive/);
        assert.match(reasonFor(validEnv({ JWT_SECRET: 'abc'.repeat(20) }), 'JWT_SECRET'), /repetitive/);
    });

    it('rejects surrounding whitespace instead of silently trimming it', () => {
        assert.match(reasonFor(validEnv({ JWT_SECRET: `${randomSecret()}\n` }), 'JWT_SECRET'), /spaces/);
    });

    it('rejects the same value used for two secrets, naming variables only', () => {
        const shared = randomSecret();
        const { errors } = validateEnv(validEnv({ SESSION_SECRET: shared, DID_SEED_SECRET: shared }));
        assert.deepEqual(errors, [{ name: 'DID_SEED_SECRET', reason: 'must be different from SESSION_SECRET' }]);
    });
});

describe('validateEnv: GitHub credentials', () => {
    for (const name of CREDENTIALS) {
        it(`rejects a placeholder ${name}`, () => {
            assert.match(reasonFor(validEnv({ [name]: 'your_github_value' }), name), /placeholder/);
            assert.match(reasonFor(validEnv({ [name]: '<your-github-oauth-value>' }), name), /placeholder/);
        });
    }

    it('does not impose a length on credentials GitHub issues', () => {
        assert.equal(reasonFor(validEnv({ GITHUB_CLIENT_ID: 'Ov23li' }), 'GITHUB_CLIENT_ID'), undefined);
    });

    it('rejects whitespace inside a personal access token', () => {
        assert.match(reasonFor(validEnv({ GITHUB_PAT: 'ghp_abc def' }), 'GITHUB_PAT'), /whitespace/);
    });
});

describe('validateEnv: value formats', () => {
    it('accepts the MongoDB connection string forms', () => {
        for (const uri of [
            'mongodb://localhost:27017/kinetic',
            'mongodb://user:pass@a.example.net:27017,b.example.net:27017/kinetic?replicaSet=rs0',
            'mongodb+srv://user:pass@cluster0.abcde.mongodb.net/kinetic',
        ]) {
            assert.equal(reasonFor(validEnv({ MONGODB_URI: uri }), 'MONGODB_URI'), undefined, uri);
        }
    });

    it('rejects other schemes and an unfilled Atlas template', () => {
        assert.match(reasonFor(validEnv({ MONGODB_URI: 'mysql://localhost/db' }), 'MONGODB_URI'), /mongodb:\/\//);
        assert.match(reasonFor(validEnv({ MONGODB_URI: 'mongodb://' }), 'MONGODB_URI'), /mongodb:\/\//);
        assert.match(reasonFor(validEnv({ MONGODB_URI: 'mongodb+srv://admin:<db_password>@c0.mongodb.net/' }), 'MONGODB_URI'), /placeholder/);
    });

    for (const name of ['FRONTEND_URL', 'GITHUB_CALLBACK_URL']) {
        it(`rejects a ${name} that is not an http or https URL`, () => {
            for (const value of ['localhost:3000/x', 'not a url', 'ftp://example.org']) {
                assert.match(reasonFor(validEnv({ [name]: value }), name), /http/, value);
            }
        });
    }

    it('rejects an out-of-range or non-numeric PORT', () => {
        for (const value of ['abc', '0', '65536', '80.5', '-1']) {
            assert.match(reasonFor(validEnv({ PORT: value }), 'PORT'), /1 to 65535/, value);
        }
    });

    it('rejects malformed Flow values', () => {
        assert.match(reasonFor(validEnv({ FLOW_ADDRESS: 'ad4936d3ee4b3b32' }), 'FLOW_ADDRESS'), /0x/);
        assert.match(reasonFor(validEnv({ FLOW_ADDRESS, FLOW_CONTRACT_ADDRESS: '0x12' }), 'FLOW_CONTRACT_ADDRESS'), /0x/);
        assert.match(reasonFor(validEnv({ FLOW_ADDRESS, FLOW_PRIVATE_KEY: 'abc123' }), 'FLOW_PRIVATE_KEY'), /64 hex/);
    });

    it('accepts a Flow private key with or without 0x, as flowService does', () => {
        for (const key of [FLOW_KEY, `0x${FLOW_KEY}`]) {
            assert.equal(reasonFor(validEnv({ FLOW_ADDRESS, FLOW_PRIVATE_KEY: key }), 'FLOW_PRIVATE_KEY'), undefined);
        }
    });
});

describe('validateEnv: Flow is optional but must be coherent', () => {
    it('starts without Flow and warns that payouts are unavailable', () => {
        const { errors, warnings } = validateEnv(validEnv());
        assert.deepEqual(errors, []);
        assert.ok(warnings.some((warning) => /FLOW_PRIVATE_KEY/.test(warning)));
    });

    it('warns that contributions cannot be scored without a GitHub token', () => {
        assert.ok(validateEnv(validEnv()).warnings.some((warning) => /GITHUB_PAT/.test(warning)));
    });

    it('allows the read-only mode flowService supports: an address with no key', () => {
        assert.deepEqual(validateEnv(validEnv({ FLOW_ADDRESS })).errors, []);
    });

    it('does not warn when a private key is configured', () => {
        const configured = validEnv({ FLOW_ADDRESS, FLOW_PRIVATE_KEY: FLOW_KEY, GITHUB_PAT: 'ghp_0123456789abcdefghijklmnopqrstuvwxyz' });
        assert.deepEqual(validateEnv(configured).warnings, []);
    });

    it('rejects a private key or contract with no address', () => {
        assert.match(reasonFor(validEnv({ FLOW_PRIVATE_KEY: FLOW_KEY }), 'FLOW_ADDRESS'), /required when/);
        assert.match(reasonFor(validEnv({ FLOW_CONTRACT_ADDRESS: FLOW_ADDRESS }), 'FLOW_ADDRESS'), /required when/);
    });
});

describe('configuration errors never expose values', () => {
    const SENTINEL = 'S3NT1NEL';

    it('keeps every rejected value out of errors, warnings and the printed message', () => {
        const env = {
            MONGODB_URI: `mysql://admin:${SENTINEL}@db.internal/kinetic`,
            GITHUB_CLIENT_ID: `your_${SENTINEL}`,
            GITHUB_CLIENT_SECRET: `${SENTINEL} with spaces`,
            SESSION_SECRET: SENTINEL,
            JWT_SECRET: `  ${SENTINEL}  `,
            DID_SEED_SECRET: `changeme-${SENTINEL}`,
            GITHUB_WEBHOOK_SECRET: SENTINEL,
            GITHUB_PAT: `your_${SENTINEL}`,
            GITHUB_CALLBACK_URL: `ftp://${SENTINEL}.example`,
            FRONTEND_URL: `not a url ${SENTINEL}`,
            PORT: SENTINEL,
            FLOW_ADDRESS: SENTINEL,
            FLOW_CONTRACT_ADDRESS: SENTINEL,
            FLOW_PRIVATE_KEY: SENTINEL,
        };
        const { errors, warnings } = validateEnv(env);

        assert.ok(errors.length >= Object.keys(env).length, 'every value should have been rejected');
        const everything = JSON.stringify({ errors, warnings }) + formatConfigErrors(errors);
        assert.equal(everything.includes(SENTINEL), false);
        assert.equal(everything.includes('admin'), false);
    });

    it('lists variables by name and explains how to fix them', () => {
        const message = formatConfigErrors([{ name: 'JWT_SECRET', reason: 'is required but not set' }]);
        assert.match(message, /JWT_SECRET is required but not set/);
        assert.match(message, /\.env\.example/);
        assert.match(message, /randomBytes/);
    });
});

describe('.env.example', () => {
    const example = fs.readFileSync(path.join(backendDir, '.env.example'), 'utf8');

    it('fails validation until its placeholders are replaced', () => {
        const { errors } = validateEnv(dotenv.parse(example));
        const placeholders = [...CREDENTIALS, ...SECRETS];
        assert.equal(errors.length, placeholders.length, 'each placeholder should be reported exactly once');
        assert.deepEqual(
            errors.filter(e => /placeholder/.test(e.reason)).map(e => e.name).sort(),
            [...placeholders].sort()
        );
    });

    it('documents every environment variable the backend reads', () => {
        const names = new Set();
        for (const file of backendSourceFiles()) {
            for (const [, name] of fs.readFileSync(file, 'utf8').matchAll(/process\.env\.([A-Z0-9_]+)/g)) names.add(name);
        }

        assert.ok(names.has('SESSION_SECRET'), 'the source scan should find known variables');
        const undocumented = [...names].filter(name => !new RegExp(`^#?\\s*${name}=`, 'm').test(example));
        assert.deepEqual(undocumented, []);
    });
});

describe('source code', () => {
    it('has no fallback value for any secret or credential', () => {
        const pattern = /process\.env\.(SESSION_SECRET|JWT_SECRET|DID_SEED_SECRET|GITHUB_WEBHOOK_SECRET|GITHUB_CLIENT_ID|GITHUB_CLIENT_SECRET|MONGODB_URI|FLOW_PRIVATE_KEY)\s*(\|\||\?\?)/;
        const offenders = backendSourceFiles().filter(file => pattern.test(fs.readFileSync(file, 'utf8')));
        assert.deepEqual(offenders.map(file => path.relative(backendDir, file)), []);
    });
});

describe('DID seed', () => {
    const SEED = 'known-answer-identity-seed-0123456789abcdef';
    const original = process.env.DID_SEED_SECRET;
    const restore = () => {
        if (original === undefined) delete process.env.DID_SEED_SECRET;
        else process.env.DID_SEED_SECRET = original;
    };

    it('refuses to derive a DID when the seed is missing', async () => {
        const { authenticateDID } = await import('../services/didService.js');
        delete process.env.DID_SEED_SECRET;
        try {
            assert.throws(() => authenticateDID('12345'), /DID_SEED_SECRET is not configured/);
        } finally {
            restore();
        }
    });

    it('keeps deriving the same DID from the same seed, so existing identities are unchanged', async () => {
        const { authenticateDID } = await import('../services/didService.js');
        process.env.DID_SEED_SECRET = SEED;
        try {
            assert.equal(authenticateDID('12345').didString, 'did:key:z6Mkp87ZGz1sj8CHLrh9WeuxQCpQ8WmAXurNFQgWbv4oy2Eg');
        } finally {
            restore();
        }
    });
});
