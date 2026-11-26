'use strict';
const express = require('express');
const { validate, parseId } = require('../validate');
const { requireAuth, requireRole } = require('../auth');
const { badRequest, notFound, forbidden } = require('../errors');
const { DOMAINS, SESSION_STATUSES, SESSION_MODES, ATTENDANCE_STATUSES } = require('../constants');
const { sessionScopeSql, studentScopeSql, canManage } = require('../scope');
const { audit } = require('../audit');
const { now } = require('../db');

const SCHEMA = {
  title: { type: 'string', required: true, min: 3, max: 200 },
  subject_id: { type: 'int', min: 1 },
  domain: { type: 'string', enum: DOMAINS },
  supervisor_id: { type: 'int', min: 1 },
  scheduled_at: { type: 'datetime', required: true },
  duration_min: { type: 'int', min: 15, max: 1440 },
  mode: { type: 'string', enum: SESSION_MODES },
  location: { type: 'string', max: 200 },
  status: { type: 'string', enum: SESSION_STATUSES },
  notes: { type: 'string', max: 5000 },
};

const SELECT = `SELECT ls.*, u.name AS supervisor_name, sub.title AS subject_title,
    (SELECT COUNT(*) FROM attendance a WHERE a.lab_session_id = ls.id) AS marked_count,
    (SELECT COUNT(*) FROM attendance a WHERE a.lab_session_id = ls.id AND a.status IN ('present','late')) AS present_count,
    (SELECT COUNT(*) FROM attendance a WHERE a.lab_session_id = ls.id AND a.status = 'absent') AS absent_count
  FROM lab_sessions ls LEFT JOIN users u ON u.id = ls.supervisor_id LEFT JOIN subjects sub ON sub.id = ls.subject_id`;

module.exports = function sessionRoutes(db) {
  const r = express.Router();
  r.use(requireAuth);

  function load(req, id) {
    const scope = sessionScopeSql(req.user);
    const row = db.get(`${SELECT} WHERE ls.id = ? AND ${scope.sql}`, id, ...scope.params);
    if (!row) throw notFound('Séance introuvable');
    return row;
  }
  function checkRefs(req, data) {
    if (data.subject_id) {
      const sub = db.get('SELECT id, supervisor_id, domain FROM subjects WHERE id = ?', data.subject_id);
      if (!sub) throw badRequest('Sujet introuvable', { subject_id: 'Introuvable' });
      if (!canManage(req.user) && sub.supervisor_id !== req.user.id) throw forbidden('Ce sujet ne vous est pas affecté');
      if (!data.domain) data.domain = sub.domain;
    }
    if (data.supervisor_id) {
      const u = db.get('SELECT role, active FROM users WHERE id = ?', data.supervisor_id);
      if (!u || !u.active || !['supervisor', 'admin'].includes(u.role)) throw badRequest('Encadrant invalide', { supervisor_id: 'Doit être un encadrant actif' });
    }
  }

  r.get('/', (req, res) => {
    const scope = sessionScopeSql(req.user);
    const where = [scope.sql]; const params = [...scope.params];
    if (req.query.from) { where.push('ls.scheduled_at >= ?'); params.push(new Date(req.query.from).toISOString()); }
    if (req.query.to) { where.push('ls.scheduled_at <= ?'); params.push(new Date(req.query.to).toISOString()); }
    if (req.query.status) { where.push('ls.status = ?'); params.push(String(req.query.status)); }
    if (req.query.subject_id) { where.push('ls.subject_id = ?'); params.push(parseId(req.query.subject_id)); }
    if (req.query.supervisor_id) { where.push('ls.supervisor_id = ?'); params.push(parseId(req.query.supervisor_id)); }
    const dir = req.query.dir === 'asc' ? 'ASC' : 'DESC';
    res.json({ sessions: db.all(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY ls.scheduled_at ${dir} LIMIT 500`, ...params) });
  });

  r.get('/:id', (req, res) => {
    const id = parseId(req.params.id);
    const session = load(req, id);
    res.json({ session, attendance: attendanceSheet(session) });
  });

  /** Roster = students enrolled in the subject ∪ students already marked. */
  function attendanceSheet(session) {
    return db.all(`SELECT s.id AS student_id, s.first_name, s.last_name, s.level, s.whatsapp, s.email, a.status, a.note, a.marked_at
      FROM students s
      LEFT JOIN attendance a ON a.student_id = s.id AND a.lab_session_id = ?
      WHERE s.archived_at IS NULL AND (a.id IS NOT NULL OR (? IS NOT NULL AND s.id IN (SELECT student_id FROM student_subjects WHERE subject_id = ?)))
      ORDER BY s.last_name, s.first_name`, session.id, session.subject_id, session.subject_id);
  }

  r.post('/', (req, res) => {
    const data = validate(req.body, SCHEMA);
    if (!canManage(req.user)) data.supervisor_id = req.user.id;
    checkRefs(req, data);
    const info = db.run(`INSERT INTO lab_sessions (title, subject_id, domain, supervisor_id, scheduled_at, duration_min, mode, location, status, notes, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`, data.title, data.subject_id || null, data.domain || null, data.supervisor_id || null, data.scheduled_at,
      data.duration_min || 120, data.mode || 'onsite', data.location || null, data.status || 'planned', data.notes || null, req.user.id);
    const id = Number(info.lastInsertRowid);
    audit(db, req, 'session.create', 'lab_session', id, { title: data.title });
    res.status(201).json({ session: db.get(`${SELECT} WHERE ls.id = ?`, id) });
  });

  r.patch('/:id', (req, res) => {
    const id = parseId(req.params.id);
    load(req, id);
    const data = validate(req.body, SCHEMA, { partial: true });
    if (!canManage(req.user) && 'supervisor_id' in data) throw forbidden('Un encadrant ne peut pas réaffecter une séance');
    checkRefs(req, data);
    const sets = [], params = [];
    for (const k of Object.keys(data)) { sets.push(`${k} = ?`); params.push(data[k]); }
    sets.push('updated_at = ?'); params.push(now());
    db.run(`UPDATE lab_sessions SET ${sets.join(', ')} WHERE id = ?`, ...params, id);
    audit(db, req, 'session.update', 'lab_session', id, data);
    res.json({ session: db.get(`${SELECT} WHERE ls.id = ?`, id) });
  });

  r.delete('/:id', requireRole('admin', 'project_manager'), (req, res) => {
    const id = parseId(req.params.id);
    const info = db.run('DELETE FROM lab_sessions WHERE id = ?', id);
    if (!info.changes) throw notFound('Séance introuvable');
    audit(db, req, 'session.delete', 'lab_session', id);
    res.json({ ok: true });
  });

  /** Bulk attendance: [{student_id, status, note}] — upsert. Supervisors only for their own sessions & students. */
  r.put('/:id/attendance', (req, res) => {
    const id = parseId(req.params.id);
    const session = load(req, id);
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : null;
    if (!entries) throw badRequest('entries doit être une liste');
    if (entries.length > 500) throw badRequest('Trop d\'entrées');
    const scope = studentScopeSql(req.user);
    const cleaned = entries.map((e, i) => {
      const d = validate(e, {
        student_id: { type: 'int', required: true, min: 1 },
        status: { type: 'string', required: true, enum: ATTENDANCE_STATUSES },
        note: { type: 'string', max: 500 },
      });
      const st = db.get(`SELECT id FROM students s WHERE s.id = ? AND s.archived_at IS NULL AND ${scope.sql}`, d.student_id, ...scope.params);
      if (!st) throw badRequest(`Étudiant ${d.student_id} introuvable ou hors de votre périmètre`, { [`entries[${i}]`]: 'Étudiant invalide' });
      return d;
    });
    db.transaction(() => {
      for (const e of cleaned) {
        db.run(`INSERT INTO attendance (lab_session_id, student_id, status, note, marked_by, marked_at) VALUES (?,?,?,?,?,?)
          ON CONFLICT(lab_session_id, student_id) DO UPDATE SET status = excluded.status, note = excluded.note, marked_by = excluded.marked_by, marked_at = excluded.marked_at`,
          id, e.student_id, e.status, e.note || null, req.user.id, now());
      }
      if (session.status === 'planned' && new Date(session.scheduled_at) <= new Date()) {
        db.run('UPDATE lab_sessions SET status = ?, updated_at = ? WHERE id = ?', 'done', now(), id);
      }
    });
    audit(db, req, 'attendance.mark', 'lab_session', id, { count: cleaned.length });
    res.json({ attendance: attendanceSheet(session) });
  });

  r.delete('/:id/attendance/:sid', (req, res) => {
    const id = parseId(req.params.id), sid = parseId(req.params.sid);
    load(req, id);
    const info = db.run('DELETE FROM attendance WHERE lab_session_id = ? AND student_id = ?', id, sid);
    if (!info.changes) throw notFound();
    audit(db, req, 'attendance.remove', 'lab_session', id, { student_id: sid });
    res.json({ ok: true });
  });

  return r;
};
