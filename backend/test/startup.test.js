import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Only what Node needs to run. DOTENV_CONFIG_PATH points at a file that does not
// exist, so a developer's own backend/.env cannot change these results.
const baseEnv = {
    PATH: process.env.PATH,
    ...(process.env.SystemRoot && { SystemRoot: process.env.SystemRoot }),
    DOTENV_CONFIG_PATH: path.join(backendDir, 'test', 'no-such-file.env'),
};

function run(script, env = {}) {
    const result = spawnSync(process.execPath, [script], {
        cwd: backendDir,
        env: { ...baseEnv, ...env },
        encoding: 'utf8',
        timeout: 120_000,
    });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

const randomSecret = () => crypto.randomBytes(32).toString('hex');

describe('server startup', () => {
    it('stops before any other module runs when configuration is missing', () => {
        const { status, output } = run('server.js');

        assert.equal(status, 1);
        for (const name of [
            'MONGODB_URI', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET',
            'SESSION_SECRET', 'JWT_SECRET', 'DID_SEED_SECRET', 'GITHUB_WEBHOOK_SECRET',
        ]) {
            assert.match(output, new RegExp(`${name} is required`));
        }

        // Without the early check, Passport throws this while its module is being evaluated.
        assert.doesNotMatch(output, /OAuth2Strategy requires/);
        assert.doesNotMatch(output, /MongoDB Connected|MongoDB Connection Error|Server running/);
    });

    it('stops on weak secrets without printing any value', () => {
        const SENTINEL = 'S3NT1NEL';
        const { status, output } = run('server.js', {
            MONGODB_URI: `mysql://admin:${SENTINEL}@db.internal/kinetic`,
            GITHUB_CLIENT_ID: `your_${SENTINEL}`,
            GITHUB_CLIENT_SECRET: `your_${SENTINEL}`,
            SESSION_SECRET: `dev_session_secret_${SENTINEL}`,
            JWT_SECRET: SENTINEL,
            DID_SEED_SECRET: `kinetic-did-seed-secret-changeme-${SENTINEL}`,
            GITHUB_WEBHOOK_SECRET: SENTINEL,
        });

        assert.equal(status, 1);
        assert.match(output, /SESSION_SECRET is a placeholder/);
        assert.match(output, /DID_SEED_SECRET is a placeholder/);
        assert.equal(output.includes(SENTINEL), false);
        assert.equal(output.includes('admin'), false);
    });

    it('passes the configuration check when every required value is valid', () => {
        const secrets = {
            SESSION_SECRET: randomSecret(),
            JWT_SECRET: randomSecret(),
            DID_SEED_SECRET: randomSecret(),
            GITHUB_WEBHOOK_SECRET: randomSecret(),
        };
        const { status, output } = run('config/loadEnv.js', {
            MONGODB_URI: 'mongodb://127.0.0.1:27017/kinetic_test',
            GITHUB_CLIENT_ID: 'Iv1.0123456789abcdef',
            GITHUB_CLIENT_SECRET: '0123456789abcdef0123456789abcdef01234567',
            ...secrets,
        });

        assert.equal(status, 0);
        for (const value of Object.values(secrets)) assert.equal(output.includes(value), false);
    });
});
