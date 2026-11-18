import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
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
const hadLocalDatabase = existsSync(databasePath);
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

CREATE INDEX IF NOT EXISTS idx_tasks_teacher ON tasks(teacher_id);
CREATE INDEX IF NOT EXISTS idx_tasks_class ON tasks(class_id);
CREATE INDEX IF NOT EXISTS idx_assign_student ON task_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);
`);

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
