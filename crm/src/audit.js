'use strict';
function audit(db, req, action, entity, entityId, details) {
  db.run('INSERT INTO audit_log (user_id, action, entity, entity_id, details, ip) VALUES (?,?,?,?,?,?)',
    req.user ? req.user.id : null, action, entity || null, entityId || null,
    details == null ? null : JSON.stringify(details).slice(0, 4000), req.ip || null);
}
module.exports = { audit };
