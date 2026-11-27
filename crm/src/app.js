'use strict';
const path = require('node:path');
const express = require('express');
const { openDatabase } = require('./db');
const { createSessionMiddleware, csrfGuard, hashPassword, passwordPolicy } = require('./auth');
const { HttpError } = require('./errors');

function loadConfig(env = process.env) {
  const secret = env.SESSION_SECRET || '';
  if (env.NODE_ENV === 'production' && secret.length < 32) throw new Error('SESSION_SECRET doit faire au moins 32 caractères en production');
  return {
    port: Number(env.PORT) || 3000,
    databasePath: env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'crm.db'),
    sqliteJournalMode: env.SQLITE_JOURNAL_MODE || 'WAL',
    uploadDir: env.UPLOAD_DIR || path.join(path.dirname(env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'crm.db')), 'uploads'),
    trustProxy: env.TRUST_PROXY === 'true',
    secureCookies: env.TRUST_PROXY === 'true' || env.NODE_ENV === 'production',
    sessionSecret: secret || 'dev-only-secret-change-me-0123456789',
    sessionHours: Number(env.SESSION_HOURS) || 12,
    intakeAllowedOrigins: String(env.INTAKE_ALLOWED_ORIGINS || 'https://xp.subul.uk').split(',').map((s) => s.trim()).filter(Boolean),
    adminEmail: env.ADMIN_EMAIL || '', adminPassword: env.ADMIN_PASSWORD || '', adminName: env.ADMIN_NAME || 'Administrateur',
  };
}

function bootstrapAdmin(db, config, log = console) {
  const count = db.get('SELECT COUNT(*) AS n FROM users').n;
  if (count > 0) return;
  if (config.adminEmail && config.adminPassword) {
    const policy = passwordPolicy(config.adminPassword);
    if (policy) throw new Error('ADMIN_PASSWORD : ' + policy);
    db.run('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)', config.adminName, config.adminEmail.toLowerCase(), hashPassword(config.adminPassword), 'admin');
    log.info(`[crm] Compte admin initial créé : ${config.adminEmail}`);
  } else {
    log.warn('[crm] Aucun utilisateur : définissez ADMIN_EMAIL/ADMIN_PASSWORD ou lancez "npm run seed".');
  }
}

function createApp(config, { log = console } = {}) {
  const db = openDatabase(config.databasePath, { journalMode: config.sqliteJournalMode });
  bootstrapAdmin(db, config, log);

  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'same-origin');
    res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.set('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    if (config.secureCookies) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  app.use(express.json({ limit: '2mb' }));
  app.use('/api/public', require('./routes/public')(db, config));

  app.use('/api', createSessionMiddleware(db, config), csrfGuard);
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api/auth', require('./routes/auth')(db));
  app.use('/api/meta', require('./routes/meta')());
  app.use('/api/users', require('./routes/users')(db));
  app.use('/api/students/:id/documents', require('./routes/documents')(db, config));
  app.use('/api/students', require('./routes/students')(db));
  app.use('/api/subjects', require('./routes/subjects')(db));
  app.use('/api/sessions', require('./routes/sessions')(db));
  app.use('/api/dashboard', require('./routes/dashboard')(db));
  app.use('/api/audit', require('./routes/audit')(db));
  app.use('/api/settings', require('./routes/settings')(db, config));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Route introuvable' }));

  app.use(express.static(path.join(__dirname, '..', 'public'), { index: 'index.html', maxAge: '1h' }));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalide' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Requête trop volumineuse' });
    log.error('[crm] Erreur inattendue', err);
    res.status(500).json({ error: 'Erreur interne' });
  });

  // Purge expired sessions hourly.
  const timer = setInterval(() => db.run('DELETE FROM sessions WHERE expires_at < ?', new Date().toISOString()), 3600 * 1000);
  timer.unref();

  app.locals.db = db;
  app.locals.config = config;
  app.locals.close = () => { clearInterval(timer); db.close(); };
  return app;
}

module.exports = { createApp, loadConfig, bootstrapAdmin };
