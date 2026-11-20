import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import passport from 'passport';
import { authenticateToken, issueToken } from '../middleware/auth.js';
import User from '../models/User.js';

const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const SECRET = crypto.randomBytes(32).toString('hex');
process.env.JWT_SECRET = SECRET;

const DAY = 24 * 60 * 60;
const ISSUER = 'kinetic-backend';
const AUDIENCE = 'kinetic-api';
const USER_ID = '507f1f77bcf86cd799439011';
const CLAIMS = { id: USER_ID, github: 'octocat', did: 'did:key:z6MkTest', role: 'contributor' };
const MISSING = 'Access token required';
const INVALID = 'Invalid or expired token';

const now = () => Math.floor(Date.now() / 1000);
const validClaims = () => ({ ...CLAIMS, iss: ISSUER, aud: AUDIENCE, iat: now(), exp: now() + DAY });
const without = (...names) => {
    const claims = validClaims();
    for (const name of names) delete claims[name];
    return claims;
};
const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

// Builds tokens jsonwebtoken refuses to sign, so that verification is what gets tested.
function rawToken(payload, { alg = 'HS256', key = SECRET } = {}) {
    const data = `${base64url({ alg, typ: 'JWT' })}.${base64url(payload)}`;
    const hash = { HS256: 'sha256', HS384: 'sha384', HS512: 'sha512' }[alg];
    return `${data}.${crypto.createHmac(hash, key).update(data).digest('base64url')}`;
}

function run(header) {
    const req = { headers: header === undefined ? {} : { authorization: header } };
    const res = {
        statusCode: null,
        body: null,
        headers: {},
        status(code) { this.statusCode = code; return this; },
        set(name, value) { this.headers[name] = value; return this; },
        json(body) { this.body = body; return this; },
    };
    let nextCalls = 0;
    authenticateToken(req, res, () => { nextCalls += 1; });
    return { req, res, nextCalls };
}

function assertRejected(header, error) {
    const { req, res, nextCalls } = run(header);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { error });
    assert.match(res.headers['WWW-Authenticate'], /^Bearer/);
    assert.equal(nextCalls, 0, 'the protected handler must not run');
    assert.equal(req.user, undefined, 'req.user must not be set');
}

const INVALID_TOKENS = {
    'an expired token': () => rawToken({ ...validClaims(), iat: now() - 2 * DAY, exp: now() - 10 }),
    'a token signed with another secret': () => rawToken(validClaims(), { key: crypto.randomBytes(32).toString('hex') }),
    'a tampered payload': () => {
        const [header, , signature] = rawToken(validClaims()).split('.');
        return `${header}.${base64url({ ...validClaims(), github: 'someone-else' })}.${signature}`;
    },
    'a tampered signature': () => `${rawToken(validClaims()).slice(0, -4)}AAAA`,
    'an unsigned token with alg none': () => `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url(validClaims())}.`,
    'an empty signature with alg HS256': () => `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(validClaims())}.`,
    'HS384 with the right secret': () => rawToken(validClaims(), { alg: 'HS384' }),
    'HS512 with the right secret': () => rawToken(validClaims(), { alg: 'HS512' }),
    'RS256 with an attacker key': () => {
        const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
        return jwt.sign(validClaims(), privateKey, { algorithm: 'RS256' });
    },
    'no exp': () => rawToken(without('exp')),
    'a non-numeric exp': () => rawToken({ ...validClaims(), exp: 'soon' }),
    'a token older than the lifetime with a far-future exp': () => rawToken({ ...validClaims(), iat: now() - 8 * DAY, exp: now() + DAY }),
    'no iat': () => rawToken(without('iat')),
    'an iat in the future': () => rawToken({ ...validClaims(), iat: now() + 3600 }),
    'a token that is not valid yet': () => rawToken({ ...validClaims(), nbf: now() + 3600 }),
    'a string payload': () => jwt.sign('just-a-string', SECRET),
    'a null payload': () => rawToken(null),
    'an array payload': () => rawToken([validClaims()]),
    'an empty payload': () => rawToken({}),
    'no id': () => rawToken(without('id')),
    'an id that is not an ObjectId': () => rawToken({ ...validClaims(), id: 'abc' }),
    'an id with extra text around an ObjectId': () => rawToken({ ...validClaims(), id: `x${USER_ID}x` }),
    'an id that is not a string': () => rawToken({ ...validClaims(), id: [USER_ID] }),
    'no github': () => rawToken(without('github')),
    'an empty github': () => rawToken({ ...validClaims(), github: '' }),
    'a github that is not a string': () => rawToken({ ...validClaims(), github: ['octocat'] }),
    'no issuer': () => rawToken(without('iss')),
    'the wrong issuer': () => rawToken({ ...validClaims(), iss: 'someone-else' }),
    'no audience': () => rawToken(without('aud')),
    'the wrong audience': () => rawToken({ ...validClaims(), aud: 'another-app' }),
    'a token issued before this change': () => jwt.sign(CLAIMS, SECRET, { expiresIn: '7d' }),
    'text that is not a JWT': () => 'not-a-jwt',
    'two segments': () => rawToken(validClaims()).split('.').slice(0, 2).join('.'),
    'four segments': () => `${rawToken(validClaims())}.extra`,
    'the word undefined': () => 'undefined',
};

const BAD_HEADERS = {
    'no header': () => undefined,
    'an empty header': () => '',
    'the scheme alone': () => 'Bearer',
    'an empty token': () => 'Bearer ',
    'the Basic scheme': () => `Basic ${issueToken(CLAIMS)}`,
    'the Token scheme': () => `Token ${issueToken(CLAIMS)}`,
    'a token with no scheme': () => issueToken(CLAIMS),
    'a scheme that only starts with Bearer': () => `BearerX ${issueToken(CLAIMS)}`,
    'text after the token': () => `Bearer ${issueToken(CLAIMS)} trailing`,
    'two tokens': () => `Bearer ${issueToken(CLAIMS)}, Bearer ${issueToken(CLAIMS)}`,
};

describe('authenticateToken', () => {
    it('accepts a token from issueToken and passes its claims to the handler', () => {
        const { req, res, nextCalls } = run(`Bearer ${issueToken(CLAIMS)}`);
        assert.equal(nextCalls, 1);
        assert.equal(res.statusCode, null);
        assert.equal(req.user.id, USER_ID);
        assert.equal(req.user.github, 'octocat');
        assert.equal(req.user.did, CLAIMS.did);
        assert.equal(req.user.role, 'contributor');
    });

    for (const header of ['bearer', 'BEARER', 'BeArEr']) {
        it(`treats the scheme as case-insensitive: ${header}`, () => {
            assert.equal(run(`${header} ${issueToken(CLAIMS)}`).nextCalls, 1);
        });
    }

    it('allows more than one space after the scheme, as HTTP does', () => {
        assert.equal(run(`Bearer   ${issueToken(CLAIMS)}`).nextCalls, 1);
    });

    it('accepts an account that has no DID, which the User model allows', () => {
        const { did, ...withoutDid } = CLAIMS;
        assert.equal(run(`Bearer ${issueToken(withoutDid)}`).nextCalls, 1);
    });

    it('accepts a token just before it expires', () => {
        assert.equal(run(`Bearer ${rawToken({ ...validClaims(), iat: now() - 6 * DAY, exp: now() + 60 })}`).nextCalls, 1);
    });

    for (const [name, build] of Object.entries(BAD_HEADERS)) {
        it(`asks for a token when given ${name}`, () => assertRejected(build(), MISSING));
    }

    for (const [name, build] of Object.entries(INVALID_TOKENS)) {
        it(`rejects ${name}`, () => assertRejected(`Bearer ${build()}`, INVALID));
    }

    it('rejects tokens when JWT_SECRET is missing', () => {
        const token = issueToken(CLAIMS);
        const unsigned = `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(validClaims())}.`;
        delete process.env.JWT_SECRET;
        try {
            assertRejected(`Bearer ${token}`, INVALID);
            assertRejected(`Bearer ${unsigned}`, INVALID);
        } finally {
            process.env.JWT_SECRET = SECRET;
        }
    });

    it('never logs or returns anything from the token', (t) => {
        const sentinel = 'SENTINEL-TOKEN-CONTENT';
        const logs = ['log', 'info', 'warn', 'error'].map((level) => t.mock.method(console, level, () => {}));
        const { res } = run(`Bearer ${rawToken({ ...validClaims(), github: sentinel, exp: now() - 10 })}`);
        assert.doesNotMatch(JSON.stringify(res.body), /SENTINEL/);
        for (const log of logs) assert.equal(log.mock.callCount(), 0);
    });
});

describe('issueToken', () => {
    it('signs with HS256', () => {
        assert.equal(jwt.decode(issueToken(CLAIMS), { complete: true }).header.alg, 'HS256');
    });

    it('verifies against the configured secret only', () => {
        const token = issueToken(CLAIMS);
        assert.doesNotThrow(() => jwt.verify(token, SECRET));
        assert.throws(() => jwt.verify(token, 'a'.repeat(64)));
    });

    it('keeps the existing claims and adds issuer and audience', () => {
        const payload = jwt.decode(issueToken(CLAIMS));
        assert.equal(payload.id, USER_ID);
        assert.equal(payload.github, CLAIMS.github);
        assert.equal(payload.did, CLAIMS.did);
        assert.equal(payload.role, CLAIMS.role);
        assert.equal(payload.iss, ISSUER);
        assert.equal(payload.aud, AUDIENCE);
    });

    it('keeps the existing lifetime of 7 days', () => {
        const payload = jwt.decode(issueToken(CLAIMS));
        assert.equal(payload.exp - payload.iat, 7 * DAY);
    });

    it('stores a Mongoose ObjectId as a string the middleware accepts', () => {
        const token = issueToken({ ...CLAIMS, id: new mongoose.Types.ObjectId(USER_ID) });
        assert.equal(run(`Bearer ${token}`).req.user.id, USER_ID);
    });
});

describe('protected routes', () => {
    // Every route that needs a token. A route that loses its protection fails here.
    const PROTECTED = {
        auth: ['GET /me', 'GET /did-resolve/self', 'PUT /wallet'],
        contribution: ['GET /me'],
        repo: [
            'GET /contributors',
            'GET /info',
            'POST /repositories',
            'GET /repositories/:repoId/branches',
            'PUT /repositories/:repoId/branches',
            'PUT /repositories/:repoId/config',
            'POST /payout/execute',
        ],
        payoutLifecycle: ['GET /:payoutId', 'POST /:payoutId/approve', 'POST /:payoutId/execute'],
    };
    const MODEL_METHODS = ['findById', 'findOne', 'find', 'findByIdAndUpdate'];
    const routers = {};
    let server;
    let baseUrl;

    const call = (url, { method = 'GET', authorization } = {}) => fetch(`${baseUrl}${url}`, {
        method,
        redirect: 'manual',
        headers: authorization ? { authorization } : {},
    });

    before(async () => {
        const app = express();
        app.use(express.json());
        app.use(session({ secret: SECRET, resave: false, saveUninitialized: false }));
        app.use(passport.initialize());
        passport.serializeUser((user, done) => done(null, String(user._id)));
        passport.use('github', {
            authenticate() {
                this.success({ _id: new mongoose.Types.ObjectId(USER_ID), github: 'octocat', did: CLAIMS.did, role: 'contributor' });
            },
        });
        for (const name of Object.keys(PROTECTED)) {
            routers[name] = (await import(`../routes/${name}.js`)).default;
            app.use(`/${name}`, routers[name]);
        }
        await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    after(async () => {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
    });

    for (const [name, routes] of Object.entries(PROTECTED)) {
        it(`${name}: the shared middleware runs first on exactly the expected routes`, () => {
            const found = [];
            for (const { route } of routers[name].stack) {
                if (!route) continue;
                const position = route.stack.findIndex((layer) => layer.handle === authenticateToken);
                if (position === -1) continue;
                assert.equal(position, 0, `${route.path} must check the token before anything else`);
                found.push(`${Object.keys(route.methods)[0].toUpperCase()} ${route.path}`);
            }
            assert.deepEqual(found, routes);
        });

        for (const route of routes) {
            const [method, routePath] = route.split(' ');
            const url = `/${name}${routePath.replace(':payoutId', '1').replace(':repoId', 'octo%2Frepo')}`;

            it(`${name}: ${route} rejects bad credentials before its handler runs`, async (t) => {
                const spies = MODEL_METHODS.map((m) => t.mock.method(User, m, () => { throw new Error('handler reached'); }));
                const badCredentials = [
                    undefined,
                    `Basic ${issueToken(CLAIMS)}`,
                    `Bearer ${rawToken({ ...validClaims(), iat: now() - 2 * DAY, exp: now() - 10 })}`,
                    `Bearer ${rawToken(validClaims(), { key: crypto.randomBytes(32).toString('hex') })}`,
                ];
                for (const authorization of badCredentials) {
                    const response = await call(url, { method, authorization });
                    assert.equal(response.status, 401, `got ${response.status} for ${authorization}`);
                    assert.match(response.headers.get('www-authenticate'), /^Bearer/);
                }
                for (const spy of spies) assert.equal(spy.mock.callCount(), 0);
            });
        }
    }

    it('a valid token reaches the handler with the right user', async (t) => {
        const findById = t.mock.method(User, 'findById', () => ({
            select: async () => ({ _id: USER_ID, github: 'octocat', role: 'contributor', repositories: [] }),
        }));
        const response = await call('/auth/me', { authorization: `Bearer ${issueToken(CLAIMS)}` });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).user.github, 'octocat');
        assert.equal(findById.mock.calls[0].arguments[0], USER_ID);
    });

    it('a valid token still cannot do what its account is not allowed to do', async (t) => {
        t.mock.method(User, 'findById', async () => ({ role: 'contributor' }));
        const response = await call('/payoutLifecycle/1', { authorization: `Bearer ${issueToken(CLAIMS)}` });
        assert.equal(response.status, 403);
        assert.match((await response.json()).error, /Only organization accounts/);
    });

    it('the role comes from the database, not from the token', async (t) => {
        t.mock.method(User, 'findById', async () => ({ role: 'contributor' }));
        const token = issueToken({ ...CLAIMS, role: 'organization' });
        const response = await call('/payoutLifecycle/1', { authorization: `Bearer ${token}` });
        assert.equal(response.status, 403);
    });

    it('an allowed account gets past authentication and role checks', async (t) => {
        t.mock.method(User, 'findById', async () => ({ role: 'organization' }));
        const response = await call('/payoutLifecycle/not-a-number', { authorization: `Bearer ${issueToken(CLAIMS)}` });
        assert.equal(response.status, 400);
    });

    it('the token from the OAuth callback works on a protected route', async (t) => {
        const callback = await call('/auth/github/callback');
        assert.equal(callback.status, 302);
        const token = new URL(callback.headers.get('location')).searchParams.get('token');
        assert.ok(token);

        t.mock.method(User, 'findById', () => ({
            select: async () => ({ _id: USER_ID, github: 'octocat', role: 'contributor', repositories: [] }),
        }));
        const profile = await call('/auth/me', { authorization: `Bearer ${token}` });
        assert.equal(profile.status, 200);
    });
});

describe('source rules', () => {
    function sourceFiles(dir) {
        return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) return sourceFiles(full);
            return full.endsWith('.js') && !full.endsWith('.test.js') ? [full] : [];
        });
    }

    it('only middleware/auth.js uses jsonwebtoken', () => {
        const offenders = ['routes', 'services', 'config', 'middleware', 'models']
            .flatMap((dir) => sourceFiles(path.join(backendDir, dir)))
            .filter((file) => /from\s+['"]jsonwebtoken['"]/.test(fs.readFileSync(file, 'utf8')))
            .map((file) => path.relative(backendDir, file).replaceAll('\\', '/'));
        assert.deepEqual(offenders, ['middleware/auth.js']);
    });

    it('no route file defines its own authenticateToken', () => {
        const offenders = sourceFiles(path.join(backendDir, 'routes'))
            .filter((file) => /function\s+authenticateToken/.test(fs.readFileSync(file, 'utf8')));
        assert.deepEqual(offenders, []);
    });
});
