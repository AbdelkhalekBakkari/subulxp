'use strict';
const express = require('express');
const { requireRole } = require('../auth');

module.exports = function auditRoutes(db) {
  const r = express.Router();
  r.get('/', requireRole('admin'), (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const size = 50;
    const where = []; const params = [];
    if (req.query.user_id) { where.push('a.user_id = ?'); params.push(Number(req.query.user_id)); }
    if (req.query.action) { where.push('a.action LIKE ?'); params.push(`${req.query.action}%`); }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const total = db.get(`SELECT COUNT(*) AS n FROM audit_log a ${w}`, ...params).n;
    const entries = db.all(`SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ${w} ORDER BY a.id DESC LIMIT ? OFFSET ?`, ...params, size, (page - 1) * size);
    res.json({ entries, total, page, size });
  });
  return r;
};
