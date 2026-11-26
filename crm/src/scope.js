'use strict';
/**
 * Data scoping per role.
 *  - admin / project_manager: everything.
 *  - supervisor: only students assigned to them or enrolled in one of their subjects,
 *    only their own subjects and sessions.
 */
function studentScopeSql(user, alias = 's') {
  if (user.role !== 'supervisor') return { sql: '1=1', params: [] };
  return {
    sql: `(${alias}.supervisor_id = ? OR ${alias}.id IN (
            SELECT ss.student_id FROM student_subjects ss JOIN subjects sub ON sub.id = ss.subject_id
            WHERE sub.supervisor_id = ?))`,
    params: [user.id, user.id],
  };
}
function subjectScopeSql(user, alias = 'sub') {
  if (user.role !== 'supervisor') return { sql: '1=1', params: [] };
  return { sql: `${alias}.supervisor_id = ?`, params: [user.id] };
}
function sessionScopeSql(user, alias = 'ls') {
  if (user.role !== 'supervisor') return { sql: '1=1', params: [] };
  return { sql: `${alias}.supervisor_id = ?`, params: [user.id] };
}
const canManage = (user) => user.role === 'admin' || user.role === 'project_manager';

module.exports = { studentScopeSql, subjectScopeSql, sessionScopeSql, canManage };
