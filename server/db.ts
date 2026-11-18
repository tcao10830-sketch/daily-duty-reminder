import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword } from './auth.ts';
import { downloadDatabaseSnapshot, uploadDatabaseSnapshot, loadLegacyDatabaseRows } from './supabase.ts';

const dataDir = join(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });

const databasePath = join(dataDir, 'duty.sqlite');
const cloudPersistenceEnabled = Boolean(
  process.env.SUPABASE_URL &&
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
);
if (process.env.NODE_ENV === 'production' && !cloudPersistenceEnabled) {
  throw new Error('SUPABASE_URL and a server-side Supabase key are required for persistent production storage.');
}

// Restore the last cloud snapshot before opening SQLite. The local file is only a working copy.
const cloudSnapshot = cloudPersistenceEnabled ? await downloadDatabaseSnapshot() : null;
if (cloudSnapshot) {
  for (const suffix of ['', '-wal', '-shm']) {
    const oldPath = databasePath + suffix;
    if (existsSync(oldPath)) unlinkSync(oldPath);
  }
  writeFileSync(databasePath, gunzipSync(cloudSnapshot));
}

const configuredSecret = process.env.JWT_SECRET?.trim();
if (process.env.NODE_ENV === 'production' && !configuredSecret) {
  throw new Error('JWT_SECRET must be configured in the production environment.');
}

// Production tokens must use a stable environment secret, never an ephemeral disk file.
// Keep the local file fallback for development only.
const secretPath = join(dataDir, 'jwt.secret');
if (!configuredSecret && !existsSync(secretPath)) writeFileSync(secretPath, randomBytes(32).toString('hex'));
export const jwtSecret = configuredSecret || readFileSync(secretPath, 'utf8');

export const db = new DatabaseSync(databasePath);
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA busy_timeout = 3000');

db.exec(`
CREATE TABLE IF NOT EXISTS app_migrations (
  key TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (teacher_id, name)
);

CREATE TABLE IF NOT EXISTS class_members (
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (class_id, student_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL REFERENCES users(id),
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  penalty TEXT NOT NULL DEFAULT '',
  assignment_date TEXT NOT NULL,
  deadline_date TEXT NOT NULL,
  deadline_time TEXT NOT NULL,
  recurrence TEXT NOT NULL,
  color TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (series_id, assignment_date)
);

CREATE TABLE IF NOT EXISTS task_assignments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  in_progress INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (task_id, student_id)
);

CREATE TABLE IF NOT EXISTS task_completions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL UNIQUE REFERENCES task_assignments(id) ON DELETE CASCADE,
  completed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, type, entity_id)
);

CREATE TABLE IF NOT EXISTS reward_settings (
  teacher_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  early_rules_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS student_streaks (
  student_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'threatened', 'broken')),
  grace_deadline_at TEXT,
  threatened_assignment_id TEXT,
  last_submitted_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pencil_ledger (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teacher_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  assignment_id TEXT REFERENCES task_assignments(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('early', 'quality', 'streak', 'adjustment', 'streak_reversal')),
  amount INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pencil_ledger_once
  ON pencil_ledger(student_id, assignment_id, source) WHERE assignment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pencil_ledger_student ON pencil_ledger(student_id, created_at);
CREATE TABLE IF NOT EXISTS streak_events (
  assignment_id TEXT PRIMARY KEY REFERENCES task_assignments(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  streak_number INTEGER NOT NULL,
  submitted_at TEXT NOT NULL,
  streak_bonus INTEGER NOT NULL DEFAULT 0,
  review_required INTEGER NOT NULL DEFAULT 0,
  decision TEXT CHECK (decision IN ('keep', 'break')),
  counted INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_tasks_teacher ON tasks(teacher_id);
CREATE INDEX IF NOT EXISTS idx_tasks_class ON tasks(class_id);
CREATE INDEX IF NOT EXISTS idx_assign_student ON task_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);
`);

// Persist submission and revision timing with each assignment.
const assignmentColumns = db.prepare('PRAGMA table_info(task_assignments)').all() as { name: string }[];
if (!assignmentColumns.some((column) => column.name === 'submitted_at')) db.exec('ALTER TABLE task_assignments ADD COLUMN submitted_at TEXT');
if (!assignmentColumns.some((column) => column.name === 'revision_deadline_at')) db.exec('ALTER TABLE task_assignments ADD COLUMN revision_deadline_at TEXT');

async function persistSnapshot(): Promise<void> {
  if (!cloudPersistenceEnabled) return;
  const snapshotPath = join(dataDir, `snapshot-${randomUUID()}.sqlite`);
  try {
    db.exec('PRAGMA wal_checkpoint(FULL)');
    db.exec(`VACUUM INTO '${snapshotPath.replace(/'/g, "''")}'`);
    await uploadDatabaseSnapshot(gzipSync(readFileSync(snapshotPath)));
  } finally {
    if (existsSync(snapshotPath)) unlinkSync(snapshotPath);
  }
}

// If this is the first boot without a snapshot, preserve any rows already in Supabase.
if (!cloudSnapshot && cloudPersistenceEnabled) {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  if (existing.n === 0) {
    const legacy = await loadLegacyDatabaseRows();
    const importOrder = [
      'users',
      'classes',
      'class_members',
      'tasks',
      'task_assignments',
      'task_completions',
      'notifications',
    ];
    for (const table of importOrder) {
      for (const row of legacy[table] || []) {
        const columns = Object.keys(row).filter((column) => /^[a-z_][a-z0-9_]*$/i.test(column));
        if (!columns.length) continue;
        const values = columns.map((column) => {
          const value = row[column];
          if (table === 'task_assignments' && column === 'in_progress') return value ? 1 : 0;
          return value ?? null;
        });
        const sql = `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
        db.prepare(sql).run(...values as any[]);
      }
    }
  }
  await persistSnapshot();
}

// One-time recovery for the existing teacher account. Set this only on Preview,
// then remove the environment variable after the successful deployment.
const recoveryPassword = process.env.PREVIEW_TEACHER_RECOVERY_PASSWORD;
if (recoveryPassword) {
  if (recoveryPassword.length < 10) {
    throw new Error('PREVIEW_TEACHER_RECOVERY_PASSWORD must be at least 10 characters.');
  }
  const migrationKey = 'preview_teacher_password_recovery_v1';
  const alreadyApplied = db.prepare('SELECT key FROM app_migrations WHERE key = ?').get(migrationKey);
  if (!alreadyApplied) {
    const account = db.prepare(
      "SELECT id FROM users WHERE lower(email) = lower(?) AND role = 'teacher'",
    ).get('tcao10830@gmail.com') as { id: string } | undefined;
    if (!account) throw new Error('Teacher account for the one-time Preview recovery was not found.');
    const passwordHash = await hashPassword(recoveryPassword);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, account.id);
    db.prepare('INSERT INTO app_migrations (key, applied_at) VALUES (?, ?)').run(migrationKey, new Date().toISOString());
    await persistSnapshot();
  }
}

let queue: Promise<unknown> = Promise.resolve();

/** Run database work one at a time. Do not call withDb inside another withDb. */
export function withDb<T>(fn: () => T): Promise<T> {
  const run = queue.then(async () => {
    const before = (db.prepare('SELECT total_changes() AS n').get() as { n: number }).n;
    const result = fn();
    const after = (db.prepare('SELECT total_changes() AS n').get() as { n: number }).n;
    if (after > before) await persistSnapshot();
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
