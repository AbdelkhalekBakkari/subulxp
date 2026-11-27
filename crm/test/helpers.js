'use strict';
const { createApp } = require('../src/app');
const { hashPassword } = require('../src/auth');

async function startApp() {
  const config = {
    port: 0, databasePath: ':memory:', trustProxy: false, secureCookies: false,
    sessionSecret: 'test-secret-test-secret-test-secret-123', sessionHours: 1,
    uploadDir: require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'crm-uploads-')),
    intakeAllowedOrigins: ['https://xp.subul.uk'], adminEmail: '', adminPassword: '', adminName: '',
  };
  const quiet = { info() {}, warn() {}, error: console.error };
  const app = createApp(config, { log: quiet });
  const db = app.locals.db;
  const hash = hashPassword('Password123');
  const mk = (name, email, role) => Number(db.run('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)', name, email, hash, role).lastInsertRowid);
  const ids = { admin: mk('Admin', 'admin@test.local', 'admin'), pm: mk('PM', 'pm@test.local', 'project_manager'),
    sup1: mk('Sup One', 'sup1@test.local', 'supervisor'), sup2: mk('Sup Two', 'sup2@test.local', 'supervisor') };
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;

  function client() {
    let cookie = '';
    const call = async (method, path, body, extraHeaders = {}) => {
      const res = await fetch(base + path, {
        method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders },
        body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual',
      });
      const sc = res.headers.get('set-cookie');
      if (sc) cookie = sc.split(';')[0];
      const text = await res.text();
      let json; try { json = JSON.parse(text); } catch { json = text; }
      return { status: res.status, body: json, headers: res.headers };
    };
    const upload = async (path, buffer, contentType = 'application/octet-stream') => {
      const res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': contentType, 'X-Requested-With': 'XMLHttpRequest', ...(cookie ? { Cookie: cookie } : {}) }, body: buffer });
      const text = await res.text(); let json; try { json = JSON.parse(text); } catch { json = text; }
      return { status: res.status, body: json, headers: res.headers };
    };
    const raw = async (path) => { const res = await fetch(base + path, { headers: { ...(cookie ? { Cookie: cookie } : {}) } }); return { status: res.status, buffer: Buffer.from(await res.arrayBuffer()), headers: res.headers }; };
    return {
      upload, raw,
      get: (p, h) => call('GET', p, undefined, h), post: (p, b, h) => call('POST', p, b, h), patch: (p, b) => call('PATCH', p, b),
      put: (p, b) => call('PUT', p, b), del: (p) => call('DELETE', p),
      login: async (email) => { const r = await call('POST', '/api/auth/login', { email, password: 'Password123' }); if (r.status !== 200) throw new Error('login failed ' + JSON.stringify(r.body)); return r; },
    };
  }
  const as = async (who) => { const c = client(); await c.login(`${who}@test.local`); return c; };
  const stop = () => new Promise((resolve) => server.close(() => { app.locals.close(); resolve(); }));
  return { app, db, ids, base, client, as, stop };
}
module.exports = { startApp };
