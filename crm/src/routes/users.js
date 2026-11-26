'use strict';
const express = require('express');
const crypto = require('node:crypto');
const { validate, parseId } = require('../validate');
const { hashPassword, passwordPolicy, requireAuth, requireRole } = require('../auth');
const { badRequest, notFound, conflict } = require('../errors');
const { ROLES } = require('../constants');
const { audit } = require('../audit');

const USER_COLS = 'id, name, email, role, whatsapp, company, active, created_at, last_login_at';

module.exports = function userRoutes(db) {
  const r = express.Router();

  /** Directory for assignment dropdowns: every authenticated user, minimal fields. */
  r.get('/directory', requireAuth, (req, res) => {
    res.json({ users: db.all(`SELECT id, name, role, active FROM users WHERE active = 1 ORDER BY name`) });
  });

  r.get('/', requireRole('admin'), (req, res) => {
    const users = db.all(`SELECT ${USER_COLS},
        (SELECT COUNT(*) FROM students s WHERE s.supervisor_id = users.id AND s.archived_at IS NULL) AS students_supervised,
        (SELECT COUNT(*) FROM students s WHERE s.manager_id = users.id AND s.archived_at IS NULL) AS students_managed,
        (SELECT COUNT(*) FROM subjects sub WHERE sub.supervisor_id = users.id) AS subjects_count
      FROM users ORDER BY active DESC, name`);
    res.json({ users });
  });

  r.post('/', requireRole('admin'), (req, res) => {
    const data = validate(req.body, {
      name: { type: 'string', required: true, min: 2, max: 120 },
      email: { type: 'email', required: true },
      role: { type: 'string', required: true, enum: ROLES },
      whatsapp: { type: 'phone' },
      company: { type: 'string', max: 120 },
      password: { type: 'string', max: 200 },
    });
    let password = data.password;
    let generated = false;
    if (!password) { password = crypto.randomBytes(9).toString('base64url') + '1a'; generated = true; }
    const policy = passwordPolicy(password);
    if (policy) throw badRequest(policy, { password: policy });
    if (db.get('SELECT id FROM users WHERE email = ?', data.email)) throw conflict('Un utilisateur avec cet email existe déjà');
    const info = db.run('INSERT INTO users (name, email, password_hash, role, whatsapp, company) VALUES (?,?,?,?,?,?)',
      data.name, data.email, hashPassword(password), data.role, data.whatsapp || null, data.company || null);
    const id = Number(info.lastInsertRowid);
    audit(db, req, 'user.create', 'user', id, { email: data.email, role: data.role });
    const user = db.get(`SELECT ${USER_COLS} FROM users WHERE id = ?`, id);
    res.status(201).json({ user, generated_password: generated ? password : undefined });
  });

  r.patch('/:id', requireRole('admin'), (req, res) => {
    const id = parseId(req.params.id);
    const existing = db.get('SELECT * FROM users WHERE id = ?', id);
    if (!existing) throw notFound('Utilisateur introuvable');
    const data = validate(req.body, {
      name: { type: 'string', min: 2, max: 120 },
      email: { type: 'email' },
      role: { type: 'string', enum: ROLES },
      whatsapp: { type: 'phone' },
      company: { type: 'string', max: 120 },
      active: { type: 'bool' },
      password: { type: 'string', max: 200 },
    }, { partial: true });
    if (id === req.user.id && (data.active === false || (data.role && data.role !== 'admin'))) {
      throw badRequest('Vous ne pouvez pas désactiver ou rétrograder votre propre compte');
    }
    if (data.email && db.get('SELECT id FROM users WHERE email = ? AND id <> ?', data.email, id)) throw conflict('Email déjà utilisé');
    if (data.role && data.role !== 'admin' && existing.role === 'admin') {
      const admins = db.get('SELECT COUNT(*) AS n FROM users WHERE role = ? AND active = 1', 'admin').n;
      if (admins <= 1) throw badRequest('Il doit rester au moins un admin actif');
    }
    const sets = [], params = [];
    for (const k of ['name', 'email', 'role', 'whatsapp', 'company']) if (k in data) { sets.push(`${k} = ?`); params.push(data[k]); }
    if ('active' in data) { sets.push('active = ?'); params.push(data.active ? 1 : 0); }
    if (data.password) {
      const policy = passwordPolicy(data.password);
      if (policy) throw badRequest(policy, { password: policy });
      sets.push('password_hash = ?'); params.push(hashPassword(data.password));
    }
    if (sets.length) db.run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, ...params, id);
    if (data.active === false || data.password) db.run('DELETE FROM sessions WHERE user_id = ?', id);
    const { password, ...safe } = data;
    audit(db, req, 'user.update', 'user', id, { ...safe, password_reset: Boolean(password) });
    res.json({ user: db.get(`SELECT ${USER_COLS} FROM users WHERE id = ?`, id) });
  });

  return r;
};
