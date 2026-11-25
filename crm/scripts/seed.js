'use strict';
/**
 * Crée ou met à jour un utilisateur.
 *   npm run seed -- --email admin@smartovate.com --password 'MotDePasse123' --name "Admin" --role admin
 */
const { openDatabase } = require('../src/db');
const { hashPassword, passwordPolicy } = require('../src/auth');
const { loadConfig } = require('../src/app');
const { ROLES } = require('../src/constants');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return acc;
}, []));

const email = (args.email || process.env.ADMIN_EMAIL || '').toLowerCase();
const password = args.password || process.env.ADMIN_PASSWORD;
const name = args.name || process.env.ADMIN_NAME || 'Administrateur';
const role = args.role || 'admin';
if (!email || !password) { console.error('Usage: npm run seed -- --email <email> --password <mdp> [--name "Nom"] [--role admin|project_manager|supervisor]'); process.exit(1); }
if (!ROLES.includes(role)) { console.error('Rôle invalide'); process.exit(1); }
const policy = passwordPolicy(password);
if (policy) { console.error(policy); process.exit(1); }

const db = openDatabase(loadConfig().databasePath);
const existing = db.get('SELECT id FROM users WHERE email = ?', email);
if (existing) {
  db.run('UPDATE users SET password_hash = ?, name = ?, role = ?, active = 1 WHERE id = ?', hashPassword(password), name, role, existing.id);
  console.info(`Utilisateur mis à jour : ${email} (${role})`);
} else {
  db.run('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)', name, email, hashPassword(password), role);
  console.info(`Utilisateur créé : ${email} (${role})`);
}
db.close();
