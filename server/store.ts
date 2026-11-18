import { randomUUID } from 'node:crypto';
import { db, withDb } from './db.ts';
import { HttpError } from './errors.ts';
import { hashPassword, verifyPassword } from './auth.ts';
import {
  addDays,
  completionStatus,
  deadlineMs,
  isHm,
  isIsoDate,
  planInstances,
  todayInZone,
  type CompletionStatus,
  type Recurrence,
} from './time.ts';
import { emitMany } from './events.ts';
import { flagStreakRevisionLocked, recordSubmissionRewardsLocked, sweepStreaksLocked } from './rewards.ts';

export type Role = 'teacher' | 'student';
export type Priority = 'low' | 'medium' | 'high';
export type NoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'orange' | 'purple';

const COLORS = new Set<NoteColor>(['yellow', 'pink', 'blue', 'green', 'orange', 'purple']);
const PRIORITIES = new Set<Priority>(['low', 'medium', 'high']);

export type PublicUser = { id: string; name: string; email: string; role: Role };

type UserRow = PublicUser & { password_hash: string };

type AssignmentRow = {
  assignment_id: string;
  task_id: string;
  series_id: string;
  title: string;
  description: string;
  instructions: string;
  class_id: string;
  class_name: string;
  student_id: string;
  student_name: string;
  assignment_date: string;
  deadline_date: string;
  deadline_time: string;
  priority: Priority;
  penalty: string;
  color: NoteColor;
  recurrence: Recurrence;
  task_status: 'active' | 'cancelled';
  in_progress: number;
  submitted_at: string | null;
  revision_deadline_at: string | null;
  completed_at: string | null;
  teacher_id: string;
};

export type AssignmentCard = {
  assignmentId: string;
  taskId: string;
  seriesId: string;
  title: string;
  description: string;
  instructions: string;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  assignmentDate: string;
  deadlineDate: string;
  deadlineTime: string;
  deadlineAt: string;
  priority: Priority;
  penalty: string;
  color: NoteColor;
  recurrence: Recurrence;
  taskStatus: 'active' | 'cancelled';
  inProgress: boolean;
  submittedAt: string | null;
  submissionPending: boolean;
  revisionDeadlineAt: string | null;
  completedAt: string | null;
  status: CompletionStatus;
};

type LiveEvent = { userId: string; event: { type: string } };

function id(): string {
  return randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

function clean(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

function requireText(value: unknown, label: string, max: number): string {
  const text = clean(value, max);
  if (!text) throw new HttpError(400, `${label} is required.`);
  return text;
}

function mapAssignment(row: AssignmentRow): AssignmentCard {
  const effectiveDeadline = row.revision_deadline_at ? new Date(row.revision_deadline_at) : null;
  const effectiveDate = effectiveDeadline ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(effectiveDeadline) : row.deadline_date;
  const effectiveTime = effectiveDeadline ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(effectiveDeadline) : row.deadline_time;
  const status = row.submitted_at && !row.completed_at ? 'pending' : completionStatus(row.completed_at, effectiveDate, effectiveTime);
  return {
    assignmentId: row.assignment_id,
    taskId: row.task_id,
    seriesId: row.series_id,
    title: row.title,
    description: row.description,
    instructions: row.instructions,
    classId: row.class_id,
    className: row.class_name,
    studentId: row.student_id,
    studentName: row.student_name,
    assignmentDate: row.assignment_date,
    deadlineDate: effectiveDate,
    deadlineTime: effectiveTime,
    deadlineAt: effectiveDeadline ? effectiveDeadline.toISOString() : new Date(deadlineMs(row.deadline_date, row.deadline_time)).toISOString(),
    priority: row.priority,
    penalty: row.penalty,
    color: row.color,
    recurrence: row.recurrence,
    taskStatus: row.task_status,
    inProgress: row.in_progress === 1 && !row.completed_at && status === 'pending',
    submittedAt: row.submitted_at,
    submissionPending: Boolean(row.submitted_at && !row.completed_at),
    revisionDeadlineAt: row.revision_deadline_at,
    completedAt: row.completed_at,
    status,
  };
}

const assignmentSelect = `
  SELECT
    a.id AS assignment_id,
    a.in_progress,
    a.submitted_at,
    a.revision_deadline_at,
    u.name AS student_name,
    u.id AS student_id,
    t.id AS task_id,
    t.series_id,
    t.teacher_id,
    t.title,
    t.description,
    t.instructions,
    t.class_id,
    c.name AS class_name,
    t.assignment_date,
    t.deadline_date,
    t.deadline_time,
    t.priority,
    t.penalty,
    t.color,
    t.recurrence,
    t.status AS task_status,
    k.completed_at
  FROM task_assignments a
  JOIN tasks t ON t.id = a.task_id
  JOIN classes c ON c.id = t.class_id
  JOIN users u ON u.id = a.student_id
  LEFT JOIN task_completions k ON k.assignment_id = a.id
`;

function insertNotification(userId: string, type: string, title: string, body: string, entityId: string, events: LiveEvent[]): void {
  try {
    db.prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, entity_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id(), userId, type, title, body, entityId, nowIso());
    events.push({ userId, event: { type: 'notification' } });
  } catch (error) {
    if (String(error).includes('UNIQUE')) return;
    throw error;
  }
}

function publish(events: LiveEvent[]): void {
  emitMany(events);
}

export async function registerTeacher(input: { name: unknown; email: unknown; password: unknown }): Promise<PublicUser> {
  const name = requireText(input.name, 'Name', 80);
  const email = requireText(input.email, 'Email', 120).toLowerCase();
  const password = String(input.password ?? '');
  if (!email.includes('@')) throw new HttpError(400, 'Enter a valid email.');
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');
  const passwordHash = await hashPassword(password);
  return withDb(() => {
    const teacherExists = db.prepare("SELECT id FROM users WHERE role = 'teacher' LIMIT 1").get();
    if (teacherExists) throw new HttpError(403, 'A teacher account already exists. Please sign in.');
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) throw new HttpError(400, 'That email is already registered.');
    const user: PublicUser = { id: id(), name, email, role: 'teacher' };
    db.prepare('INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      user.id,
      email,
      passwordHash,
      name,
      'teacher',
      nowIso(),
    );
    return user;
  });
}


export function authSetup() {
  return withDb(() => ({
    hasTeacher: Boolean(db.prepare("SELECT id FROM users WHERE role = 'teacher' LIMIT 1").get()),
  }));
}

export function isPrimaryTeacher(userId: string): Promise<boolean> {
  return withDb(() => {
    const first = db.prepare("SELECT id FROM users WHERE role = 'teacher' ORDER BY created_at ASC, id ASC LIMIT 1").get() as { id: string } | undefined;
    return first?.id === userId;
  });
}

export async function registerAdditionalTeacher(creatorId: string, input: { name: unknown; email: unknown; password: unknown }): Promise<PublicUser> {
  const name = requireText(input.name, 'Name', 80);
  const email = requireText(input.email, 'Email', 120).toLowerCase();
  const password = String(input.password ?? '');
  if (!email.includes('@')) throw new HttpError(400, 'Enter a valid email.');
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');
  const passwordHash = await hashPassword(password);
  return withDb(() => {
    const first = db.prepare("SELECT id FROM users WHERE role = 'teacher' ORDER BY created_at ASC, id ASC LIMIT 1").get() as { id: string } | undefined;
    if (!first || first.id !== creatorId) throw new HttpError(403, 'Only the first teacher can create teacher accounts.');
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) throw new HttpError(400, 'That email is already registered.');
    const user: PublicUser = { id: id(), name, email, role: 'teacher' };
    db.prepare('INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      user.id, email, passwordHash, name, 'teacher', nowIso(),
    );
    return user;
  });
}

export async function login(emailRaw: unknown, password: unknown): Promise<PublicUser> {
  const email = clean(emailRaw, 120).toLowerCase();
  const row = await withDb(() => db.prepare('SELECT id, email, password_hash, name, role FROM users WHERE email = ?').get(email) as UserRow | undefined);
  if (!row || !(await verifyPassword(String(password ?? ''), row.password_hash))) {
    throw new HttpError(401, 'Email or password is incorrect.');
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

export function getUser(userId: string): Promise<PublicUser | null> {
  return withDb(() => {
    const row = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(userId) as PublicUser | undefined;
    return row ?? null;
  });
}

export async function updateProfile(userId: string, nameRaw: unknown): Promise<PublicUser> {
  const name = requireText(nameRaw, 'Name', 80);
  return withDb(() => {
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, userId);
    return db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(userId) as PublicUser;
  });
}

export async function changePassword(userId: string, currentPassword: unknown, nextPassword: unknown): Promise<void> {
  const next = String(nextPassword ?? '');
  if (next.length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');
  const row = await withDb(
    () => db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as { password_hash: string } | undefined,
  );
  if (!row || !(await verifyPassword(String(currentPassword ?? ''), row.password_hash))) {
    throw new HttpError(400, 'Current password is incorrect.');
  }
  const passwordHash = await hashPassword(next);
  await withDb(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
  });
}

function classStats(classId: string) {
  const rows = db.prepare(`${assignmentSelect} WHERE t.class_id = ? AND t.status = 'active'`).all(classId) as unknown as AssignmentRow[];
  const cards = rows.map(mapAssignment);
  const completed = cards.filter((card) => card.status === 'on_time' || card.status === 'late').length;
  const pending = cards.filter((card) => card.status === 'pending').length;
  const overdue = cards.filter((card) => card.status === 'overdue').length;
  const assigned = cards.length;
  return {
    assignedCount: assigned,
    completedCount: completed,
    pendingCount: pending,
    overdueCount: overdue,
    completionRate: assigned === 0 ? 0 : Math.round((completed / assigned) * 100),
  };
}

export function listClasses(teacherId: string) {
  return withDb(() => {
    const classes = db.prepare('SELECT id, name, created_at FROM classes WHERE teacher_id = ? ORDER BY name').all(teacherId) as {
      id: string;
      name: string;
      created_at: string;
    }[];
    return classes.map((item) => {
      const students = db
        .prepare(
          `SELECT u.id, u.name FROM users u
           JOIN class_members m ON m.student_id = u.id
           WHERE m.class_id = ? ORDER BY u.name`,
        )
        .all(item.id) as { id: string; name: string }[];
      return { id: item.id, name: item.name, studentCount: students.length, students, ...classStats(item.id) };
    });
  });
}

export function createClass(teacherId: string, nameRaw: unknown) {
  const name = requireText(nameRaw, 'Class name', 40);
  return withDb(() => {
    const clash = db.prepare('SELECT id FROM classes WHERE teacher_id = ? AND name = ?').get(teacherId, name);
    if (clash) throw new HttpError(400, 'You already have a class with that name.');
    const classId = id();
    db.prepare('INSERT INTO classes (id, teacher_id, name, created_at) VALUES (?, ?, ?, ?)').run(classId, teacherId, name, nowIso());
    return { id: classId, name, studentCount: 0, students: [], assignedCount: 0, completedCount: 0, pendingCount: 0, overdueCount: 0, completionRate: 0 };
  });
}

export function renameClass(teacherId: string, classId: string, nameRaw: unknown) {
  const name = requireText(nameRaw, 'Class name', 40);
  return withDb(() => {
    const owned = db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(classId, teacherId);
    if (!owned) throw new HttpError(404, 'Class not found.');
    const clash = db.prepare('SELECT id FROM classes WHERE teacher_id = ? AND name = ? AND id <> ?').get(teacherId, name, classId);
    if (clash) throw new HttpError(400, 'You already have a class with that name.');
    db.prepare('UPDATE classes SET name = ? WHERE id = ?').run(name, classId);
    return { id: classId, name };
  });
}

export function deleteClass(teacherId: string, classId: string) {
  return withDb(() => {
    const owned = db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(classId, teacherId);
    if (!owned) throw new HttpError(404, 'Class not found.');
    const students = db.prepare('SELECT student_id FROM class_members WHERE class_id = ?').all(classId) as { student_id: string }[];
    db.prepare('DELETE FROM classes WHERE id = ?').run(classId);
    for (const student of students) db.prepare('DELETE FROM users WHERE id = ? AND role = ?').run(student.student_id, 'student');
    return { ok: true };
  });
}

export function getClassDetail(teacherId: string, classId: string) {
  return withDb(() => {
    const item = db.prepare('SELECT id, name FROM classes WHERE id = ? AND teacher_id = ?').get(classId, teacherId) as
      | { id: string; name: string }
      | undefined;
    if (!item) throw new HttpError(404, 'Class not found.');
    const students = db
      .prepare(
        `SELECT u.id, u.name, u.email FROM users u
         JOIN class_members m ON m.student_id = u.id
         WHERE m.class_id = ? ORDER BY u.name`,
      )
      .all(classId) as { id: string; name: string; email: string }[];
    const rows = db.prepare(`${assignmentSelect} WHERE t.class_id = ? AND t.status = 'active'`).all(classId) as unknown as AssignmentRow[];
    const cards = rows.map(mapAssignment);
    const withStats = students.map((student) => {
      const mine = cards.filter((card) => card.studentId === student.id);
      const completed = mine.filter((card) => card.status === 'on_time' || card.status === 'late').length;
      return {
        ...student,
        assigned: mine.length,
        completed,
        pending: mine.filter((card) => card.status === 'pending').length,
        overdue: mine.filter((card) => card.status === 'overdue').length,
        completionRate: mine.length === 0 ? 0 : Math.round((completed / mine.length) * 100),
      };
    });
    return { class: { id: item.id, name: item.name, studentCount: students.length, ...classStats(classId) }, students: withStats };
  });
}

export async function addStudent(teacherId: string, classId: string, input: { name: unknown; email: unknown; password: unknown }) {
  const name = requireText(input.name, 'Student name', 80);
  const email = requireText(input.email, 'Email', 120).toLowerCase();
  const password = String(input.password ?? '');
  if (!email.includes('@')) throw new HttpError(400, 'Enter a valid email.');
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');
  const passwordHash = await hashPassword(password);
  return withDb(() => {
    const owned = db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(classId, teacherId);
    if (!owned) throw new HttpError(404, 'Class not found.');
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) throw new HttpError(400, 'That email is already registered.');
    const studentId = id();
    const created = nowIso();
    db.prepare('INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      studentId,
      email,
      passwordHash,
      name,
      'student',
      created,
    );
    db.prepare('INSERT INTO class_members (class_id, student_id, created_at) VALUES (?, ?, ?)').run(classId, studentId, created);
    return { id: studentId, name, email };
  });
}

export async function updateStudent(teacherId: string, studentId: string, input: { name: unknown; email: unknown; password?: unknown }) {
  const name = requireText(input.name, 'Student name', 80);
  const email = requireText(input.email, 'Email', 120).toLowerCase();
  if (!email.includes('@')) throw new HttpError(400, 'Enter a valid email.');
  const password = String(input.password ?? '');
  const passwordHash = password ? await hashPassword(password) : null;
  if (password && password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');
  return withDb(() => {
    const member = db
      .prepare(
        `SELECT m.student_id FROM class_members m
         JOIN classes c ON c.id = m.class_id
         WHERE m.student_id = ? AND c.teacher_id = ?`,
      )
      .get(studentId, teacherId);
    if (!member) throw new HttpError(404, 'Student not found.');
    const clash = db.prepare('SELECT id FROM users WHERE email = ? AND id <> ?').get(email, studentId);
    if (clash) throw new HttpError(400, 'That email is already registered.');
    db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email, studentId);
    if (passwordHash) db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, studentId);
    return { id: studentId, name, email };
  });
}

export function deleteStudent(teacherId: string, studentId: string) {
  return withDb(() => {
    const member = db
      .prepare(
        `SELECT m.student_id FROM class_members m
         JOIN classes c ON c.id = m.class_id
         WHERE m.student_id = ? AND c.teacher_id = ?`,
      )
      .get(studentId, teacherId);
    if (!member) throw new HttpError(404, 'Student not found.');
    db.prepare('DELETE FROM users WHERE id = ? AND role = ?').run(studentId, 'student');
    return { ok: true };
  });
}

function summarizeTask(taskId: string) {
  const task = db
    .prepare(
      `SELECT t.*, c.name AS class_name FROM tasks t
       JOIN classes c ON c.id = t.class_id WHERE t.id = ?`,
    )
    .get(taskId) as Record<string, string> | undefined;
  if (!task) throw new HttpError(404, 'Task not found.');
  const rows = db.prepare(`${assignmentSelect} WHERE t.id = ?`).all(taskId) as unknown as AssignmentRow[];
  const cards = rows.map(mapAssignment);
  const completed = cards.filter((card) => card.status === 'on_time' || card.status === 'late').length;
  const pending = cards.filter((card) => card.status === 'pending').length;
  const overdue = cards.filter((card) => card.status === 'overdue').length;
  return {
    task: {
      id: task.id,
      seriesId: task.series_id,
      classId: task.class_id,
      className: task.class_name,
      title: task.title,
      description: task.description,
      instructions: task.instructions,
      priority: task.priority as Priority,
      penalty: task.penalty,
      assignmentDate: task.assignment_date,
      deadlineDate: task.deadline_date,
      deadlineTime: task.deadline_time,
      deadlineAt: new Date(deadlineMs(task.deadline_date, task.deadline_time)).toISOString(),
      recurrence: task.recurrence as Recurrence,
      color: task.color as NoteColor,
      taskStatus: task.status as 'active' | 'cancelled',
      assignedCount: cards.length,
      completedCount: completed,
      pendingCount: pending,
      overdueCount: overdue,
      completionRate: cards.length === 0 ? 0 : Math.round((completed / cards.length) * 100),
      studentNames: cards.map((card) => card.studentName),
    },
    assignments: cards,
  };
}

export type TaskInput = {
  title: unknown;
  description: unknown;
  instructions: unknown;
  classId: unknown;
  studentId?: unknown;
  assignmentDate: unknown;
  deadlineDate: unknown;
  deadlineTime: unknown;
  priority: unknown;
  penalty: unknown;
  color: unknown;
  recurrence: unknown;
  weekdays?: unknown;
  customDates?: unknown;
  horizonDays?: unknown;
  studentIds?: string[];
};

function readTaskInput(input: TaskInput) {
  const title = requireText(input.title, 'Title', 120);
  const description = clean(input.description, 2000);
  const instructions = clean(input.instructions, 2000);
  const penalty = clean(input.penalty, 500);
  const classId = requireText(input.classId, 'Class', 80);
  const assignmentDate = requireText(input.assignmentDate, 'Assignment date', 10);
  const deadlineDate = requireText(input.deadlineDate, 'Deadline date', 10);
  const deadlineTime = requireText(input.deadlineTime, 'Deadline time', 5);
  if (!isIsoDate(assignmentDate) || !isIsoDate(deadlineDate)) throw new HttpError(400, 'Use real dates.');
  if (!isHm(deadlineTime)) throw new HttpError(400, 'Use a deadline time like 20:00.');
  const priority = String(input.priority) as Priority;
  if (!PRIORITIES.has(priority)) throw new HttpError(400, 'Choose a priority.');
  const color = String(input.color || 'yellow') as NoteColor;
  if (!COLORS.has(color)) throw new HttpError(400, 'Choose a note color.');
  const recurrence = String(input.recurrence || 'once') as Recurrence;
  if (!['once', 'daily', 'weekly', 'custom'].includes(recurrence)) throw new HttpError(400, 'Choose a schedule.');
  const weekdays = Array.isArray(input.weekdays) ? input.weekdays.map(Number).filter((day) => day >= 0 && day <= 6) : [];
  const customDates = Array.isArray(input.customDates) ? input.customDates.map((date) => String(date)) : [];
  const horizonDays = input.horizonDays == null || input.horizonDays === '' ? 14 : Number(input.horizonDays);
  let instances;
  try {
    instances = planInstances({ recurrence, assignmentDate, deadlineDate, weekdays, customDates, horizonDays });
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : 'Invalid schedule.');
  }
  return { title, description, instructions, penalty, classId, priority, color, recurrence, deadlineTime, instances, studentId: clean(input.studentId, 80) };
}

export function createTask(teacherId: string, input: TaskInput) {
  const parsed = readTaskInput(input);
  return withDb(() => {
    const owned = db.prepare('SELECT id, name FROM classes WHERE id = ? AND teacher_id = ?').get(parsed.classId, teacherId) as
      | { id: string; name: string }
      | undefined;
    if (!owned) throw new HttpError(404, 'Class not found.');
    let studentIds = input.studentIds;
    if (!studentIds) {
      if (parsed.studentId) studentIds = [parsed.studentId];
      else {
        studentIds = (db.prepare('SELECT student_id FROM class_members WHERE class_id = ?').all(parsed.classId) as { student_id: string }[]).map(
          (row) => row.student_id,
        );
      }
    }
    for (const studentId of studentIds) {
      const member = db.prepare('SELECT student_id FROM class_members WHERE class_id = ? AND student_id = ?').get(parsed.classId, studentId);
      if (!member) throw new HttpError(400, 'That student is not in this class.');
    }
    const seriesId = id();
    const created = nowIso();
    const events: LiveEvent[] = [];
    const taskIds: string[] = [];
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const instance of parsed.instances) {
        const taskId = id();
        taskIds.push(taskId);
        db.prepare(
          `INSERT INTO tasks (
            id, series_id, teacher_id, class_id, title, description, instructions, priority, penalty,
            assignment_date, deadline_date, deadline_time, recurrence, color, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        ).run(
          taskId,
          seriesId,
          teacherId,
          parsed.classId,
          parsed.title,
          parsed.description,
          parsed.instructions,
          parsed.priority,
          parsed.penalty,
          instance.assignmentDate,
          instance.deadlineDate,
          parsed.deadlineTime,
          parsed.recurrence,
          parsed.color,
          created,
          created,
        );
        for (const studentId of studentIds) {
          const assignmentId = id();
          db.prepare('INSERT INTO task_assignments (id, task_id, student_id, in_progress, created_at) VALUES (?, ?, ?, 0, ?)').run(
            assignmentId,
            taskId,
            studentId,
            created,
          );
          insertNotification(
            studentId,
            'task_assigned',
            'New task assigned',
            `${parsed.title} is due ${instance.deadlineDate} at ${parsed.deadlineTime}.`,
            assignmentId,
            events,
          );
        }
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    const tasks = taskIds.map((taskId) => summarizeTask(taskId).task);
    return { tasks, events };
  }).then((result) => {
    publish(result.events);
    return result.tasks;
  });
}

export function listTeacherTasks(teacherId: string) {
  return withDb(() => {
    const ids = db.prepare('SELECT id FROM tasks WHERE teacher_id = ? ORDER BY deadline_date, deadline_time, title').all(teacherId) as {
      id: string;
    }[];
    return ids.map((row) => summarizeTask(row.id).task);
  });
}

export function getTeacherTask(teacherId: string, taskId: string) {
  return withDb(() => {
    const owned = db.prepare('SELECT id FROM tasks WHERE id = ? AND teacher_id = ?').get(taskId, teacherId);
    if (!owned) throw new HttpError(404, 'Task not found.');
    return summarizeTask(taskId);
  });
}

export function updateTask(teacherId: string, taskId: string, input: TaskInput & { applyToSeries?: unknown }) {
  const title = requireText(input.title, 'Title', 120);
  const description = clean(input.description, 2000);
  const instructions = clean(input.instructions, 2000);
  const penalty = clean(input.penalty, 500);
  const deadlineDate = requireText(input.deadlineDate, 'Deadline date', 10);
  const deadlineTime = requireText(input.deadlineTime, 'Deadline time', 5);
  const assignmentDate = requireText(input.assignmentDate, 'Assignment date', 10);
  if (!isIsoDate(deadlineDate) || !isIsoDate(assignmentDate) || !isHm(deadlineTime)) throw new HttpError(400, 'Check the dates and time.');
  const priority = String(input.priority) as Priority;
  const color = String(input.color) as NoteColor;
  if (!PRIORITIES.has(priority) || !COLORS.has(color)) throw new HttpError(400, 'Check priority and color.');
  const applyToSeries = Boolean(input.applyToSeries);
  return withDb(() => {
    const current = db.prepare('SELECT * FROM tasks WHERE id = ? AND teacher_id = ?').get(taskId, teacherId) as Record<string, string> | undefined;
    if (!current) throw new HttpError(404, 'Task not found.');
    const events: LiveEvent[] = [];
    const updated = nowIso();
    const targets = applyToSeries
      ? (db
          .prepare('SELECT * FROM tasks WHERE series_id = ? AND teacher_id = ? AND assignment_date >= ?')
          .all(current.series_id, teacherId, current.assignment_date) as Record<string, string>[])
      : [current];
    for (const target of targets) {
      const nextDeadlineDate = target.id === taskId ? deadlineDate : target.deadline_date;
      const nextAssignmentDate = target.id === taskId ? assignmentDate : target.assignment_date;
      const deadlineChanged = nextDeadlineDate !== target.deadline_date || deadlineTime !== target.deadline_time;
      const contentChanged =
        title !== target.title || description !== target.description || instructions !== target.instructions || penalty !== target.penalty || priority !== target.priority;
      db.prepare(
        `UPDATE tasks SET title = ?, description = ?, instructions = ?, penalty = ?, priority = ?, color = ?,
         deadline_date = ?, deadline_time = ?, assignment_date = ?, updated_at = ? WHERE id = ?`,
      ).run(title, description, instructions, penalty, priority, color, nextDeadlineDate, deadlineTime, nextAssignmentDate, updated, target.id);
      if (target.status !== 'active') continue;
      const students = db.prepare('SELECT id, student_id FROM task_assignments WHERE task_id = ?').all(target.id) as { id: string; student_id: string }[];
      for (const student of students) {
        if (deadlineChanged) {
          insertNotification(student.student_id, 'deadline_changed', 'Task deadline changed', `${title} is now due ${nextDeadlineDate} at ${deadlineTime}.`, `${target.id}:${nextDeadlineDate}:${deadlineTime}`, events);
        } else if (contentChanged) {
          insertNotification(student.student_id, 'task_updated', 'Task updated', `${title} was updated.`, `${target.id}:${updated}`, events);
        }
      }
    }
    const detail = summarizeTask(taskId);
    return { ...detail, events };
  }).then((result) => {
    publish(result.events);
    return { task: result.task, assignments: result.assignments };
  });
}

export function duplicateTask(teacherId: string, taskId: string) {
  return withDb(() => {
    const current = db.prepare('SELECT * FROM tasks WHERE id = ? AND teacher_id = ?').get(taskId, teacherId) as Record<string, string> | undefined;
    if (!current) throw new HttpError(404, 'Task not found.');
    const studentIds = (db.prepare('SELECT student_id FROM task_assignments WHERE task_id = ?').all(taskId) as { student_id: string }[]).map((row) => row.student_id);
    return {
      classId: current.class_id,
      title: `${current.title} (copy)`,
      description: current.description,
      instructions: current.instructions,
      penalty: current.penalty,
      priority: current.priority,
      color: current.color,
      assignmentDate: current.assignment_date,
      deadlineDate: current.deadline_date,
      deadlineTime: current.deadline_time,
      recurrence: 'once',
      studentIds,
    };
  }).then((copy) => createTask(teacherId, copy));
}

export function cancelTask(teacherId: string, taskId: string) {
  return withDb(() => {
    const current = db.prepare('SELECT * FROM tasks WHERE id = ? AND teacher_id = ?').get(taskId, teacherId) as Record<string, string> | undefined;
    if (!current) throw new HttpError(404, 'Task not found.');
    const events: LiveEvent[] = [];
    db.prepare(`UPDATE tasks SET status = 'cancelled', updated_at = ? WHERE id = ?`).run(nowIso(), taskId);
    const students = db.prepare('SELECT student_id FROM task_assignments WHERE task_id = ?').all(taskId) as { student_id: string }[];
    for (const student of students) {
      insertNotification(student.student_id, 'task_updated', 'Task cancelled', `${current.title} was cancelled.`, `${taskId}:cancelled`, events);
    }
    const detail = summarizeTask(taskId);
    return { ...detail, events };
  }).then((result) => {
    publish(result.events);
    return result.task;
  });
}

export function deleteTask(teacherId: string, taskId: string) {
  return withDb(() => {
    const current = db.prepare('SELECT * FROM tasks WHERE id = ? AND teacher_id = ?').get(taskId, teacherId) as Record<string, string> | undefined;
    if (!current) throw new HttpError(404, 'Task not found.');
    const events: LiveEvent[] = [];
    const students = db.prepare('SELECT student_id FROM task_assignments WHERE task_id = ?').all(taskId) as { student_id: string }[];
    for (const student of students) {
      insertNotification(student.student_id, 'task_updated', 'Task deleted', `${current.title} was deleted.`, `${taskId}:deleted`, events);
    }
    db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
    return { events };
  }).then((result) => {
    publish(result.events);
    return { ok: true };
  });
}

function recordCompletion(studentId: string, assignmentId: string, completedAt: string) {
  const row = db.prepare(`${assignmentSelect} WHERE a.id = ?`).get(assignmentId) as unknown as AssignmentRow | undefined;
  if (!row || row.student_id !== studentId || row.task_status !== 'active') throw new HttpError(404, 'Task not found.');
  const events: LiveEvent[] = [];
  db.exec('BEGIN IMMEDIATE');
  try {
    const existing = db.prepare('SELECT id FROM task_completions WHERE assignment_id = ?').get(assignmentId);
    if (existing) {
      db.exec('ROLLBACK');
      throw new HttpError(409, 'This task is already marked complete.');
    }
    db.prepare('INSERT INTO task_completions (id, assignment_id, completed_at) VALUES (?, ?, ?)').run(id(), assignmentId, completedAt);
    db.prepare('UPDATE task_assignments SET in_progress = 0, submitted_at = NULL WHERE id = ?').run(assignmentId);
    db.exec('COMMIT');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    try {
      db.exec('ROLLBACK');
    } catch {
      /* already closed */
    }
    if (String(error).includes('UNIQUE')) throw new HttpError(409, 'This task is already marked complete.');
    throw error;
  }
  const fresh = db.prepare(`${assignmentSelect} WHERE a.id = ?`).get(assignmentId) as unknown as AssignmentRow;
  const card = mapAssignment(fresh);
  const totals = classStats(row.class_id);
  insertNotification(
    row.teacher_id,
    'task_completed',
    'Student completed a task',
    `${row.student_name} completed “${row.title}”. Class progress: ${totals.completedCount}/${totals.assignedCount} (${totals.completionRate}%).`,
    assignmentId,
    events,
  );
  return { card, events };
}

export function completeAssignment(studentId: string, assignmentId: string) {
  return withDb(() => recordCompletion(studentId, assignmentId, nowIso())).then((result) => {
    publish(result.events);
    return result.card;
  });
}

export function completeAssignmentAt(studentId: string, assignmentId: string, completedAt: string) {
  return withDb(() => recordCompletion(studentId, assignmentId, completedAt)).then((result) => {
    publish(result.events);
    return result.card;
  });
}

export function reopenAssignment(teacherId: string, assignmentId: string) {
  return withDb(() => {
    const row = db.prepare(`${assignmentSelect} WHERE a.id = ? AND t.teacher_id = ?`).get(assignmentId, teacherId) as unknown as AssignmentRow | undefined;
    if (!row) throw new HttpError(404, 'Assignment not found.');
    db.prepare('DELETE FROM task_completions WHERE assignment_id = ?').run(assignmentId);
    db.prepare('UPDATE task_assignments SET in_progress = 0, submitted_at = NULL, revision_deadline_at = NULL WHERE id = ?').run(assignmentId);
    const events: LiveEvent[] = [];
    insertNotification(row.student_id, 'task_updated', 'Task reopened', `${row.title} was reopened by your teacher.`, `${assignmentId}:reopened:${nowIso()}`, events);
    const fresh = db.prepare(`${assignmentSelect} WHERE a.id = ?`).get(assignmentId) as unknown as AssignmentRow;
    return { card: mapAssignment(fresh), events };
  }).then((result) => {
    publish(result.events);
    return result.card;
  });
}

export function markAssignmentSubmitted(studentId: string, assignmentId: string, submittedAt: string) {
  return withDb(() => {
    const row = db.prepare(`${assignmentSelect} WHERE a.id = ? AND a.student_id = ? AND t.status = 'active'`).get(assignmentId, studentId) as AssignmentRow | undefined;
    if (!row) throw new HttpError(404, 'Task not found.');
    if (row.completed_at) throw new HttpError(409, 'This task is already complete.');
    db.prepare('UPDATE task_assignments SET submitted_at = ?, in_progress = 0 WHERE id = ?').run(submittedAt, assignmentId);
    recordSubmissionRewardsLocked(studentId, assignmentId, submittedAt);
    return mapAssignment(db.prepare(`${assignmentSelect} WHERE a.id = ?`).get(assignmentId) as AssignmentRow);
  });
}

export function requestAssignmentRevision(teacherId: string, assignmentId: string, reviewedAt: string) {
  return withDb(() => {
    const row = db.prepare(`${assignmentSelect} WHERE a.id = ? AND t.teacher_id = ?`).get(assignmentId, teacherId) as AssignmentRow | undefined;
    if (!row) throw new HttpError(404, 'Assignment not found.');
    const revisionDeadline = new Date(new Date(reviewedAt).getTime() + 48 * 60 * 60 * 1000).toISOString();
    db.prepare('UPDATE task_assignments SET submitted_at = NULL, revision_deadline_at = ?, in_progress = 0 WHERE id = ?').run(revisionDeadline, assignmentId);
    flagStreakRevisionLocked(teacherId, assignmentId);
    const events: LiveEvent[] = [];
    insertNotification(row.student_id, 'task_revision_requested', 'Revision requested', `Your teacher asked you to revise “${row.title}”.`, `${assignmentId}:revision:${reviewedAt}`, events);
    publish(events);
    return { revisionDeadlineAt: revisionDeadline };
  });
}

export function startAssignment(studentId: string, assignmentId: string) {
  return withDb(() => {
    const row = db.prepare(`${assignmentSelect} WHERE a.id = ? AND a.student_id = ? AND t.status = 'active'`).get(assignmentId, studentId) as
      | AssignmentRow
      | undefined;
    if (!row) throw new HttpError(404, 'Task not found.');
    if (row.completed_at) throw new HttpError(409, 'This task is already marked complete.');
    db.prepare('UPDATE task_assignments SET in_progress = 1 WHERE id = ?').run(assignmentId);
    const fresh = db.prepare(`${assignmentSelect} WHERE a.id = ?`).get(assignmentId) as unknown as AssignmentRow;
    return mapAssignment(fresh);
  });
}

function weekBuckets(cards: AssignmentCard[]) {
  const today = todayInZone();
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    const count = cards.filter((card) => card.completedAt && dateTimeKey(card.completedAt) === date).length;
    return { date, count };
  });
}

function dateTimeKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

function statsFrom(cards: AssignmentCard[]) {
  const completed = cards.filter((card) => card.status === 'on_time' || card.status === 'late').length;
  const pending = cards.filter((card) => card.status === 'pending').length;
  const overdue = cards.filter((card) => card.status === 'overdue').length;
  return {
    assigned: cards.length,
    completed,
    pending,
    overdue,
    completionRate: cards.length === 0 ? 0 : Math.round((completed / cards.length) * 100),
  };
}

export function teacherOverview(teacherId: string) {
  return withDb(() => {
    sweepLocked();
    const classes = db.prepare('SELECT id, name FROM classes WHERE teacher_id = ? ORDER BY name').all(teacherId) as { id: string; name: string }[];
    const studentCount = (
      db.prepare('SELECT COUNT(*) AS n FROM class_members m JOIN classes c ON c.id = m.class_id WHERE c.teacher_id = ?').get(teacherId) as { n: number }
    ).n;
    const today = todayInZone();
    const taskIds = db.prepare(`SELECT id FROM tasks WHERE teacher_id = ? AND status = 'active'`).all(teacherId) as { id: string }[];
    const tasks = taskIds.map((row) => summarizeTask(row.id).task);
    const rows = db.prepare(`${assignmentSelect} WHERE t.teacher_id = ? AND t.status = 'active'`).all(teacherId) as unknown as AssignmentRow[];
    const cards = rows.map(mapAssignment);
    const stats = statsFrom(cards);
    return {
      stats: {
        classes: classes.length,
        students: studentCount,
        assignedToday: tasks.filter((task) => task.assignmentDate === today).length,
        completed: stats.completed,
        pending: stats.pending,
        overdue: stats.overdue,
        completionRate: stats.completionRate,
      },
      classes: classes.map((item) => ({ id: item.id, name: item.name, studentCount: (db.prepare('SELECT COUNT(*) AS n FROM class_members WHERE class_id = ?').get(item.id) as { n: number }).n, ...classStats(item.id) })),
      tasks,
      weekly: weekBuckets(cards),
    };
  });
}

export function studentOverview(studentId: string) {
  return withDb(() => {
    sweepLocked();
    const rows = db.prepare(`${assignmentSelect} WHERE a.student_id = ? AND t.status = 'active' ORDER BY t.deadline_date, t.deadline_time`).all(studentId) as unknown as AssignmentRow[];
    const cards = rows.map(mapAssignment);
    const today = todayInZone();
    const stats = statsFrom(cards);
    return {
      stats,
      today: cards.filter((card) => card.assignmentDate === today || (card.status === 'pending' && card.deadlineDate === today)),
      upcoming: cards.filter((card) => card.status === 'pending' && card.deadlineDate > today).slice(0, 6),
      completed: cards.filter((card) => card.status === 'on_time' || card.status === 'late'),
      overdue: cards.filter((card) => card.status === 'overdue'),
      weekly: weekBuckets(cards),
    };
  });
}

export function studentTasks(studentId: string) {
  return withDb(() => {
    sweepLocked();
    const rows = db.prepare(`${assignmentSelect} WHERE a.student_id = ? AND t.status = 'active' ORDER BY t.deadline_date, t.deadline_time`).all(studentId) as unknown as AssignmentRow[];
    return rows.map(mapAssignment);
  });
}

export function studentTask(studentId: string, assignmentId: string) {
  return withDb(() => {
    const row = db.prepare(`${assignmentSelect} WHERE a.id = ? AND a.student_id = ? AND t.status = 'active'`).get(assignmentId, studentId) as
      | AssignmentRow
      | undefined;
    if (!row) throw new HttpError(404, 'Task not found.');
    return mapAssignment(row);
  });
}

export function studentProgress(teacherId: string, studentId: string) {
  return withDb(() => {
    const student = db
      .prepare(
        `SELECT u.id, u.name, u.email, c.name AS class_name, c.id AS class_id
         FROM users u
         JOIN class_members m ON m.student_id = u.id
         JOIN classes c ON c.id = m.class_id
         WHERE u.id = ? AND c.teacher_id = ?`,
      )
      .get(studentId, teacherId) as { id: string; name: string; email: string; class_name: string; class_id: string } | undefined;
    if (!student) throw new HttpError(404, 'Student not found.');
    const rows = db.prepare(`${assignmentSelect} WHERE a.student_id = ? AND t.status = 'active' ORDER BY t.deadline_date DESC`).all(studentId) as unknown as AssignmentRow[];
    const cards = rows.map(mapAssignment);
    return { student, stats: statsFrom(cards), assignments: cards, weekly: weekBuckets(cards) };
  });
}

export function listNotifications(userId: string) {
  return withDb(() => {
    sweepLocked();
    const rows = db
      .prepare('SELECT id, type, title, body, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100')
      .all(userId) as { id: string; type: string; title: string; body: string; read_at: string | null; created_at: string }[];
    const notifications = rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      read: Boolean(row.read_at),
      createdAt: row.created_at,
    }));
    return { notifications, unread: notifications.filter((item) => !item.read).length };
  });
}

export function markRead(userId: string, notificationId: string) {
  return withDb(() => {
    db.prepare(`UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL`).run(nowIso(), notificationId, userId);
    return { ok: true };
  });
}

export function markAllRead(userId: string) {
  return withDb(() => {
    db.prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`).run(nowIso(), userId);
    return { ok: true };
  });
}

export function deleteNotification(userId: string, notificationId: string) {
  return withDb(() => {
    db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(notificationId, userId);
    return { ok: true };
  });
}

export function deleteAllNotifications(userId: string) {
  return withDb(() => {
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
    return { ok: true };
  });
}

function sweepLocked(): void {
  const rows = db
    .prepare(
      `${assignmentSelect} WHERE t.status = 'active' AND k.completed_at IS NULL AND a.submitted_at IS NULL`,
    )
    .all() as unknown as AssignmentRow[];
  const events: LiveEvent[] = [];
  const now = Date.now();
  for (const row of rows) {
    const deadline = row.revision_deadline_at ? new Date(row.revision_deadline_at).getTime() : deadlineMs(row.deadline_date, row.deadline_time);
    if (now > deadline) {
      insertNotification(row.student_id, 'task_overdue', 'Task overdue', `${row.title} is past the deadline. Penalty: ${row.penalty || 'None'}.`, row.assignment_id, events);
      insertNotification(row.teacher_id, 'student_overdue', 'Task became overdue', `${row.student_name} has not completed “${row.title}”.`, row.assignment_id, events);
    } else if (deadline - now <= 3 * 60 * 60 * 1000) {
      insertNotification(row.student_id, 'deadline_soon', 'Deadline approaching', `${row.title} is due ${row.deadline_date} at ${row.deadline_time}.`, row.assignment_id, events);
    }
  }
  publish(events);
}

export function sweepDeadlines() {
  return withDb(() => {
    sweepLocked();
    sweepStreaksLocked();
  });
}
