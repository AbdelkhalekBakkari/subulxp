'use strict';
const express = require('express');
const { requireAuth } = require('../auth');
const C = require('../constants');
module.exports = function metaRoutes() {
  const r = express.Router();
  r.get('/', requireAuth, (req, res) => {
    res.json({
      roles: C.ROLES, role_labels: C.ROLE_LABELS, domains: C.DOMAINS, levels: C.LEVELS, student_statuses: C.STUDENT_STATUSES,
      stages: C.STAGES, stage_labels: C.STAGE_LABELS, subject_statuses: C.SUBJECT_STATUSES, session_statuses: C.SESSION_STATUSES,
      session_modes: C.SESSION_MODES, attendance_statuses: C.ATTENDANCE_STATUSES, activity_types: C.ACTIVITY_TYPES, sources: C.SOURCES,
      document_types: C.DOCUMENT_TYPES, document_labels: C.DOCUMENT_LABELS,
    });
  });
  return r;
};
