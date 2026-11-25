'use strict';
const express = require('express');
const { validate, parseId } = require('../validate');
const { requireAuth, requireRole } = require('../auth');
const { badRequest, notFound, forbidden, conflict } = require('../errors');
const { DOMAINS, SUBJECT_STATUSES } = require('../constants');
const { subjectScopeSql, studentScopeSql, canManage } = require('../scope');
const { audit } = require('../audit');
const { now } = require('../db');

const SCHEMA = {
  title: { type: 'string', required: true, min: 3, max: 200 },
  description: { type: 'string', max: 5000 },
  domain: { type: 'string', required: true, enum: DOMAINS },
  supervisor_id: { type: 'int', min: 1 },
  manager_id: { type: 'int', min: 1 },
  status: { type: 'string', enum: SUBJECT_STATUSES },
  capacity: { type: 'int', min: 0, max: 500 },
  start_date: { type: 'date' },
  end_date: { type: 'date' },
};

const SELECT = `SELECT sub.*, sup.name AS supervisor_name, man.name AS manager_name,
    (SELECT COUNT(*) FROM student_subjects ss WHERE ss.subject_id = sub.id) AS students_count,
    (SELECT COUNT(*) FROM lab_sessions ls WHERE ls.subject_id = sub.id) AS sessions_count
  FROM subjects sub LEFT JOIN users sup ON sup.id = sub.supervisor_id LEFT JOIN users man ON man.id = sub.manager_id`;

module.exports = function subjectRoutes(db) {
  const r = express.Router();
  r.use(requireAuth);

  function load(req, id) {
    const scope = subjectScopeSql(req.user);
    const row = db.get(`${SELECT} WHERE sub.id = ? AND ${scope.sql}`, id, ...scope.params);
    if (!row) throw notFound('Sujet introuvable');
    return row;
  }
  function checkAssignees(data) {
    if (data.supervisor_id) {
      const u = db.get('SELECT role, active FROM users WHERE id = ?', data.supervisor_id);
      if (!u || !u.active || !['supervisor', 'admin'].includes(u.role)) throw badRequest('Encadrant invalide', { supervisor_id: 'Doit être un encadrant actif' });
    }
    if (data.manager_id) {
      const u = db.get('SELECT role, active FROM users WHERE id = ?', data.manager_id);
      if (!u || !u.active || !['project_manager', 'admin'].includes(u.role)) throw badRequest('Project manager invalide', { manager_id: 'Doit être un project manager actif' });
    }
    if (data.start_date && data.end_date && data.end_date < data.start_date) throw badRequest('Dates incohérentes', { end_date: 'Doit être après la date de début' });
  }

  r.get('/', (req, res) => {
    const scope = subjectScopeSql(req.user);
    const where = [scope.sql]; const params = [...scope.params];
    if (req.query.q) { where.push('(sub.title LIKE ? OR sub.description LIKE ?)'); params.push(`%${req.query.q}%`, `%${req.query.q}%`); }
    if (req.query.domain) { where.push('sub.domain = ?'); params.push(String(req.query.domain)); }
    if (req.query.status) { where.push('sub.status = ?'); params.push(String(req.query.status)); }
    if (req.query.supervisor_id) { where.push('sub.supervisor_id = ?'); params.push(parseId(req.query.supervisor_id)); }
    res.json({ subjects: db.all(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY sub.updated_at DESC`, ...params) });
  });

  r.get('/:id', (req, res) => {
    const id = parseId(req.params.id);
    const subject = load(req, id);
    const students = db.all(`SELECT s.id, s.first_name, s.last_name, s.email, s.whatsapp, s.level, s.stage, ss.assigned_at
      FROM student_subjects ss JOIN students s ON s.id = ss.student_id WHERE ss.subject_id = ? ORDER BY s.last_name`, id);
    const sessions = db.all(`SELECT ls.*, (SELECT COUNT(*) FROM attendance a WHERE a.lab_session_id = ls.id AND a.status IN ('present','late')) AS present_count,
      (SELECT COUNT(*) FROM attendance a WHERE a.lab_session_id = ls.id) AS marked_count
      FROM lab_sessions ls WHERE ls.subject_id = ? ORDER BY ls.scheduled_at DESC`, id);
    res.json({ subject, students, sessions });
  });

  r.post('/', (req, res) => {
    const data = validate(req.body, SCHEMA);
    if (!canManage(req.user)) data.supervisor_id = req.user.id; // an encadrant can only create their own subjects
    checkAssignees(data);
    const info = db.run(`INSERT INTO subjects (title, description, domain, supervisor_id, manager_id, status, capacity, start_date, end_date, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?)`, data.title, data.description || null, data.domain, data.supervisor_id || null,
      data.manager_id || (req.user.role === 'project_manager' ? req.user.id : null), data.status || 'open', data.capacity ?? 1,
      data.start_date || null, data.end_date || null, req.user.id);
    const id = Number(info.lastInsertRowid);
    audit(db, req, 'subject.create', 'subject', id, { title: data.title });
    res.status(201).json({ subject: db.get(`${SELECT} WHERE sub.id = ?`, id) });
  });

  r.patch('/:id', (req, res) => {
    const id = parseId(req.params.id);
    load(req, id);
    const data = validate(req.body, SCHEMA, { partial: true });
    if (!canManage(req.user) && ('supervisor_id' in data || 'manager_id' in data)) throw forbidden("Un encadrant ne peut pas réaffecter un sujet");
    checkAssignees(data);
    const sets = [], params = [];
    for (const k of Object.keys(data)) { sets.push(`${k} = ?`); params.push(data[k]); }
    sets.push('updated_at = ?'); params.push(now());
    db.run(`UPDATE subjects SET ${sets.join(', ')} WHERE id = ?`, ...params, id);
    audit(db, req, 'subject.update', 'subject', id, data);
    res.json({ subject: db.get(`${SELECT} WHERE sub.id = ?`, id) });
  });

  r.delete('/:id', requireRole('admin', 'project_manager'), (req, res) => {
    const id = parseId(req.params.id);
    const info = db.run('DELETE FROM subjects WHERE id = ?', id);
    if (!info.changes) throw notFound('Sujet introuvable');
    audit(db, req, 'subject.delete', 'subject', id);
    res.json({ ok: true });
  });

  r.post('/:id/students', (req, res) => {
    const id = parseId(req.params.id);
    const subject = load(req, id);
    const { student_id } = validate(req.body, { student_id: { type: 'int', required: true, min: 1 } });
    const scope = studentScopeSql(req.user);
    const st = canManage(req.user)
      ? db.get('SELECT id FROM students s WHERE s.id = ? AND s.archived_at IS NULL', student_id)
      : db.get(`SELECT id FROM students s WHERE s.id = ? AND s.archived_at IS NULL AND ${scope.sql}`, student_id, ...scope.params);
    if (!st) throw notFound('Étudiant introuvable');
    if (db.get('SELECT 1 FROM student_subjects WHERE student_id = ? AND subject_id = ?', student_id, id)) throw conflict('Déjà inscrit à ce sujet');
    if (subject.capacity > 0 && subject.students_count >= subject.capacity) throw conflict('Capacité du sujet atteinte');
    db.run('INSERT INTO student_subjects (student_id, subject_id, assigned_by) VALUES (?,?,?)', student_id, id, req.user.id);
    db.run('INSERT INTO activities (student_id, user_id, type, content) VALUES (?,?,?,?)', student_id, req.user.id, 'system', `Affecté au sujet « ${subject.title} »`);
    audit(db, req, 'subject.enroll', 'subject', id, { student_id });
    res.status(201).json({ ok: true });
  });

  r.delete('/:id/students/:sid', (req, res) => {
    const id = parseId(req.params.id), sid = parseId(req.params.sid);
    const subject = load(req, id);
    const info = db.run('DELETE FROM student_subjects WHERE student_id = ? AND subject_id = ?', sid, id);
    if (!info.changes) throw notFound();
    db.run('INSERT INTO activities (student_id, user_id, type, content) VALUES (?,?,?,?)', sid, req.user.id, 'system', `Retiré du sujet « ${subject.title} »`);
    audit(db, req, 'subject.unenroll', 'subject', id, { student_id: sid });
    res.json({ ok: true });
  });

  return r;
};
