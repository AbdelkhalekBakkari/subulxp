'use strict';
const express = require('express');
const crypto = require('node:crypto');
const { validate } = require('../validate');
const { rateLimiter } = require('../auth');
const { unauthorized, conflict } = require('../errors');
const { DOMAINS, LEVELS, STUDENT_STATUSES } = require('../constants');
const { getIntakeKey } = require('./settings');

/**
 * Intake endpoint for the landing form (xp.subul.uk). The landing page posts the JSON built
 * in index.html: { prenom, nom, email, whatsapp, statut, domaines, niveau, envoye_le, message }.
 * Protected by a shared key (query ?key= or X-Intake-Key header) and an IP rate limit.
 */
module.exports = function publicRoutes(db, config) {
  const r = express.Router();
  const limiter = rateLimiter({ windowMs: 60 * 60 * 1000, max: 30 });

  r.use('/leads', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && config.intakeAllowedOrigins.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, X-Intake-Key');
      res.set('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });

  r.post('/leads', limiter, (req, res) => {
    const provided = String(req.headers['x-intake-key'] || req.query.key || '');
    const expected = getIntakeKey(db);
    const a = Buffer.from(provided), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw unauthorized('Clé d\'intégration invalide');

    const body = req.body || {};
    const domainsRaw = Array.isArray(body.domaines) ? body.domaines : String(body.domaines || body.domains || '').split(/,| et /);
    const data = validate({
      first_name: body.prenom ?? body.first_name, last_name: body.nom ?? body.last_name,
      email: body.email, whatsapp: body.whatsapp, status: body.statut ?? body.status, level: body.niveau ?? body.level,
      domains: domainsRaw.map((d) => String(d).trim()).filter((d) => DOMAINS.includes(d)),
    }, {
      first_name: { type: 'string', required: true, min: 1, max: 80 }, last_name: { type: 'string', required: true, min: 1, max: 80 },
      email: { type: 'email', required: true }, whatsapp: { type: 'phone' },
      status: { type: 'string', enum: STUDENT_STATUSES }, level: { type: 'string', enum: LEVELS },
      domains: { type: 'array', enum: DOMAINS },
    });
    const existing = db.get('SELECT id FROM students WHERE email = ?', data.email);
    if (existing) {
      db.run('INSERT INTO activities (student_id, type, content) VALUES (?,?,?)', existing.id, 'system', 'Nouvelle demande reçue via le formulaire landing');
      throw conflict('Lead déjà enregistré');
    }
    const id = db.transaction(() => {
      const info = db.run(`INSERT INTO students (first_name, last_name, email, whatsapp, status, level, stage, source)
        VALUES (?,?,?,?,?,?,'lead','landing')`, data.first_name, data.last_name, data.email, data.whatsapp || null, data.status || null, data.level || null);
      const sid = Number(info.lastInsertRowid);
      for (const d of data.domains) db.run('INSERT INTO student_domains (student_id, domain) VALUES (?,?)', sid, d);
      db.run('INSERT INTO activities (student_id, type, content) VALUES (?,?,?)', sid, 'system', 'Lead reçu via le formulaire landing (xp.subul.uk)');
      return sid;
    });
    db.run('INSERT INTO audit_log (action, entity, entity_id, ip) VALUES (?,?,?,?)', 'lead.intake', 'student', id, req.ip || null);
    res.status(201).json({ ok: true, id });
  });

  return r;
};
