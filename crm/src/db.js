'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

const JOURNAL_MODES = ['WAL', 'DELETE', 'TRUNCATE', 'PERSIST'];

/**
 * @param {string} dbPath chemin du fichier (ou ':memory:')
 * @param {{journalMode?: string}} [opts] journalMode: WAL (défaut, disque local) ou DELETE
 *        pour un partage réseau (Azure Files, NFS, SMB) où WAL n'est pas fiable.
 */
function openDatabase(dbPath, opts = {}) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  const journal = String(opts.journalMode || 'WAL').toUpperCase();
  db.exec(`PRAGMA journal_mode = ${JOURNAL_MODES.includes(journal) ? journal : 'WAL'};`);
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  return wrap(db);
}

/** Small helper layer: parameterized queries only, never string interpolation of values. */
function wrap(db) {
  const cache = new Map();
  const stmt = (sql) => {
    let s = cache.get(sql);
    if (!s) { s = db.prepare(sql); cache.set(sql, s); }
    return s;
  };
  return {
    raw: db,
    get: (sql, ...params) => stmt(sql).get(...params),
    all: (sql, ...params) => stmt(sql).all(...params),
    run: (sql, ...params) => stmt(sql).run(...params),
    exec: (sql) => db.exec(sql),
    transaction(fn) {
      db.exec('BEGIN');
      try { const r = fn(); db.exec('COMMIT'); return r; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    close: () => db.close(),
  };
}

const now = () => new Date().toISOString();

module.exports = { openDatabase, now };
