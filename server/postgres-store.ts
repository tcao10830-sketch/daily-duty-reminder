import type { PoolClient, QueryResultRow } from 'pg';
import { randomUUID } from 'node:crypto';
import { getPostgres } from './postgres.ts';
import { HttpError } from './errors.ts';
import { completionStatus, deadlineMs, type CompletionStatus, type Recurrence } from './time.ts';

export type Role = 'teacher' | 'student';
export type Priority = 'low' | 'medium' | 'high';
export type NoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'orange' | 'purple';
export type PublicUser = { id: string; name: string; email: string; role: Role };

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
  completedAt: string | null;
  status: CompletionStatus;
};

export type AssignmentRow = QueryResultRow & {
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
  in_progress: boolean;
  completed_at: Date | string | null;
  teacher_id: string;
};

export const assignmentSelect = `
  SELECT
    a.id AS assignment_id,
    a.in_progress,
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
    t.assignment_date::text AS assignment_date,
    t.deadline_date::text AS deadline_date,
    t.deadline_time,
    t.priority,
    t.penalty,
    t.color,
    t.recurrence,
    t.status AS task_status,
    k.completed_at
  FROM public.task_assignments a
  JOIN public.tasks t ON t.id = a.task_id
  JOIN public.classes c ON c.id = t.class_id
  JOIN public.users u ON u.id = a.student_id
  LEFT JOIN public.task_completions k ON k.assignment_id = a.id
`;

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function clean(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

export function requireText(value: unknown, label: string, max: number): string {
  const valueText = clean(value, max);
  if (!valueText) throw new HttpError(400, `${label} is required.`);
  return valueText;
}

export function isoTimestamp(value: Date | string | null): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function mapAssignment(row: AssignmentRow): AssignmentCard {
  const completedAt = isoTimestamp(row.completed_at);
  const status = completionStatus(completedAt, row.deadline_date, row.deadline_time);
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
    deadlineDate: row.deadline_date,
    deadlineTime: row.deadline_time,
    deadlineAt: new Date(deadlineMs(row.deadline_date, row.deadline_time)).toISOString(),
    priority: row.priority,
    penalty: row.penalty,
    color: row.color,
    recurrence: row.recurrence,
    taskStatus: row.task_status,
    inProgress: Boolean(row.in_progress) && !completedAt && status === 'pending',
    completedAt,
    status,
  };
}

/** Use one checked-out client for each multi-query transaction. */
export async function transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPostgres().connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original query/transaction error.
    }
    throw error;
  } finally {
    client.release();
  }
}

/** Insert idempotent notifications and return true only for a newly-created row. */
export async function insertNotification(
  client: PoolClient,
  userId: string,
  type: string,
  title: string,
  body: string,
  entityId: string,
): Promise<boolean> {
  const result = await client.query(
    `INSERT INTO public.notifications (id, user_id, type, title, body, entity_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, type, entity_id) DO NOTHING
     RETURNING id`,
    [newId(), userId, type, title, body, entityId, nowIso()],
  );
  return result.rowCount === 1;
}
