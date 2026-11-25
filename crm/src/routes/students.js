'use strict';
const express = require('express');
const { validate, parseId, normalizePhone } = require('../validate');
const { requireAuth, requireRole } = require('../auth');
const { badRequest, notFound, forbidden, conflict } = require('../errors');
const { DOMAINS, LEVELS, STUDENT_STATUSES, STAGES, STAGE_LABELS, SOURCES, ACTIVITY_TYPES } = require('../constants');
const { studentScopeSql, canManage } = require('../scope');
const { toCsv, parseCsv } = require('../csv');
const { audit } = require('../audit');
const { now } = require('../db');

const STUDENT_SCHEMA = {
  first_name: { type: 'string', required: true, min: 1, max: 80 },
  last_name: { type: 'string', required: true, min: 1, max: 80 },
  email: { type: 'email' },
  whatsapp: { type: 'phone' },
  status: { type: 'string', enum: STUDENT_STATUSES },
  level: { type: 'string', enum: LEVELS },
  school: { type: 'string', max: 160 },
  city: { type: 'string', max: 80 },
  stage: { type: 'string', enum: STAGES },
  source: { type: 'string', enum: SOURCES },
  supervisor_id: { type: 'int', min: 1 },
  manager_id: { type: 'int', min: 1 },
  notes: { type: 'string', max: 5000 },
  domains: { type: 'array', enum: DOMAINS },
};
// Fields an encadrant may edit on their own students.
const SUPERVISOR_EDITABLE = ['level', 'stage', 'notes', 'whatsapp', 'email', 'status', 'school', 'city', 'domains'];

const SELECT = `
  SELECT s.*, sup.name AS supervisor_name, man.name AS manager_name,
    (SELECT group_concat(domain, '|') FROM (SELECT domain FROM student_domains d WHERE d.student_id = s.id ORDER BY d.rowid)) AS domains_raw,
    (SELECT COUNT(*) FROM attendance a WHERE a.student_id = s.id) AS att_total,
    (SELECT COUNT(*) FROM attendance a WHERE a.student_id = s.id AND a.status IN ('present','late')) AS att_present,
    (SELECT MAX(created_at) FROM activities ac WHERE ac.student_id = s.id) AS last_activity_at
  FROM students s
  LEFT JOIN users sup ON sup.id = s.supervisor_id
  LEFT JOIN users man ON man.id = s.manager_id`;

function shape(row) {
  if (!row) return row;
  const { domains_raw, ...rest } = row;
  return {
    ...rest,
    domains: domains_raw ? domains_raw.split('|') : [],
    attendance_rate: row.att_total ? Math.round((row.att_present / row.att_total) * 100) : null,
  };
}

module.exports = function studentRoutes(db) {
  const r = express.Router();
  r.use(requireAuth);

  function checkAssignees(data) {
    for (const [k, role] of [['supervisor_id', 'supervisor'], ['manager_id', 'project_manager']]) {
      if (data[k]) {
        const u = db.get('SELECT role, active FROM users WHERE id = ?', data[k]);
        if (!u || !u.active) throw badRequest('Utilisateur introuvable', { [k]: 'Introuvable' });
        if (u.role !== role && u.role !== 'admin') throw badRequest('Rôle incompatible', { [k]: `Doit être ${role === 'supervisor' ? 'un encadrant' : 'un project manager'}` });
      }
    }
  }

  function loadScoped(req, id) {
    const scope = studentScopeSql(req.user);
    const row = db.get(`${SELECT} WHERE s.id = ? AND ${scope.sql}`, id, ...scope.params);
    if (!row) throw notFound('Étudiant introuvable');
    return row;
  }

  function buildFilters(req) {
    const scope = studentScopeSql(req.user);
    const where = [scope.sql];
    const params = [...scope.params];
    const q = req.query;
    if (q.archived === '1') where.push('s.archived_at IS NOT NULL'); else where.push('s.archived_at IS NULL');
    if (q.q) {
      const like = `%${String(q.q).trim()}%`;
      where.push('(s.first_name LIKE ? OR s.last_name LIKE ? OR s.email LIKE ? OR s.whatsapp LIKE ? OR s.school LIKE ? OR (s.first_name || \' \' || s.last_name) LIKE ?)');
      params.push(like, like, like, like, like, like);
    }
    for (const k of ['stage', 'level', 'status', 'source', 'city']) if (q[k]) { where.push(`s.${k} = ?`); params.push(String(q[k])); }
    for (const k of ['supervisor_id', 'manager_id']) if (q[k]) {
      if (q[k] === 'none') where.push(`s.${k} IS NULL`); else { where.push(`s.${k} = ?`); params.push(parseId(q[k])); }
    }
    if (q.domain) { where.push('s.id IN (SELECT student_id FROM student_domains WHERE domain = ?)'); params.push(String(q.domain)); }
    if (q.subject_id) { where.push('s.id IN (SELECT student_id FROM student_subjects WHERE subject_id = ?)'); params.push(parseId(q.subject_id)); }
    return { where: where.join(' AND '), params };
  }

  const SORTS = {
    created_at: 's.created_at', updated_at: 's.updated_at', name: 's.last_name, s.first_name',
    stage: 's.stage', level: 's.level', last_activity: 'last_activity_at',
  };

  r.get('/', (req, res) => {
    const { where, params } = buildFilters(req);
    const sort = SORTS[req.query.sort] || SORTS.created_at;
    const dir = req.query.dir === 'asc' ? 'ASC' : 'DESC';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const size = Math.min(200, Math.max(1, parseInt(req.query.size, 10) || 25));
    const total = db.get(`SELECT COUNT(*) AS n FROM students s WHERE ${where}`, ...params).n;
    const rows = db.all(`${SELECT} WHERE ${where} ORDER BY ${sort} ${dir} LIMIT ? OFFSET ?`, ...params, size, (page - 1) * size);
    res.json({ students: rows.map(shape), total, page, size });
  });

  r.get('/export.csv', requireRole('admin', 'project_manager'), (req, res) => {
    const { where, params } = buildFilters(req);
    const rows = db.all(`${SELECT} WHERE ${where} ORDER BY s.last_name, s.first_name`, ...params).map(shape);
    const csv = toCsv([
      { label: 'ID', key: 'id' }, { label: 'Prénom', key: 'first_name' }, { label: 'Nom', key: 'last_name' },
      { label: 'Email', key: 'email' }, { label: 'WhatsApp', key: 'whatsapp' }, { label: 'Statut', key: 'status' },
      { label: 'Niveau', key: 'level' }, { label: 'Domaines', get: (r) => r.domains.join(' | ') },
      { label: 'Étape', get: (r) => STAGE_LABELS[r.stage] || r.stage }, { label: 'École', key: 'school' }, { label: 'Ville', key: 'city' },
      { label: 'Encadrant', key: 'supervisor_name' }, { label: 'Project manager', key: 'manager_name' },
      { label: 'Source', key: 'source' }, { label: 'Taux de présence (%)', key: 'attendance_rate' },
      { label: 'Créé le', key: 'created_at' },
    ], rows);
    audit(db, req, 'student.export', 'student', null, { count: rows.length });
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="etudiants-${now().slice(0, 10)}.csv"`);
    res.send(csv);
  });

  r.post('/import', requireRole('admin', 'project_manager'), (req, res) => {
    const text = typeof req.body?.csv === 'string' ? req.body.csv : '';
    if (!text.trim()) throw badRequest('CSV vide');
    if (text.length > 2_000_000) throw badRequest('Fichier trop volumineux (2 Mo max)');
    const rows = parseCsv(text);
    const ALIASES = {
      first_name: ['first_name', 'prénom', 'prenom', 'firstname'], last_name: ['last_name', 'nom', 'lastname', 'name'],
      email: ['email', 'e-mail', 'mail'], whatsapp: ['whatsapp', 'téléphone', 'telephone', 'phone', 'tel'],
      status: ['status', 'statut'], level: ['level', 'niveau'], school: ['school', 'école', 'ecole', 'établissement'],
      city: ['city', 'ville'], domains: ['domains', 'domaines', 'domaine', 'domain'], notes: ['notes', 'note'],
    };
    const pick = (row, key) => { for (const a of ALIASES[key]) if (row[a] != null && row[a] !== '') return row[a]; return undefined; };
    const result = { created: 0, skipped: 0, errors: [] };
    db.transaction(() => {
      rows.forEach((row, i) => {
        try {
          const body = {
            first_name: pick(row, 'first_name'), last_name: pick(row, 'last_name'), email: pick(row, 'email'),
            whatsapp: pick(row, 'whatsapp'), status: pick(row, 'status'), level: pick(row, 'level'),
            school: pick(row, 'school'), city: pick(row, 'city'), notes: pick(row, 'notes'),
            domains: (pick(row, 'domains') || '').split(/[|,;\/]| et /).map((d) => d.trim()).filter(Boolean),
            source: 'import',
          };
          Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
          const data = validate(body, STUDENT_SCHEMA);
          if (data.email && db.get('SELECT id FROM students WHERE email = ?', data.email)) { result.skipped++; return; }
          insertStudent(req, data);
          result.created++;
        } catch (e) {
          result.errors.push({ line: i + 2, error: e.message, details: e.details });
        }
      });
    });
    audit(db, req, 'student.import', 'student', null, result);
    res.json(result);
  });

  r.get('/:id', (req, res) => {
    const id = parseId(req.params.id);
    const student = shape(loadScoped(req, id));
    const subjects = db.all(`SELECT sub.id, sub.title, sub.domain, sub.status, u.name AS supervisor_name, ss.assigned_at
      FROM student_subjects ss JOIN subjects sub ON sub.id = ss.subject_id LEFT JOIN users u ON u.id = sub.supervisor_id
      WHERE ss.student_id = ? ORDER BY ss.assigned_at DESC`, id);
    const activities = db.all(`SELECT a.*, u.name AS user_name FROM activities a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.student_id = ? ORDER BY a.created_at DESC LIMIT 200`, id);
    const attendance = db.all(`SELECT a.status, a.note, a.marked_at, ls.id AS lab_session_id, ls.title, ls.scheduled_at, u.name AS marked_by_name
      FROM attendance a JOIN lab_sessions ls ON ls.id = a.lab_session_id LEFT JOIN users u ON u.id = a.marked_by
      WHERE a.student_id = ? ORDER BY ls.scheduled_at DESC LIMIT 200`, id);
    res.json({ student, subjects, activities, attendance });
  });

  function insertStudent(req, data) {
    const info = db.run(`INSERT INTO students (first_name, last_name, email, whatsapp, status, level, school, city, stage, source, supervisor_id, manager_id, notes, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      data.first_name, data.last_name, data.email || null, data.whatsapp || null, data.status || null, data.level || null,
      data.school || null, data.city || null, data.stage || 'lead', data.source || 'other',
      data.supervisor_id || null, data.manager_id || (req.user.role === 'project_manager' ? req.user.id : null), data.notes || null, req.user.id);
    const id = Number(info.lastInsertRowid);
    for (const d of data.domains || []) db.run('INSERT INTO student_domains (student_id, domain) VALUES (?,?)', id, d);
    db.run('INSERT INTO activities (student_id, user_id, type, content) VALUES (?,?,?,?)', id, req.user.id, 'system', 'Fiche créée');
    return id;
  }

  r.post('/', requireRole('admin', 'project_manager'), (req, res) => {
    const data = validate(req.body, STUDENT_SCHEMA);
    checkAssignees(data);
    if (data.email && db.get('SELECT id FROM students WHERE email = ?', data.email)) throw conflict('Un étudiant avec cet email existe déjà');
    const id = db.transaction(() => insertStudent(req, data));
    audit(db, req, 'student.create', 'student', id, { name: `${data.first_name} ${data.last_name}` });
    res.status(201).json({ student: shape(db.get(`${SELECT} WHERE s.id = ?`, id)) });
  });

  r.patch('/:id', (req, res) => {
    const id = parseId(req.params.id);
    const existing = loadScoped(req, id);
    let data = validate(req.body, STUDENT_SCHEMA, { partial: true });
    if (!canManage(req.user)) {
      const illegal = Object.keys(data).filter((k) => !SUPERVISOR_EDITABLE.includes(k));
      if (illegal.length) throw forbidden('Champs non modifiables par un encadrant : ' + illegal.join(', '));
    }
    checkAssignees(data);
    if (data.email && db.get('SELECT id FROM students WHERE email = ? AND id <> ?', data.email, id)) throw conflict('Email déjà utilisé par un autre étudiant');
    db.transaction(() => {
      const sets = [], params = [];
      for (const k of Object.keys(data)) {
        if (k === 'domains') continue;
        sets.push(`${k} = ?`); params.push(data[k] === undefined ? null : data[k]);
      }
      sets.push('updated_at = ?'); params.push(now());
      db.run(`UPDATE students SET ${sets.join(', ')} WHERE id = ?`, ...params, id);
      if (data.domains) {
        db.run('DELETE FROM student_domains WHERE student_id = ?', id);
        for (const d of data.domains) db.run('INSERT INTO student_domains (student_id, domain) VALUES (?,?)', id, d);
      }
      if (data.stage && data.stage !== existing.stage) {
        db.run('INSERT INTO activities (student_id, user_id, type, content) VALUES (?,?,?,?)', id, req.user.id, 'stage_change',
          `Étape : ${STAGE_LABELS[existing.stage] || existing.stage} → ${STAGE_LABELS[data.stage] || data.stage}`);
      }
    });
    audit(db, req, 'student.update', 'student', id, data);
    res.json({ student: shape(db.get(`${SELECT} WHERE s.id = ?`, id)) });
  });

  r.post('/:id/archive', requireRole('admin', 'project_manager'), (req, res) => {
    const id = parseId(req.params.id);
    const existing = db.get('SELECT id, archived_at FROM students WHERE id = ?', id);
    if (!existing) throw notFound('Étudiant introuvable');
    const restore = req.body?.restore === true;
    db.run('UPDATE students SET archived_at = ?, updated_at = ? WHERE id = ?', restore ? null : now(), now(), id);
    audit(db, req, restore ? 'student.restore' : 'student.archive', 'student', id);
    res.json({ ok: true });
  });

  r.delete('/:id', requireRole('admin'), (req, res) => {
    const id = parseId(req.params.id);
    const info = db.run('DELETE FROM students WHERE id = ?', id);
    if (!info.changes) throw notFound('Étudiant introuvable');
    audit(db, req, 'student.delete', 'student', id);
    res.json({ ok: true });
  });

  r.post('/:id/activities', (req, res) => {
    const id = parseId(req.params.id);
    loadScoped(req, id);
    const data = validate(req.body, {
      type: { type: 'string', required: true, enum: ACTIVITY_TYPES },
      content: { type: 'string', required: true, min: 1, max: 4000 },
    });
    const info = db.run('INSERT INTO activities (student_id, user_id, type, content) VALUES (?,?,?,?)', id, req.user.id, data.type, data.content);
    db.run('UPDATE students SET updated_at = ? WHERE id = ?', now(), id);
    const activity = db.get('SELECT a.*, u.name AS user_name FROM activities a LEFT JOIN users u ON u.id = a.user_id WHERE a.id = ?', Number(info.lastInsertRowid));
    res.status(201).json({ activity });
  });

  r.delete('/:id/activities/:aid', (req, res) => {
    const id = parseId(req.params.id), aid = parseId(req.params.aid);
    loadScoped(req, id);
    const a = db.get('SELECT * FROM activities WHERE id = ? AND student_id = ?', aid, id);
    if (!a) throw notFound();
    if (a.type === 'system' || a.type === 'stage_change') throw forbidden('Entrée système non supprimable');
    if (a.user_id !== req.user.id && req.user.role !== 'admin') throw forbidden();
    db.run('DELETE FROM activities WHERE id = ?', aid);
    res.json({ ok: true });
  });

  return r;
};
module.exports.normalizePhone = normalizePhone;
