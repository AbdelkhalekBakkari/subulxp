'use strict';
const express = require('express');
const crypto = require('node:crypto');
const { requireRole } = require('../auth');
const { audit } = require('../audit');

function getIntakeKey(db) {
  let row = db.get('SELECT value FROM settings WHERE key = ?', 'intake_key');
  if (!row) {
    const value = crypto.randomBytes(24).toString('base64url');
    db.run('INSERT INTO settings (key, value) VALUES (?,?)', 'intake_key', value);
    row = { value };
  }
  return row.value;
}

module.exports = function settingsRoutes(db, config) {
  const r = express.Router();
  r.get('/', requireRole('admin'), (req, res) => {
    res.json({ intake_key: getIntakeKey(db), intake_allowed_origins: config.intakeAllowedOrigins, landing_url: 'https://xp.subul.uk/' });
  });
  r.post('/intake-key/rotate', requireRole('admin'), (req, res) => {
    const value = crypto.randomBytes(24).toString('base64url');
    db.run('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'intake_key', value);
    audit(db, req, 'settings.intake_key_rotated', 'settings');
    res.json({ intake_key: value });
  });
  return r;
};
module.exports.getIntakeKey = getIntakeKey;
