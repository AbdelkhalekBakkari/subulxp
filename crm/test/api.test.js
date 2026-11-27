'use strict';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');

describe('Subul XP CRM API', () => {
  let ctx, admin, pm, sup1, sup2;
  before(async () => {
    ctx = await startApp();
    admin = await ctx.as('admin'); pm = await ctx.as('pm'); sup1 = await ctx.as('sup1'); sup2 = await ctx.as('sup2');
  });
  after(async () => { await ctx.stop(); });

  test('index is never cached and references versioned assets', async () => {
    const res = await fetch(ctx.base + '/');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-cache');
    const html = await res.text();
    assert.match(html, /src="\/app\.js\?v=[0-9a-f]{10}"/);
    assert.match(html, /href="\/styles\.css\?v=[0-9a-f]{10}"/);
    const deep = await fetch(ctx.base + '/students/42');
    assert.equal(deep.status, 200); assert.equal(deep.headers.get('cache-control'), 'no-cache');
    const js = await fetch(ctx.base + '/app.js?v=abc');
    assert.match(js.headers.get('cache-control'), /max-age=604800/);
  });

  test('rejects unauthenticated access and wrong credentials', async () => {
    const anon = ctx.client();
    assert.equal((await anon.get('/api/students')).status, 401);
    const bad = await anon.post('/api/auth/login', { email: 'admin@test.local', password: 'nope' });
    assert.equal(bad.status, 401);
    const noHeader = await fetch(ctx.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(noHeader.status, 403, 'CSRF header required on mutations');
  });

  test('login sets an HttpOnly SameSite cookie and /me returns the user without secrets', async () => {
    const c = ctx.client();
    const r = await c.login('admin@test.local');
    assert.equal(r.body.user.role, 'admin');
    assert.equal(r.body.user.password_hash, undefined);
    const sc = r.headers.get('set-cookie');
    assert.match(sc, /HttpOnly/); assert.match(sc, /SameSite=Strict/);
    const me = await c.get('/api/auth/me');
    assert.equal(me.body.user.email, 'admin@test.local');
    await c.post('/api/auth/logout');
    assert.equal((await c.get('/api/auth/me')).status, 401);
  });

  test('user management is admin only, with safety rails', async () => {
    assert.equal((await pm.get('/api/users')).status, 403);
    assert.equal((await sup1.post('/api/users', { name: 'X', email: 'x@test.local', role: 'admin' })).status, 403);
    const created = await admin.post('/api/users', { name: 'Nouvel Encadrant', email: 'new@test.local', role: 'supervisor', whatsapp: '+216 22 333 444' });
    assert.equal(created.status, 201);
    assert.ok(created.body.generated_password, 'generates a password when none is given');
    assert.equal(created.body.user.whatsapp, '+21622333444');
    const weak = await admin.post('/api/users', { name: 'Weak', email: 'weak@test.local', role: 'supervisor', password: 'short' });
    assert.equal(weak.status, 400);
    const self = await admin.patch(`/api/users/${ctx.ids.admin}`, { active: false });
    assert.equal(self.status, 400);
    const dir = await sup1.get('/api/users/directory');
    assert.equal(dir.status, 200);
    assert.ok(!('email' in dir.body.users[0]), 'directory exposes minimal fields');
  });

  let studentA, studentB, subjectSup1;
  test('project manager creates students; validation and uniqueness enforced', async () => {
    const r = await pm.post('/api/students', { first_name: 'Sara', last_name: 'Amri', email: 'Sara.Amri@Exemple.com', whatsapp: '+216 20 123 456', level: 'Débutant', domains: ['DevOps', 'Cloud'], supervisor_id: ctx.ids.sup1, stage: 'contacted' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    studentA = r.body.student;
    assert.equal(studentA.email, 'sara.amri@exemple.com');
    assert.deepEqual(studentA.domains, ['DevOps', 'Cloud']);
    assert.equal(studentA.manager_id, ctx.ids.pm, 'PM is auto-assigned as manager');
    const dup = await pm.post('/api/students', { first_name: 'S', last_name: 'A', email: 'sara.amri@exemple.com' });
    assert.equal(dup.status, 409);
    const invalid = await pm.post('/api/students', { first_name: 'X', last_name: 'Y', level: 'Expert', domains: ['Blockchain'], whatsapp: '12' });
    assert.equal(invalid.status, 400);
    assert.ok(invalid.body.details.level && invalid.body.details.domains && invalid.body.details.whatsapp);
    const wrongRole = await pm.post('/api/students', { first_name: 'X', last_name: 'Y', supervisor_id: ctx.ids.pm });
    assert.equal(wrongRole.status, 400);
    const b = await pm.post('/api/students', { first_name: 'Amine', last_name: 'Ben Salah', email: 'amine@exemple.com', level: 'Avancé', domains: ['AI & Agents'] });
    studentB = b.body.student;
    assert.equal((await sup1.post('/api/students', { first_name: 'No', last_name: 'Way' })).status, 403, 'supervisors cannot create students');
  });

  test('supervisor scoping: sees own students only, limited edits', async () => {
    const list1 = await sup1.get('/api/students');
    assert.deepEqual(list1.body.students.map((s) => s.id), [studentA.id]);
    const list2 = await sup2.get('/api/students');
    assert.equal(list2.body.total, 0);
    assert.equal((await sup2.get(`/api/students/${studentA.id}`)).status, 404, 'no IDOR: out-of-scope student is invisible');
    const ok = await sup1.patch(`/api/students/${studentA.id}`, { level: 'Intermédiaire', stage: 'active' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.student.level, 'Intermédiaire');
    const forbidden = await sup1.patch(`/api/students/${studentA.id}`, { supervisor_id: ctx.ids.sup2 });
    assert.equal(forbidden.status, 403);
    const detail = await sup1.get(`/api/students/${studentA.id}`);
    assert.ok(detail.body.activities.some((a) => a.type === 'stage_change'), 'stage change is logged in the timeline');
    const act = await sup1.post(`/api/students/${studentA.id}/activities`, { type: 'whatsapp', content: 'Relance WhatsApp' });
    assert.equal(act.status, 201);
    assert.equal((await pm.get('/api/students')).body.total, 2, 'PM sees everyone');
  });

  test('subjects: supervisors own theirs, enrollment extends student scope, capacity enforced', async () => {
    const r = await sup1.post('/api/subjects', { title: 'Pipeline GitOps', domain: 'DevOps', capacity: 1, supervisor_id: ctx.ids.sup2 });
    assert.equal(r.status, 201);
    subjectSup1 = r.body.subject;
    assert.equal(subjectSup1.supervisor_id, ctx.ids.sup1, 'supervisor cannot assign subject to someone else');
    assert.equal((await sup2.get(`/api/subjects/${subjectSup1.id}`)).status, 404);
    assert.equal((await sup1.post(`/api/subjects/${subjectSup1.id}/students`, { student_id: studentB.id })).status, 404, 'cannot enroll out-of-scope student');
    const enroll = await pm.post(`/api/subjects/${subjectSup1.id}/students`, { student_id: studentB.id });
    assert.equal(enroll.status, 201);
    assert.equal((await pm.post(`/api/subjects/${subjectSup1.id}/students`, { student_id: studentA.id })).status, 409, 'capacity reached');
    const list1 = await sup1.get('/api/students');
    assert.ok(list1.body.students.some((s) => s.id === studentB.id), 'enrolled student now visible to subject supervisor');
    assert.equal((await sup1.del(`/api/subjects/${subjectSup1.id}`)).status, 403);
  });

  test('sessions and attendance flow', async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const s = await sup1.post('/api/sessions', { title: 'Lab 1 — GitOps', subject_id: subjectSup1.id, scheduled_at: past, mode: 'online', location: 'Meet' });
    assert.equal(s.status, 201, JSON.stringify(s.body));
    const sid = s.body.session.id;
    assert.equal(s.body.session.domain, 'DevOps', 'domain inherited from subject');
    const sheet = await sup1.get(`/api/sessions/${sid}`);
    assert.deepEqual(sheet.body.attendance.map((a) => a.student_id), [studentB.id], 'roster = enrolled students');
    assert.equal((await sup2.get(`/api/sessions/${sid}`)).status, 404);
    const bad = await sup1.put(`/api/sessions/${sid}/attendance`, { entries: [{ student_id: 99999, status: 'present' }] });
    assert.equal(bad.status, 400);
    const mark = await sup1.put(`/api/sessions/${sid}/attendance`, { entries: [{ student_id: studentB.id, status: 'absent', note: 'Non prévenu' }, { student_id: studentA.id, status: 'present' }] });
    assert.equal(mark.status, 200, JSON.stringify(mark.body));
    assert.equal(mark.body.attendance.length, 2);
    const again = await sup1.put(`/api/sessions/${sid}/attendance`, { entries: [{ student_id: studentB.id, status: 'late' }] });
    assert.equal(again.body.attendance.find((a) => a.student_id === studentB.id).status, 'late', 'upsert overrides');
    const after = await sup1.get(`/api/sessions/${sid}`);
    assert.equal(after.body.session.status, 'done', 'past session auto-marked done after attendance');
    const detail = await pm.get(`/api/students/${studentA.id}`);
    assert.equal(detail.body.student.attendance_rate, 100);
    assert.equal(detail.body.attendance.length, 1);
    const dash = await sup1.get('/api/dashboard');
    assert.equal(dash.status, 200);
    assert.equal(dash.body.kpis.attendance_rate_30d, 100);
    assert.equal((await pm.get('/api/dashboard')).body.kpis.students_total, 2);
  });

  test('CSV export (managers only) and import', async () => {
    assert.equal((await sup1.get('/api/students/export.csv')).status, 403);
    const csv = await pm.get('/api/students/export.csv');
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type'), /text\/csv/);
    assert.match(csv.body, /Sara,Amri/);
    const imp = await pm.post('/api/students/import', { csv: 'Prénom;Nom;Email;WhatsApp;Niveau;Domaines\nLina;Gharbi;lina@exemple.com;+21699111222;Avancé;Data Analysis | Cloud\nBad;Row;not-an-email;;;\nSara;Amri;sara.amri@exemple.com;;;' });
    assert.equal(imp.status, 200);
    assert.equal(imp.body.created, 1); assert.equal(imp.body.skipped, 1); assert.equal(imp.body.errors.length, 1);
    const lina = (await pm.get('/api/students?q=Gharbi')).body.students[0];
    assert.deepEqual(lina.domains, ['Data Analysis', 'Cloud']);
    assert.equal(lina.source, 'import');
  });

  test('landing intake endpoint: key required, CORS for allowed origin, dedup', async () => {
    const settings = await admin.get('/api/settings');
    const key = settings.body.intake_key;
    assert.equal((await pm.get('/api/settings')).status, 403);
    const payload = { prenom: 'Youssef', nom: 'Jlassi', email: 'youssef@exemple.com', whatsapp: '+216 55 000 111', statut: 'Étudiant(e)', domaines: 'DevOps, Cybersecurity et Cloud', niveau: 'Débutant', envoye_le: new Date().toISOString(), message: '...' };
    const noKey = await fetch(ctx.base + '/api/public/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    assert.equal(noKey.status, 401);
    const ok = await fetch(ctx.base + '/api/public/leads?key=' + key, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://xp.subul.uk' }, body: JSON.stringify(payload) });
    assert.equal(ok.status, 201);
    assert.equal(ok.headers.get('access-control-allow-origin'), 'https://xp.subul.uk');
    const lead = (await pm.get('/api/students?stage=lead&source=landing')).body.students[0];
    assert.equal(lead.first_name, 'Youssef');
    assert.deepEqual(lead.domains, ['DevOps', 'Cybersecurity', 'Cloud']);
    assert.equal(lead.whatsapp, '+21655000111');
    const dup = await fetch(ctx.base + '/api/public/leads', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Intake-Key': key }, body: JSON.stringify(payload) });
    assert.equal(dup.status, 409);
    const other = await fetch(ctx.base + '/api/public/leads?key=' + key, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
    assert.equal(other.headers.get('access-control-allow-origin'), null);
  });

  test('documents: upload with validation, scope, download and delete', async () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\n%%EOF');
    const q = (type, name) => `/api/students/${studentA.id}/documents?type=${type}&name=${encodeURIComponent(name)}`;
    const up = await pm.upload(q('convention_de_stage', 'Convention Sara.pdf'), pdf, 'application/pdf');
    assert.equal(up.status, 201, JSON.stringify(up.body));
    assert.equal(up.body.document.type, 'convention_de_stage'); assert.equal(up.body.document.mime, 'application/pdf'); assert.equal(up.body.document.size, pdf.length);
    assert.equal((await pm.upload(q('convention_de_stage', 'virus.exe'), pdf)).status, 400, 'extension refusée');
    assert.equal((await pm.upload(q('convention_de_stage', 'fake.pdf'), Buffer.from('not a pdf'))).status, 400, 'signature refusée');
    assert.equal((await pm.upload(q('passeport', 'x.pdf'), pdf)).status, 400, 'type refusé');
    assert.equal((await pm.upload(q('autre', 'empty.pdf'), Buffer.alloc(0))).status, 400, 'fichier vide refusé');
    const sup = await sup1.upload(q('cahier_des_charges', 'CDC.pdf'), pdf, 'application/pdf');
    assert.equal(sup.status, 201, 'supervisor can upload for own student');
    assert.equal((await sup2.get(`/api/students/${studentA.id}/documents`)).status, 404, 'out-of-scope supervisor cannot see documents');
    const lst = await pm.get(`/api/students/${studentA.id}/documents`);
    assert.equal(lst.body.documents.length, 2);
    const inList = (await pm.get('/api/students?q=Amri')).body.students[0];
    assert.deepEqual(inList.document_types.sort(), ['cahier_des_charges', 'convention_de_stage']);
    const dl = await pm.raw(`/api/students/${studentA.id}/documents/${up.body.document.id}/download`);
    assert.equal(dl.status, 200); assert.ok(dl.buffer.equals(pdf)); assert.match(dl.headers.get('content-disposition'), /attachment/); assert.equal(dl.headers.get('content-type'), 'application/pdf');
    assert.equal((await sup1.del(`/api/students/${studentA.id}/documents/${up.body.document.id}`)).status, 403, 'supervisor cannot delete a PM upload');
    assert.equal((await sup1.del(`/api/students/${studentA.id}/documents/${sup.body.document.id}`)).status, 200, 'supervisor deletes own upload');
    assert.equal((await pm.del(`/api/students/${studentA.id}/documents/${up.body.document.id}`)).status, 200);
    assert.equal((await pm.raw(`/api/students/${studentA.id}/documents/${up.body.document.id}/download`)).status, 404);
    assert.equal((await pm.get(`/api/students/${studentA.id}/documents`)).body.documents.length, 0);
  });

  test('archive, audit log and password change', async () => {
    assert.equal((await sup1.post(`/api/students/${studentB.id}/archive`, {})).status, 403);
    assert.equal((await pm.post(`/api/students/${studentB.id}/archive`, {})).status, 200);
    assert.ok(!(await pm.get('/api/students')).body.students.some((s) => s.id === studentB.id));
    assert.ok((await pm.get('/api/students?archived=1')).body.students.some((s) => s.id === studentB.id));
    assert.equal((await pm.del(`/api/students/${studentB.id}`)).status, 403, 'hard delete is admin only');
    const audit = await admin.get('/api/audit');
    assert.equal(audit.status, 200);
    assert.ok(audit.body.entries.some((e) => e.action === 'student.archive'));
    assert.ok(audit.body.entries.some((e) => e.action === 'login.failed'));
    assert.equal((await pm.get('/api/audit')).status, 403);
    const c = ctx.client(); await c.login('sup2@test.local');
    assert.equal((await c.post('/api/auth/password', { current_password: 'wrong', new_password: 'NewPassword123' })).status, 400);
    assert.equal((await c.post('/api/auth/password', { current_password: 'Password123', new_password: 'NewPassword123' })).status, 200);
    assert.equal((await sup2.get('/api/auth/me')).status, 401, 'other sessions revoked after password change');
  });
});
