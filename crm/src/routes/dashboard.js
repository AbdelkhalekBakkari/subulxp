'use strict';
const express = require('express');
const { requireAuth } = require('../auth');
const { studentScopeSql, sessionScopeSql } = require('../scope');
const { STAGES, DOMAINS } = require('../constants');

module.exports = function dashboardRoutes(db) {
  const r = express.Router();
  r.use(requireAuth);

  r.get('/', (req, res) => {
    const ss = studentScopeSql(req.user);
    const ls = sessionScopeSql(req.user);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const d30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const nowIso = new Date().toISOString();
    const base = `FROM students s WHERE s.archived_at IS NULL AND ${ss.sql}`;

    const byStage = Object.fromEntries(STAGES.map((st) => [st, 0]));
    for (const row of db.all(`SELECT s.stage, COUNT(*) AS n ${base} GROUP BY s.stage`, ...ss.params)) byStage[row.stage] = row.n;
    const byDomain = Object.fromEntries(DOMAINS.map((d) => [d, 0]));
    for (const row of db.all(`SELECT d.domain, COUNT(*) AS n FROM student_domains d JOIN students s ON s.id = d.student_id WHERE s.archived_at IS NULL AND ${ss.sql} GROUP BY d.domain`, ...ss.params)) byDomain[row.domain] = row.n;
    const byLevel = {};
    for (const row of db.all(`SELECT COALESCE(s.level, 'Non renseigné') AS level, COUNT(*) AS n ${base} GROUP BY s.level`, ...ss.params)) byLevel[row.level] = row.n;

    const att = db.get(`SELECT COUNT(*) AS total, SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent
      FROM attendance a JOIN lab_sessions ls ON ls.id = a.lab_session_id JOIN students s ON s.id = a.student_id
      WHERE ls.scheduled_at >= ? AND ${ss.sql}`, d30, ...ss.params);

    const upcoming = db.all(`SELECT ls.id, ls.title, ls.scheduled_at, ls.mode, ls.location, ls.status, u.name AS supervisor_name, sub.title AS subject_title
      FROM lab_sessions ls LEFT JOIN users u ON u.id = ls.supervisor_id LEFT JOIN subjects sub ON sub.id = ls.subject_id
      WHERE ls.scheduled_at >= ? AND ls.status = 'planned' AND ${ls.sql} ORDER BY ls.scheduled_at ASC LIMIT 8`, nowIso, ...ls.params);

    const recent = db.all(`SELECT a.id, a.type, a.content, a.created_at, u.name AS user_name, s.id AS student_id, s.first_name, s.last_name
      FROM activities a JOIN students s ON s.id = a.student_id LEFT JOIN users u ON u.id = a.user_id
      WHERE s.archived_at IS NULL AND ${ss.sql} ORDER BY a.created_at DESC LIMIT 12`, ...ss.params);

    const atRisk = db.all(`SELECT s.id, s.first_name, s.last_name, s.stage,
        COUNT(a.id) AS total, SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent
      FROM students s JOIN attendance a ON a.student_id = s.id
      WHERE s.archived_at IS NULL AND s.stage = 'active' AND ${ss.sql}
      GROUP BY s.id HAVING total >= 2 AND absent * 1.0 / total >= 0.4 ORDER BY absent DESC LIMIT 8`, ...ss.params);

    // Nouveaux étudiants par semaine (8 dernières semaines, semaine ISO commençant le lundi)
    const weekly = [];
    const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    for (let i = 7; i >= 0; i--) {
      const start = new Date(monday); start.setDate(start.getDate() - i * 7);
      const end = new Date(start); end.setDate(end.getDate() + 7);
      const n = db.get(`SELECT COUNT(*) AS n ${base} AND s.created_at >= ? AND s.created_at < ?`, ...ss.params, start.toISOString(), end.toISOString()).n;
      weekly.push({ week_start: start.toISOString().slice(0, 10), count: n });
    }
    const sessionsWeek = db.get(`SELECT COUNT(*) AS n FROM lab_sessions ls WHERE ls.scheduled_at >= ? AND ls.scheduled_at < ? AND ${ls.sql}`,
      monday.toISOString(), new Date(monday.getTime() + 7 * 86400000).toISOString(), ...ls.params).n;

    const newLeadsMonth = db.get(`SELECT COUNT(*) AS n ${base} AND s.created_at >= ?`, ...ss.params, monthStart.toISOString()).n;
    const unassigned = db.get(`SELECT COUNT(*) AS n ${base} AND s.supervisor_id IS NULL AND s.stage IN ('lead','contacted','lab_scheduled','active')`, ...ss.params).n;
    const total = db.get(`SELECT COUNT(*) AS n ${base}`, ...ss.params).n;
    const subjectsOpen = db.get(`SELECT COUNT(*) AS n FROM subjects sub WHERE sub.status IN ('open','in_progress') AND ${req.user.role === 'supervisor' ? 'sub.supervisor_id = ?' : '1=1'}`, ...(req.user.role === 'supervisor' ? [req.user.id] : [])).n;

    res.json({
      kpis: {
        students_total: total, students_active: byStage.active, new_leads_month: newLeadsMonth, unassigned,
        attendance_rate_30d: att.total ? Math.round((att.present / att.total) * 100) : null,
        absences_30d: att.absent || 0, subjects_open: subjectsOpen, upcoming_sessions: upcoming.length,
      },
      by_stage: byStage, by_domain: byDomain, by_level: byLevel, upcoming, recent, at_risk: atRisk,
      weekly_new: weekly, sessions_this_week: sessionsWeek,
    });
  });

  return r;
};
