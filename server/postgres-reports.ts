import { HttpError } from './errors.ts';
import { getPostgres } from './postgres.ts';
import { assignmentSelect, mapAssignment, type AssignmentRow, type AssignmentCard } from './postgres-store.ts';
import { addDays, todayInZone } from './time.ts';
import { sweepDeadlines } from './postgres-tasks.ts';

function dateTimeKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

function weekBuckets(cards: AssignmentCard[]) {
  const today = todayInZone();
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    const count = cards.filter((card) => card.completedAt && dateTimeKey(card.completedAt) === date).length;
    return { date, count };
  });
}

function statsFrom(cards: AssignmentCard[]) {
  const completed = cards.filter((card) => card.status === 'on_time' || card.status === 'late').length;
  const pending = cards.filter((card) => card.status === 'pending').length;
  const overdue = cards.filter((card) => card.status === 'overdue').length;
  return {
    assigned: cards.length, completed, pending, overdue,
    completionRate: cards.length ? Math.round(completed / cards.length * 100) : 0,
  };
}

async function classStats(classId: string) {
  const result = await getPostgres().query<AssignmentRow>(
    `${assignmentSelect} WHERE t.class_id=$1 AND t.status='active'`,
    [classId],
  );
  const cards = result.rows.map(mapAssignment);
  const completed = cards.filter((card) => card.status === 'on_time' || card.status === 'late').length;
  const pending = cards.filter((card) => card.status === 'pending').length;
  const overdue = cards.filter((card) => card.status === 'overdue').length;
  return {
    assignedCount: cards.length, completedCount: completed, pendingCount: pending, overdueCount: overdue,
    completionRate: cards.length ? Math.round(completed / cards.length * 100) : 0,
  };
}

export async function teacherOverview(teacherId: string) {
  await sweepDeadlines();
  const today = todayInZone();
  const [classesResult, studentResult, taskIds, rows] = await Promise.all([
    getPostgres().query('SELECT id, name FROM public.classes WHERE teacher_id=$1 ORDER BY name', [teacherId]),
    getPostgres().query('SELECT COUNT(*)::int AS n FROM public.class_members m JOIN public.classes c ON c.id=m.class_id WHERE c.teacher_id=$1', [teacherId]),
    getPostgres().query("SELECT id FROM public.tasks WHERE teacher_id=$1 AND status='active'", [teacherId]),
    getPostgres().query<AssignmentRow>(`${assignmentSelect} WHERE t.teacher_id=$1 AND t.status='active'`, [teacherId]),
  ]);
  const cards: AssignmentCard[] = rows.rows.map(mapAssignment);
  const stats = statsFrom(cards);
  const tasks = await Promise.all(taskIds.rows.map(async (row) => {
    const detail = await getPostgres().query(
      `SELECT t.*, c.name AS class_name FROM public.tasks t JOIN public.classes c ON c.id=t.class_id WHERE t.id=$1`,
      [row.id],
    );
    const t = detail.rows[0];
    if (!t) return null;
    const taskCards = cards.filter((card) => card.taskId === t.id);
    const completedCount = taskCards.filter((card) => card.status === 'on_time' || card.status === 'late').length;
    return {
      id: t.id, seriesId: t.series_id, classId: t.class_id, className: t.class_name, title: t.title,
      description: t.description, instructions: t.instructions, priority: t.priority, penalty: t.penalty,
      assignmentDate: String(t.assignment_date).slice(0,10), deadlineDate: String(t.deadline_date).slice(0,10),
      deadlineTime: t.deadline_time, deadlineAt: new Date(`${String(t.deadline_date).slice(0,10)}T${t.deadline_time}:00+07:00`).toISOString(),
      recurrence: t.recurrence, color: t.color, taskStatus: t.status,
      assignedCount: taskCards.length, completedCount,
      pendingCount: taskCards.filter((card) => card.status === 'pending').length,
      overdueCount: taskCards.filter((card) => card.status === 'overdue').length,
      completionRate: taskCards.length ? Math.round(completedCount / taskCards.length * 100) : 0,
    };
  }));
  const classCards = await Promise.all(classesResult.rows.map(async (item) => {
    const [count, totals] = await Promise.all([
      getPostgres().query('SELECT COUNT(*)::int AS n FROM public.class_members WHERE class_id=$1', [item.id]),
      classStats(item.id),
    ]);
    return { id: item.id, name: item.name, studentCount: count.rows[0].n, ...totals };
  }));
  return {
    stats: {
      classes: classesResult.rowCount, students: studentResult.rows[0].n,
      assignedToday: tasks.filter((task) => task?.assignmentDate === today).length,
      completed: stats.completed, pending: stats.pending, overdue: stats.overdue, completionRate: stats.completionRate,
    },
    classes: classCards, tasks: tasks.filter(Boolean), weekly: weekBuckets(cards),
  };
}

export async function studentOverview(studentId: string) {
  await sweepDeadlines();
  const rows = await getPostgres().query<AssignmentRow>(
    `${assignmentSelect} WHERE a.student_id=$1 AND t.status='active' ORDER BY t.deadline_date,t.deadline_time`,
    [studentId],
  );
  const cards: AssignmentCard[] = rows.rows.map(mapAssignment);
  const today = todayInZone();
  return {
    stats: statsFrom(cards),
    today: cards.filter((card) => card.assignmentDate === today || (card.status === 'pending' && card.deadlineDate === today)),
    upcoming: cards.filter((card) => card.status === 'pending' && card.deadlineDate > today).slice(0, 6),
    completed: cards.filter((card) => card.status === 'on_time' || card.status === 'late'),
    overdue: cards.filter((card) => card.status === 'overdue'),
    weekly: weekBuckets(cards),
  };
}

export async function studentProgress(teacherId: string, studentId: string) {
  const studentResult = await getPostgres().query(
    `SELECT u.id, u.name, u.email, c.name AS class_name, c.id AS class_id
     FROM public.users u JOIN public.class_members m ON m.student_id=u.id
     JOIN public.classes c ON c.id=m.class_id
     WHERE u.id=$1 AND c.teacher_id=$2`,
    [studentId, teacherId],
  );
  const student = studentResult.rows[0];
  if (!student) throw new HttpError(404, 'Student not found.');
  const rows = await getPostgres().query<AssignmentRow>(
    `${assignmentSelect} WHERE a.student_id=$1 AND t.status='active' ORDER BY t.deadline_date DESC`,
    [studentId],
  );
  const cards: AssignmentCard[] = rows.rows.map(mapAssignment);
  return { student, stats: statsFrom(cards), assignments: cards, weekly: weekBuckets(cards) };
}

export async function listNotifications(userId: string) {
  await sweepDeadlines();
  const result = await getPostgres().query(
    'SELECT id, type, title, body, read_at, created_at FROM public.notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',
    [userId],
  );
  const notifications = result.rows.map((row) => ({
    id: row.id, type: row.type, title: row.title, body: row.body,
    read: Boolean(row.read_at), createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  }));
  return { notifications, unread: notifications.filter((item) => !item.read).length };
}

export async function markRead(userId: string, notificationId: string) {
  await getPostgres().query(
    'UPDATE public.notifications SET read_at=$1 WHERE id=$2 AND user_id=$3 AND read_at IS NULL',
    [new Date().toISOString(), notificationId, userId],
  );
  return { ok: true };
}

export async function markAllRead(userId: string) {
  await getPostgres().query(
    'UPDATE public.notifications SET read_at=$1 WHERE user_id=$2 AND read_at IS NULL',
    [new Date().toISOString(), userId],
  );
  return { ok: true };
}
