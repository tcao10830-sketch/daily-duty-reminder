import { HttpError } from './errors.ts';
import { getPostgres } from './postgres.ts';
import { assignmentSelect, insertNotification, mapAssignment, newId, nowIso, requireText, transaction, type AssignmentCard, type AssignmentRow, type Priority, type NoteColor } from './postgres-store.ts';
import { deadlineMs, isHm, isIsoDate, planInstances, type Recurrence } from './time.ts';

const COLORS = new Set<NoteColor>(['yellow', 'pink', 'blue', 'green', 'orange', 'purple']);
const PRIORITIES = new Set<Priority>(['low', 'medium', 'high']);

export type TaskInput = {
  title: unknown; description: unknown; instructions: unknown; classId: unknown;
  studentId?: unknown; assignmentDate: unknown; deadlineDate: unknown; deadlineTime: unknown;
  priority: unknown; penalty: unknown; color: unknown; recurrence: unknown;
  weekdays?: unknown; customDates?: unknown; horizonDays?: unknown; studentIds?: string[];
  applyToSeries?: unknown;
};

function clean(value: unknown, max: number) { return String(value ?? '').trim().slice(0, max); }

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
  const weekdays = Array.isArray(input.weekdays) ? input.weekdays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6) : [];
  const customDates = Array.isArray(input.customDates) ? input.customDates.map(String) : [];
  const horizonDays = input.horizonDays == null || input.horizonDays === '' ? 14 : Number(input.horizonDays);
  let instances;
  try {
    instances = planInstances({ recurrence, assignmentDate, deadlineDate, weekdays, customDates, horizonDays });
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : 'Invalid schedule.');
  }
  return { title, description, instructions, penalty, classId, priority, color, recurrence, deadlineTime, instances, studentId: clean(input.studentId, 80) };
}

async function summarizeTask(taskId: string) {
  const result = await getPostgres().query(
    `SELECT t.*, c.name AS class_name FROM public.tasks t
     JOIN public.classes c ON c.id = t.class_id WHERE t.id = $1`,
    [taskId],
  );
  const task = result.rows[0];
  if (!task) throw new HttpError(404, 'Task not found.');
  const assignments = await getPostgres().query<AssignmentRow>(`${assignmentSelect} WHERE t.id = $1`, [taskId]);
  const cards: AssignmentCard[] = assignments.rows.map(mapAssignment);
  const completedCount = cards.filter((card) => card.status === 'on_time' || card.status === 'late').length;
  const pendingCount = cards.filter((card) => card.status === 'pending').length;
  const overdueCount = cards.filter((card) => card.status === 'overdue').length;
  return {
    task: {
      id: task.id, seriesId: task.series_id, classId: task.class_id, className: task.class_name,
      title: task.title, description: task.description, instructions: task.instructions,
      priority: task.priority, penalty: task.penalty,
      assignmentDate: String(task.assignment_date).slice(0, 10), deadlineDate: String(task.deadline_date).slice(0, 10),
      deadlineTime: task.deadline_time,
      deadlineAt: new Date(deadlineMs(String(task.deadline_date).slice(0, 10), task.deadline_time)).toISOString(),
      recurrence: task.recurrence, color: task.color, taskStatus: task.status,
      assignedCount: cards.length, completedCount, pendingCount, overdueCount,
      completionRate: cards.length ? Math.round(completedCount / cards.length * 100) : 0,
    },
    assignments: cards,
  };
}

export async function createTask(teacherId: string, input: TaskInput) {
  const parsed = readTaskInput(input);
  const taskIds = await transaction(async (client) => {
    const owned = await client.query('SELECT id FROM public.classes WHERE id = $1 AND teacher_id = $2', [parsed.classId, teacherId]);
    if (!owned.rowCount) throw new HttpError(404, 'Class not found.');
    let studentIds = input.studentIds;
    if (!studentIds) {
      if (parsed.studentId) studentIds = [parsed.studentId];
      else {
        const members = await client.query('SELECT student_id FROM public.class_members WHERE class_id = $1', [parsed.classId]);
        studentIds = members.rows.map((row) => row.student_id as string);
      }
    }
    if (studentIds.length) {
      const members = await client.query(
        'SELECT student_id FROM public.class_members WHERE class_id = $1 AND student_id = ANY($2::text[])',
        [parsed.classId, studentIds],
      );
      if (members.rowCount !== new Set(studentIds).size) throw new HttpError(400, 'That student is not in this class.');
    }
    const seriesId = newId();
    const created = nowIso();
    const createdIds: string[] = [];
    for (const instance of parsed.instances) {
      const taskId = newId();
      createdIds.push(taskId);
      await client.query(
        `INSERT INTO public.tasks (
          id, series_id, teacher_id, class_id, title, description, instructions, priority, penalty,
          assignment_date, deadline_date, deadline_time, recurrence, color, status, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11::date,$12,$13,$14,'active',$15,$15)`,
        [taskId, seriesId, teacherId, parsed.classId, parsed.title, parsed.description, parsed.instructions,
          parsed.priority, parsed.penalty, instance.assignmentDate, instance.deadlineDate, parsed.deadlineTime,
          parsed.recurrence, parsed.color, created],
      );
      for (const studentId of studentIds) {
        const assignmentId = newId();
        await client.query(
          'INSERT INTO public.task_assignments (id, task_id, student_id, in_progress, created_at) VALUES ($1,$2,$3,false,$4)',
          [assignmentId, taskId, studentId, created],
        );
        await insertNotification(client, studentId, 'task_assigned', 'New task assigned',
          `${parsed.title} is due ${instance.deadlineDate} at ${parsed.deadlineTime}.`, assignmentId);
      }
    }
    return createdIds;
  });
  return Promise.all(taskIds.map(async (taskId) => (await summarizeTask(taskId)).task));
}

export async function listTeacherTasks(teacherId: string) {
  const result = await getPostgres().query(
    'SELECT id FROM public.tasks WHERE teacher_id = $1 ORDER BY assignment_date, deadline_time, title',
    [teacherId],
  );
  return Promise.all(result.rows.map(async (row) => (await summarizeTask(row.id)).task));
}

export async function getTeacherTask(teacherId: string, taskId: string) {
  const owned = await getPostgres().query('SELECT id FROM public.tasks WHERE id = $1 AND teacher_id = $2', [taskId, teacherId]);
  if (!owned.rowCount) throw new HttpError(404, 'Task not found.');
  return summarizeTask(taskId);
}

export async function updateTask(teacherId: string, taskId: string, input: TaskInput) {
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
  await transaction(async (client) => {
    const currentResult = await client.query('SELECT * FROM public.tasks WHERE id = $1 AND teacher_id = $2 FOR UPDATE', [taskId, teacherId]);
    const current = currentResult.rows[0];
    if (!current) throw new HttpError(404, 'Task not found.');
    const targets = input.applyToSeries
      ? await client.query('SELECT * FROM public.tasks WHERE series_id = $1 AND teacher_id = $2 AND assignment_date >= $3::date FOR UPDATE',
          [current.series_id, teacherId, current.assignment_date])
      : { rows: [current] };
    const updated = nowIso();
    for (const target of targets.rows) {
      const nextDeadline = target.id === taskId ? deadlineDate : String(target.deadline_date).slice(0, 10);
      const nextDate = target.id === taskId ? assignmentDate : String(target.assignment_date).slice(0, 10);
      const deadlineChanged = nextDeadline !== String(target.deadline_date).slice(0, 10) || deadlineTime !== target.deadline_time;
      const contentChanged = title !== target.title || description !== target.description || instructions !== target.instructions ||
        penalty !== target.penalty || priority !== target.priority;
      await client.query(
        `UPDATE public.tasks SET title=$1, description=$2, instructions=$3, penalty=$4, priority=$5, color=$6,
         deadline_date=$7::date, deadline_time=$8, assignment_date=$9::date, updated_at=$10 WHERE id=$11`,
        [title, description, instructions, penalty, priority, color, nextDeadline, deadlineTime, nextDate, updated, target.id],
      );
      if (target.status !== 'active') continue;
      const students = await client.query('SELECT student_id FROM public.task_assignments WHERE task_id=$1', [target.id]);
      for (const student of students.rows) {
        if (deadlineChanged) await insertNotification(client, student.student_id, 'deadline_changed', 'Task deadline changed',
          `${title} is now due ${nextDeadline} at ${deadlineTime}.`, `${target.id}:${nextDeadline}:${deadlineTime}`);
        else if (contentChanged) await insertNotification(client, student.student_id, 'task_updated', 'Task updated',
          `${title} was updated.`, `${target.id}:${updated}`);
      }
    }
  });
  return summarizeTask(taskId);
}

export async function duplicateTask(teacherId: string, taskId: string) {
  const current = await getPostgres().query('SELECT * FROM public.tasks WHERE id=$1 AND teacher_id=$2', [taskId, teacherId]);
  const task = current.rows[0];
  if (!task) throw new HttpError(404, 'Task not found.');
  const students = await getPostgres().query('SELECT student_id FROM public.task_assignments WHERE task_id=$1', [taskId]);
  return createTask(teacherId, {
    classId: task.class_id, title: `${task.title} (copy)`, description: task.description,
    instructions: task.instructions, penalty: task.penalty, priority: task.priority, color: task.color,
    assignmentDate: String(task.assignment_date).slice(0,10), deadlineDate: String(task.deadline_date).slice(0,10),
    deadlineTime: task.deadline_time, recurrence: 'once', studentIds: students.rows.map((row) => row.student_id),
  });
}

export async function cancelTask(teacherId: string, taskId: string) {
  await transaction(async (client) => {
    const current = await client.query('SELECT title FROM public.tasks WHERE id=$1 AND teacher_id=$2 FOR UPDATE', [taskId, teacherId]);
    if (!current.rowCount) throw new HttpError(404, 'Task not found.');
    await client.query("UPDATE public.tasks SET status='cancelled', updated_at=$1 WHERE id=$2", [nowIso(), taskId]);
    const students = await client.query('SELECT student_id FROM public.task_assignments WHERE task_id=$1', [taskId]);
    for (const student of students.rows) await insertNotification(client, student.student_id, 'task_updated', 'Task cancelled',
      `${current.rows[0].title} was cancelled.`, `${taskId}:cancelled`);
  });
  return (await summarizeTask(taskId)).task;
}

export async function deleteTask(teacherId: string, taskId: string) {
  await transaction(async (client) => {
    const current = await client.query('SELECT title FROM public.tasks WHERE id=$1 AND teacher_id=$2 FOR UPDATE', [taskId, teacherId]);
    if (!current.rowCount) throw new HttpError(404, 'Task not found.');
    const students = await client.query('SELECT student_id FROM public.task_assignments WHERE task_id=$1', [taskId]);
    for (const student of students.rows) await insertNotification(client, student.student_id, 'task_updated', 'Task deleted',
      `${current.rows[0].title} was deleted.`, `${taskId}:deleted`);
    await client.query('DELETE FROM public.tasks WHERE id=$1', [taskId]);
  });
  return { ok: true };
}

export async function studentTasks(studentId: string) {
  const rows = await getPostgres().query<AssignmentRow>(
    `${assignmentSelect} WHERE a.student_id=$1 AND t.status='active' ORDER BY t.deadline_date,t.deadline_time`,
    [studentId],
  );
  return rows.rows.map(mapAssignment);
}

export async function studentTask(studentId: string, assignmentId: string) {
  const rows = await getPostgres().query<AssignmentRow>(
    `${assignmentSelect} WHERE a.id=$1 AND a.student_id=$2 AND t.status='active'`,
    [assignmentId, studentId],
  );
  if (!rows.rowCount) throw new HttpError(404, 'Task not found.');
  return mapAssignment(rows.rows[0]);
}

export async function startAssignment(studentId: string, assignmentId: string) {
  return transaction(async (client) => {
    const found = await client.query<AssignmentRow>(
      `${assignmentSelect} WHERE a.id=$1 AND a.student_id=$2 AND t.status='active' FOR UPDATE OF a`,
      [assignmentId, studentId],
    );
    if (!found.rowCount) throw new HttpError(404, 'Task not found.');
    if (found.rows[0].completed_at) throw new HttpError(409, 'This task is already marked complete.');
    await client.query('UPDATE public.task_assignments SET in_progress=true WHERE id=$1', [assignmentId]);
    const fresh = await client.query<AssignmentRow>(`${assignmentSelect} WHERE a.id=$1`, [assignmentId]);
    return mapAssignment(fresh.rows[0]);
  });
}

export async function completeAssignmentAt(studentId: string, assignmentId: string, completedAt: string) {
  return transaction(async (client) => {
    const found = await client.query<AssignmentRow>(
      `${assignmentSelect} WHERE a.id=$1 AND a.student_id=$2 AND t.status='active' FOR UPDATE OF a`,
      [assignmentId, studentId],
    );
    const row = found.rows[0];
    if (!row) throw new HttpError(404, 'Task not found.');
    if (row.completed_at) throw new HttpError(409, 'This task is already marked complete.');
    await client.query(
      'INSERT INTO public.task_completions (id, assignment_id, completed_at) VALUES ($1,$2,$3)',
      [newId(), assignmentId, completedAt],
    );
    await client.query('UPDATE public.task_assignments SET in_progress=false WHERE id=$1', [assignmentId]);
    const fresh = await client.query<AssignmentRow>(`${assignmentSelect} WHERE a.id=$1`, [assignmentId]);
    const card = mapAssignment(fresh.rows[0]);
    const all = await client.query<AssignmentRow>(`${assignmentSelect} WHERE t.class_id=$1 AND t.status='active'`, [row.class_id]);
    const cards = all.rows.map(mapAssignment);
    const completed = cards.filter((item) => item.status === 'on_time' || item.status === 'late').length;
    await insertNotification(client, row.teacher_id, 'task_completed', 'Student completed a task',
      `${row.student_name} completed “${row.title}”. Class progress: ${completed}/${cards.length} (${cards.length ? Math.round(completed/cards.length*100) : 0}%).`,
      assignmentId);
    return card;
  }).catch((error) => {
    if ((error as { code?: string })?.code === '23505') throw new HttpError(409, 'This task is already marked complete.');
    throw error;
  });
}

export async function completeAssignment(studentId: string, assignmentId: string) {
  return completeAssignmentAt(studentId, assignmentId, nowIso());
}

export async function reopenAssignment(teacherId: string, assignmentId: string) {
  return transaction(async (client) => {
    const found = await client.query(
      `${assignmentSelect} WHERE a.id=$1 AND t.teacher_id=$2 FOR UPDATE OF a`,
      [assignmentId, teacherId],
    );
    const row = found.rows[0];
    if (!row) throw new HttpError(404, 'Assignment not found.');
    await client.query('DELETE FROM public.task_completions WHERE assignment_id=$1', [assignmentId]);
    await client.query('UPDATE public.task_assignments SET in_progress=false WHERE id=$1', [assignmentId]);
    await insertNotification(client, row.student_id, 'task_updated', 'Task reopened',
      `${row.title} was reopened by your teacher.`, `${assignmentId}:reopened:${nowIso()}`);
    const fresh = await client.query<AssignmentRow>(`${assignmentSelect} WHERE a.id=$1`, [assignmentId]);
    return mapAssignment(fresh.rows[0]);
  });
}

export async function sweepDeadlines() {
  return transaction(async (client) => {
    const result = await client.query<AssignmentRow>(`${assignmentSelect} WHERE t.status='active' AND k.completed_at IS NULL`);
    const now = Date.now();
    for (const row of result.rows) {
      const deadline = deadlineMs(String(row.deadline_date).slice(0,10), row.deadline_time);
      if (now > deadline) {
        await insertNotification(client, row.student_id, 'task_overdue', 'Task overdue',
          `${row.title} is past the deadline. Penalty: ${row.penalty || 'None'}.`, row.assignment_id);
        await insertNotification(client, row.teacher_id, 'student_overdue', 'Task became overdue',
          `${row.student_name} has not completed “${row.title}”.`, row.assignment_id);
      } else if (deadline - now <= 3 * 60 * 60 * 1000) {
        await insertNotification(client, row.student_id, 'deadline_soon', 'Deadline approaching',
          `${row.title} is due ${String(row.deadline_date).slice(0,10)} at ${row.deadline_time}.`, row.assignment_id);
      }
    }
  });
}
