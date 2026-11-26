'use strict';
/** Données de démonstration : utilisateurs, étudiants, sujets, séances, présences. Mot de passe commun : Demo12345! */
const { openDatabase } = require('../src/db');
const { hashPassword } = require('../src/auth');
const { loadConfig } = require('../src/app');
const { DOMAINS, LEVELS, STUDENT_STATUSES } = require('../src/constants');

const db = openDatabase(loadConfig().databasePath);
const PASSWORD = 'Demo12345!';
const hash = hashPassword(PASSWORD);

function upsertUser(name, email, role, company) {
  const ex = db.get('SELECT id FROM users WHERE email = ?', email);
  if (ex) return ex.id;
  return Number(db.run('INSERT INTO users (name, email, password_hash, role, company) VALUES (?,?,?,?,?)', name, email, hash, role, company || null).lastInsertRowid);
}

db.transaction(() => {
  const admin = upsertUser('Admin Smartovate', 'admin@demo.local', 'admin', 'Smartovate');
  const pm1 = upsertUser('Yasmine Trabelsi', 'pm1@demo.local', 'project_manager', 'Smartovate');
  const pm2 = upsertUser('Karim Haddad', 'pm2@demo.local', 'project_manager', 'Smartovate');
  const sup1 = upsertUser('Hedi Ben Abdallah', 'sup1@demo.local', 'supervisor', 'Smartovate');
  const sup2 = upsertUser('Nour El Fekih', 'sup2@demo.local', 'supervisor', 'CloudNova');
  const sup3 = upsertUser('Omar Zaidi', 'sup3@demo.local', 'supervisor', 'SecuraTech');

  if (db.get('SELECT COUNT(*) AS n FROM students').n > 0) { console.info('Étudiants déjà présents, démo ignorée.'); return; }

  const first = ['Sara', 'Amine', 'Lina', 'Youssef', 'Mariem', 'Ahmed', 'Ines', 'Mehdi', 'Rania', 'Bilel', 'Nadia', 'Khalil', 'Salma', 'Wassim', 'Asma', 'Firas', 'Hiba', 'Rayen', 'Emna', 'Aziz', 'Maya', 'Seif', 'Chaima', 'Anis'];
  const last = ['Amri', 'Ben Salah', 'Gharbi', 'Jlassi', 'Mansouri', 'Chaabane', 'Khelifi', 'Bouazizi', 'Dridi', 'Hamdi', 'Baccouche', 'Nasri', 'Ayari', 'Belhaj', 'Saidi', 'Ferchichi', 'Mejri', 'Toumi', 'Rezgui', 'Abidi', 'Cherif', 'Zouari', 'Ouni', 'Kacem'];
  const schools = ['ENSI', 'INSAT', 'ESPRIT', 'ISI', 'ENIT', 'SUP\'COM', 'ISET Rades', 'FST'];
  const cities = ['Tunis', 'Sfax', 'Sousse', 'Bizerte', 'Monastir', 'Nabeul'];
  const stages = ['lead', 'lead', 'contacted', 'contacted', 'lab_scheduled', 'active', 'active', 'active', 'active', 'completed', 'dropped'];
  const sups = [sup1, sup2, sup3, null];
  const pms = [pm1, pm2];
  const studentIds = [];
  for (let i = 0; i < 24; i++) {
    const stage = stages[i % stages.length];
    const daysAgo = Math.floor(Math.random() * 90);
    const created = new Date(Date.now() - daysAgo * 86400000).toISOString();
    const info = db.run(`INSERT INTO students (first_name, last_name, email, whatsapp, status, level, school, city, stage, source, supervisor_id, manager_id, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, first[i], last[i], `${first[i].toLowerCase()}.${last[i].toLowerCase().replace(/[^a-z]/g, '')}@exemple.com`,
      `+2162${String(1000000 + i * 37).slice(0, 7)}`, STUDENT_STATUSES[i % STUDENT_STATUSES.length], LEVELS[i % 3], schools[i % schools.length], cities[i % cities.length],
      stage, i % 3 === 0 ? 'landing' : (i % 3 === 1 ? 'referral' : 'linkedin'), stage === 'lead' ? null : sups[i % sups.length], pms[i % 2], admin, created, created);
    const id = Number(info.lastInsertRowid);
    studentIds.push(id);
    const ds = [DOMAINS[i % DOMAINS.length]]; if (i % 4 === 0) ds.push(DOMAINS[(i + 2) % DOMAINS.length]);
    for (const d of ds) db.run('INSERT INTO student_domains (student_id, domain) VALUES (?,?)', id, d);
    db.run('INSERT INTO activities (student_id, user_id, type, content, created_at) VALUES (?,?,?,?,?)', id, admin, 'system', 'Fiche créée', created);
    if (stage !== 'lead') db.run('INSERT INTO activities (student_id, user_id, type, content) VALUES (?,?,?,?)', id, pms[i % 2], 'whatsapp', 'Premier contact WhatsApp, intéressé(e) par un lab.');
  }

  const subjects = [
    ['Pipeline CI/CD GitOps sur Kubernetes', 'DevOps', sup1, pm1, 'in_progress', 4],
    ['Agent IA de support client avec RAG', 'AI & Agents', sup1, pm1, 'open', 3],
    ['Audit de sécurité d\'une API REST', 'Cybersecurity', sup3, pm2, 'in_progress', 3],
    ['Dashboard analytique ventes', 'Data Analysis', sup2, pm2, 'open', 4],
    ['Migration d\'une app monolithique vers le cloud', 'Cloud', sup2, pm1, 'draft', 2],
    ['Plateforme full stack de gestion de stages', 'Full Stack', sup3, pm2, 'open', 3],
  ];
  const subjectIds = subjects.map(([title, domain, sup, pm, status, cap]) =>
    Number(db.run('INSERT INTO subjects (title, description, domain, supervisor_id, manager_id, status, capacity, start_date, created_by) VALUES (?,?,?,?,?,?,?,?,?)',
      title, 'Sujet de résidence technique Subul XP.', domain, sup, pm, status, cap, '2026-10-01', admin).lastInsertRowid));

  const active = db.all("SELECT id, supervisor_id FROM students WHERE stage IN ('active','completed','lab_scheduled')");
  for (const s of active) {
    const candidates = subjects.map((x, i) => [x, subjectIds[i]]).filter(([x]) => x[2] === s.supervisor_id);
    if (candidates.length) db.run('INSERT OR IGNORE INTO student_subjects (student_id, subject_id, assigned_by) VALUES (?,?,?)', s.id, candidates[0][1], pm1);
  }

  for (let k = 0; k < 10; k++) {
    const si = k % subjects.length;
    const when = new Date(Date.now() + (k - 6) * 4 * 86400000); when.setHours(14, 0, 0, 0);
    const past = when < new Date();
    const sid = Number(db.run('INSERT INTO lab_sessions (title, subject_id, domain, supervisor_id, scheduled_at, duration_min, mode, location, status, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
      `Lab ${k + 1} — ${subjects[si][0]}`, subjectIds[si], subjects[si][1], subjects[si][2], when.toISOString(), 150, k % 3 === 0 ? 'online' : 'onsite',
      k % 3 === 0 ? 'Google Meet' : 'Smartovate Lab, Tunis', past ? 'done' : 'planned', admin).lastInsertRowid);
    if (past) {
      const enrolled = db.all('SELECT student_id FROM student_subjects WHERE subject_id = ?', subjectIds[si]);
      enrolled.forEach((e, j) => db.run('INSERT INTO attendance (lab_session_id, student_id, status, marked_by) VALUES (?,?,?,?)',
        sid, e.student_id, ['present', 'present', 'late', 'absent', 'present', 'excused'][(j + k) % 6], subjects[si][2]));
    }
  }
  console.info(`Démo créée. Comptes (mot de passe ${PASSWORD}) : admin@demo.local, pm1@demo.local, pm2@demo.local, sup1@demo.local, sup2@demo.local, sup3@demo.local`);
});
db.close();
