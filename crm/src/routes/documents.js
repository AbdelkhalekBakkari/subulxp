'use strict';
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseId } = require('../validate');
const { requireAuth } = require('../auth');
const { badRequest, notFound, forbidden } = require('../errors');
const { DOCUMENT_TYPES } = require('../constants');
const { studentScopeSql, canManage } = require('../scope');
const { audit } = require('../audit');

const MAX_BYTES = 15 * 1024 * 1024;
/** Extensions autorisées → type MIME servi au téléchargement et signature attendue en début de fichier. */
const KINDS = {
  pdf: { mime: 'application/pdf', magic: [Buffer.from('%PDF')] },
  doc: { mime: 'application/msword', magic: [Buffer.from([0xD0, 0xCF, 0x11, 0xE0])] },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', magic: [Buffer.from('PK')] },
  png: { mime: 'image/png', magic: [Buffer.from([0x89, 0x50, 0x4E, 0x47])] },
  jpg: { mime: 'image/jpeg', magic: [Buffer.from([0xFF, 0xD8, 0xFF])] },
  jpeg: { mime: 'image/jpeg', magic: [Buffer.from([0xFF, 0xD8, 0xFF])] },
};

function safeLabel(name) {
  const base = path.basename(String(name || '')).replace(/[\u0000-\u001f\u007f"\\/]/g, '').trim();
  return base.slice(0, 120) || 'document';
}

module.exports = function documentRoutes(db, config) {
  const r = express.Router({ mergeParams: true });
  r.use(requireAuth);

  function loadStudent(req) {
    const id = parseId(req.params.id);
    const scope = studentScopeSql(req.user);
    const st = db.get(`SELECT id, first_name, last_name FROM students s WHERE s.id = ? AND ${scope.sql}`, id, ...scope.params);
    if (!st) throw notFound('Étudiant introuvable');
    return st;
  }
  const list = (studentId) => db.all(`SELECT d.id, d.type, d.label, d.mime, d.size, d.created_at, u.name AS uploaded_by_name
    FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by WHERE d.student_id = ? ORDER BY d.created_at DESC`, studentId);

  r.get('/', (req, res) => {
    const st = loadStudent(req);
    res.json({ documents: list(st.id), types: DOCUMENT_TYPES });
  });

  /** Dépôt : corps brut (le fichier), métadonnées en query : ?type=…&name=… */
  r.post('/', express.raw({ type: () => true, limit: MAX_BYTES }), (req, res) => {
    const st = loadStudent(req);
    const type = String(req.query.type || 'autre');
    if (!DOCUMENT_TYPES.includes(type)) throw badRequest('Type de document invalide', { type: 'Valeur non autorisée' });
    const label = safeLabel(req.query.name);
    const ext = path.extname(label).slice(1).toLowerCase();
    const kind = KINDS[ext];
    if (!kind) throw badRequest('Format non autorisé : PDF, Word (doc, docx) ou image (png, jpg) uniquement', { file: 'Format non autorisé' });
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!body.length) throw badRequest('Fichier vide', { file: 'Fichier vide' });
    if (!kind.magic.some((m) => body.subarray(0, m.length).equals(m))) throw badRequest('Le contenu ne correspond pas au format annoncé', { file: 'Contenu invalide' });

    const storedName = `${st.id}-${crypto.randomUUID()}.${ext}`;
    fs.mkdirSync(config.uploadDir, { recursive: true });
    fs.writeFileSync(path.join(config.uploadDir, storedName), body, { mode: 0o600 });
    const info = db.run('INSERT INTO documents (student_id, type, label, stored_name, mime, size, uploaded_by) VALUES (?,?,?,?,?,?,?)',
      st.id, type, label, storedName, kind.mime, body.length, req.user.id);
    const docId = Number(info.lastInsertRowid);
    db.run('INSERT INTO activities (student_id, user_id, type, content) VALUES (?,?,?,?)', st.id, req.user.id, 'system', `Document déposé : ${label}`);
    audit(db, req, 'document.upload', 'document', docId, { student_id: st.id, type, label, size: body.length });
    res.status(201).json({ document: db.get('SELECT d.id, d.type, d.label, d.mime, d.size, d.created_at FROM documents d WHERE d.id = ?', docId), documents: list(st.id) });
  });

  r.get('/:docId/download', (req, res) => {
    const st = loadStudent(req);
    const doc = db.get('SELECT * FROM documents WHERE id = ? AND student_id = ?', parseId(req.params.docId), st.id);
    if (!doc) throw notFound('Document introuvable');
    const file = path.join(config.uploadDir, path.basename(doc.stored_name));
    if (!fs.existsSync(file)) throw notFound('Fichier absent du stockage');
    audit(db, req, 'document.download', 'document', doc.id, { student_id: st.id });
    res.set('Content-Type', doc.mime);
    res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(doc.label)}`);
    res.set('Cache-Control', 'private, no-store');
    fs.createReadStream(file).pipe(res);
  });

  r.delete('/:docId', (req, res) => {
    const st = loadStudent(req);
    const doc = db.get('SELECT * FROM documents WHERE id = ? AND student_id = ?', parseId(req.params.docId), st.id);
    if (!doc) throw notFound('Document introuvable');
    if (!canManage(req.user) && doc.uploaded_by !== req.user.id) throw forbidden('Seul l\'auteur du dépôt, un project manager ou un admin peut supprimer ce document');
    db.run('DELETE FROM documents WHERE id = ?', doc.id);
    try { fs.unlinkSync(path.join(config.uploadDir, path.basename(doc.stored_name))); } catch { /* fichier déjà absent */ }
    db.run('INSERT INTO activities (student_id, user_id, type, content) VALUES (?,?,?,?)', st.id, req.user.id, 'system', `Document supprimé : ${doc.label}`);
    audit(db, req, 'document.delete', 'document', doc.id, { student_id: st.id, label: doc.label });
    res.json({ ok: true, documents: list(st.id) });
  });

  return r;
};
