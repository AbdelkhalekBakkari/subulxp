'use strict';
const crypto = require('node:crypto');
const { unauthorized, forbidden } = require('./errors');
const { now } = require('./db');

// --- Password hashing: scrypt (node:crypto), constant-time comparison ---
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

function verifyPassword(password, stored) {
  try {
    const [algo, N, r, p, saltB64, keyB64] = String(stored).split('$');
    if (algo !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(keyB64, 'base64');
    const key = crypto.scryptSync(password, salt, expected.length, { N: Number(N), r: Number(r), p: Number(p) });
    return key.length === expected.length && crypto.timingSafeEqual(key, expected);
  } catch { return false; }
}

function passwordPolicy(pw) {
  if (typeof pw !== 'string' || pw.length < 10) return 'Le mot de passe doit contenir au moins 10 caractères';
  if (pw.length > 200) return 'Mot de passe trop long';
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'Le mot de passe doit contenir des lettres et des chiffres';
  return null;
}

// --- Session cookies: random token stored in DB, HMAC-signed cookie value ---
const COOKIE = 'sxp_session';

function sign(value, secret) {
  return value + '.' + crypto.createHmac('sha256', secret).update(value).digest('base64url');
}
function unsign(signed, secret) {
  if (typeof signed !== 'string') return null;
  const i = signed.lastIndexOf('.');
  if (i < 0) return null;
  const value = signed.slice(0, i);
  const expected = sign(value, secret);
  const a = Buffer.from(signed), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? value : null;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function createSessionMiddleware(db, config) {
  return function sessionMiddleware(req, res, next) {
    req.user = null;
    req.sessionId = null;
    const cookies = parseCookies(req.headers.cookie);
    const token = unsign(cookies[COOKIE], config.sessionSecret);
    if (token) {
      const row = db.get(
        `SELECT s.id AS sid, s.expires_at, u.id, u.name, u.email, u.role, u.whatsapp, u.company, u.active
           FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`, token);
      if (row && row.active && row.expires_at > now()) {
        req.user = { id: row.id, name: row.name, email: row.email, role: row.role, whatsapp: row.whatsapp, company: row.company };
        req.sessionId = row.sid;
      } else if (row) {
        db.run('DELETE FROM sessions WHERE id = ?', row.sid);
      }
    }
    res.setSession = (userId) => {
      const id = crypto.randomBytes(32).toString('base64url');
      const expires = new Date(Date.now() + config.sessionHours * 3600 * 1000);
      db.run('INSERT INTO sessions (id, user_id, expires_at, ip, user_agent) VALUES (?,?,?,?,?)',
        id, userId, expires.toISOString(), req.ip || null, String(req.headers['user-agent'] || '').slice(0, 300));
      res.cookie(COOKIE, sign(id, config.sessionSecret), {
        httpOnly: true, sameSite: 'strict', secure: config.secureCookies, path: '/', expires,
      });
      req.sessionId = id;
    };
    res.clearSession = () => {
      if (req.sessionId) db.run('DELETE FROM sessions WHERE id = ?', req.sessionId);
      res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'strict', secure: config.secureCookies, path: '/' });
    };
    next();
  };
}

/** CSRF defence in depth: SameSite=Strict cookie + a custom header that simple cross-site forms cannot set. */
function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.headers['x-requested-with'] !== 'XMLHttpRequest') return next(forbidden('En-tête X-Requested-With manquant'));
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return next(unauthorized());
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}

/** Simple in-memory rate limiter keyed by IP (+ optional key). Good enough for a single-node deployment. */
function rateLimiter({ windowMs, max, keyFn }) {
  const hits = new Map();
  setInterval(() => {
    const t = Date.now();
    for (const [k, v] of hits) if (v.reset < t) hits.delete(k);
  }, windowMs).unref();
  return (req, res, next) => {
    const key = (keyFn ? keyFn(req) : req.ip) || 'unknown';
    const t = Date.now();
    let e = hits.get(key);
    if (!e || e.reset < t) { e = { count: 0, reset: t + windowMs }; hits.set(key, e); }
    e.count++;
    if (e.count > max) {
      res.set('Retry-After', String(Math.ceil((e.reset - t) / 1000)));
      return res.status(429).json({ error: 'Trop de tentatives, réessayez plus tard.' });
    }
    next();
  };
}

module.exports = {
  hashPassword, verifyPassword, passwordPolicy, createSessionMiddleware, csrfGuard,
  requireAuth, requireRole, rateLimiter, COOKIE,
};
