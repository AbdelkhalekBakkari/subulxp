'use strict';
const express = require('express');
const { validate } = require('../validate');
const { verifyPassword, hashPassword, passwordPolicy, requireAuth, rateLimiter } = require('../auth');
const { badRequest, unauthorized } = require('../errors');
const { audit } = require('../audit');
const { now } = require('../db');

module.exports = function authRoutes(db) {
  const r = express.Router();
  const loginLimiter = rateLimiter({ windowMs: 15 * 60 * 1000, max: 10, keyFn: (req) => req.ip + '|' + String(req.body?.email || '').toLowerCase() });

  r.post('/login', loginLimiter, (req, res) => {
    const { email, password } = validate(req.body, {
      email: { type: 'email', required: true },
      password: { type: 'string', required: true, max: 200 },
    });
    const user = db.get('SELECT * FROM users WHERE email = ?', email);
    const ok = user && user.active && verifyPassword(password, user.password_hash);
    if (!ok) {
      db.run('INSERT INTO audit_log (user_id, action, entity, details, ip) VALUES (?,?,?,?,?)',
        user ? user.id : null, 'login.failed', 'user', JSON.stringify({ email }), req.ip || null);
      throw unauthorized('Email ou mot de passe incorrect');
    }
    db.run('UPDATE users SET last_login_at = ? WHERE id = ?', now(), user.id);
    res.setSession(user.id);
    req.user = { id: user.id };
    audit(db, req, 'login.success', 'user', user.id);
    res.json({ user: publicUser(user) });
  });

  r.post('/logout', (req, res) => {
    if (req.user) audit(db, req, 'logout', 'user', req.user.id);
    res.clearSession();
    res.json({ ok: true });
  });

  r.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  r.post('/password', requireAuth, (req, res) => {
    const { current_password, new_password } = validate(req.body, {
      current_password: { type: 'string', required: true, max: 200 },
      new_password: { type: 'string', required: true, max: 200 },
    });
    const user = db.get('SELECT * FROM users WHERE id = ?', req.user.id);
    if (!verifyPassword(current_password, user.password_hash)) throw badRequest('Mot de passe actuel incorrect', { current_password: 'Incorrect' });
    const policy = passwordPolicy(new_password);
    if (policy) throw badRequest(policy, { new_password: policy });
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(new_password), user.id);
    // Revoke every other session of this user.
    db.run('DELETE FROM sessions WHERE user_id = ? AND id <> ?', user.id, req.sessionId);
    audit(db, req, 'password.changed', 'user', user.id);
    res.json({ ok: true });
  });

  return r;
};

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, whatsapp: u.whatsapp, company: u.company };
}
module.exports.publicUser = publicUser;
