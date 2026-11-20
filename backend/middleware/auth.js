/**
 * JWT authentication: the only place tokens are issued and checked.
 * Route files use issueToken and authenticateToken instead of calling jsonwebtoken.
 */

import jwt from 'jsonwebtoken';

const ALGORITHM = 'HS256';
const ISSUER = 'kinetic-backend';
const AUDIENCE = 'kinetic-api';
const TOKEN_LIFETIME = '7d';

const BEARER_HEADER = /^Bearer +(\S+)$/i; // Auth schemes are case-insensitive (RFC 9110).
const OBJECT_ID = /^[0-9a-f]{24}$/i;

export function issueToken(claims) {
    return jwt.sign(claims, process.env.JWT_SECRET, {
        algorithm: ALGORITHM,
        expiresIn: TOKEN_LIFETIME,
        issuer: ISSUER,
        audience: AUDIENCE,
    });
}

// jsonwebtoken accepts a token with no exp or with an iat in the future, so both are checked here.
// Only id and github are required because they are the only identity claims handlers read.
function hasRequiredClaims(payload) {
    return typeof payload.exp === 'number'
        && payload.iat <= Math.floor(Date.now() / 1000)
        && typeof payload.id === 'string' && OBJECT_ID.test(payload.id)
        && typeof payload.github === 'string' && payload.github !== '';
}

function verifyToken(token) {
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: [ALGORITHM],
            issuer: ISSUER,
            audience: AUDIENCE,
            maxAge: TOKEN_LIFETIME, // Also makes iat mandatory.
        });
        return hasRequiredClaims(payload) ? payload : null;
    } catch {
        return null; // Every failure gets the same answer, so callers learn nothing about the token.
    }
}

export function authenticateToken(req, res, next) {
    const match = BEARER_HEADER.exec(req.headers.authorization ?? '');
    if (!match) {
        return res.status(401).set('WWW-Authenticate', 'Bearer').json({ error: 'Access token required' });
    }

    const payload = verifyToken(match[1]);
    if (!payload) {
        return res.status(401).set('WWW-Authenticate', 'Bearer error="invalid_token"').json({ error: 'Invalid or expired token' });
    }

    req.user = payload;
    return next();
}
