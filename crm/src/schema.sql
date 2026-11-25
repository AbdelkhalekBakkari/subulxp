PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','project_manager','supervisor')),
  whatsapp      TEXT,
  company       TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ip         TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS students (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  email         TEXT COLLATE NOCASE,
  whatsapp      TEXT,
  status        TEXT,
  level         TEXT CHECK (level IS NULL OR level IN ('Débutant','Intermédiaire','Avancé')),
  school        TEXT,
  city          TEXT,
  stage         TEXT NOT NULL DEFAULT 'lead'
                CHECK (stage IN ('lead','contacted','lab_scheduled','active','completed','dropped')),
  source        TEXT,
  supervisor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  manager_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes         TEXT,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  archived_at   TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_email ON students(email) WHERE email IS NOT NULL AND email <> '';
CREATE INDEX IF NOT EXISTS idx_students_stage ON students(stage);
CREATE INDEX IF NOT EXISTS idx_students_supervisor ON students(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_students_manager ON students(manager_id);

CREATE TABLE IF NOT EXISTS student_domains (
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  domain     TEXT NOT NULL,
  PRIMARY KEY (student_id, domain)
);

CREATE TABLE IF NOT EXISTS subjects (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  description   TEXT,
  domain        TEXT NOT NULL,
  supervisor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  manager_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('draft','open','in_progress','completed','archived')),
  capacity      INTEGER NOT NULL DEFAULT 1 CHECK (capacity >= 0),
  start_date    TEXT,
  end_date      TEXT,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_subjects_supervisor ON subjects(supervisor_id);

CREATE TABLE IF NOT EXISTS student_subjects (
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id  INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (student_id, subject_id)
);

CREATE TABLE IF NOT EXISTS lab_sessions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  subject_id    INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  domain        TEXT,
  supervisor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  scheduled_at  TEXT NOT NULL,
  duration_min  INTEGER NOT NULL DEFAULT 120 CHECK (duration_min > 0),
  mode          TEXT NOT NULL DEFAULT 'onsite' CHECK (mode IN ('onsite','online')),
  location      TEXT,
  status        TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','done','cancelled')),
  notes         TEXT,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_lab_sessions_when ON lab_sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_lab_sessions_supervisor ON lab_sessions(supervisor_id);

CREATE TABLE IF NOT EXISTS attendance (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  lab_session_id INTEGER NOT NULL REFERENCES lab_sessions(id) ON DELETE CASCADE,
  student_id     INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status         TEXT NOT NULL CHECK (status IN ('present','absent','late','excused')),
  note           TEXT,
  marked_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  marked_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (lab_session_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);

CREATE TABLE IF NOT EXISTS activities (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type       TEXT NOT NULL CHECK (type IN ('note','call','whatsapp','email','meeting','stage_change','system')),
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_activities_student ON activities(student_id, created_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  INTEGER,
  details    TEXT,
  ip         TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
