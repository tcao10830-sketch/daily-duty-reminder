import { HttpError } from './errors.ts';
import { getPostgres } from './postgres.ts';
import { transaction } from './postgres-store.ts';
import { assignmentSelect, mapAssignment, newId, nowIso, requireText, type AssignmentCard } from './postgres-store.ts';
import { hashPassword } from './auth.ts';

type StudentRow = { id: string; name: string; email?: string };
type ClassRow = { id: string; name: string };

function stats(cards: AssignmentCard[]) {
  const completed = cards.filter((card) => card.status === 'on_time' || card.status === 'late').length;
  const pending = cards.filter((card) => card.status === 'pending').length;
  const overdue = cards.filter((card) => card.status === 'overdue').length;
  return {
    assignedCount: cards.length,
    completedCount: completed,
    pendingCount: pending,
    overdueCount: overdue,
    completionRate: cards.length ? Math.round((completed / cards.length) * 100) : 0,
  };
}

async function classCards(classId: string): Promise<AssignmentCard[]> {
  const result = await getPostgres().query(
    `${assignmentSelect} WHERE t.class_id = $1 AND t.status = 'active'`,
    [classId],
  );
  return result.rows.map(mapAssignment);
}

export async function listClasses(teacherId: string) {
  const classes = await getPostgres().query<ClassRow>(
    'SELECT id, name FROM public.classes WHERE teacher_id = $1 ORDER BY name',
    [teacherId],
  );
  return Promise.all(classes.rows.map(async (item) => {
    const [students, cards] = await Promise.all([
      getPostgres().query<StudentRow>(
        `SELECT u.id, u.name FROM public.users u
         JOIN public.class_members m ON m.student_id = u.id
         WHERE m.class_id = $1 ORDER BY u.name`,
        [item.id],
      ),
      classCards(item.id),
    ]);
    return {
      id: item.id,
      name: item.name,
      studentCount: students.rowCount,
      students: students.rows,
      ...stats(cards),
    };
  }));
}

export async function createClass(teacherId: string, nameRaw: unknown) {
  const name = requireText(nameRaw, 'Class name', 40);
  const id = newId();
  try {
    await getPostgres().query(
      'INSERT INTO public.classes (id, teacher_id, name, created_at) VALUES ($1, $2, $3, $4)',
      [id, teacherId, name, nowIso()],
    );
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') throw new HttpError(400, 'You already have a class with that name.');
    throw error;
  }
  return { id, name, studentCount: 0, students: [], assignedCount: 0, completedCount: 0, pendingCount: 0, overdueCount: 0, completionRate: 0 };
}

export async function renameClass(teacherId: string, classId: string, nameRaw: unknown) {
  const name = requireText(nameRaw, 'Class name', 40);
  const result = await getPostgres().query(
    'UPDATE public.classes SET name = $1 WHERE id = $2 AND teacher_id = $3 RETURNING id',
    [name, classId, teacherId],
  );
  if (!result.rowCount) throw new HttpError(404, 'Class not found.');
  return { id: classId, name };
}

export async function deleteClass(teacherId: string, classId: string) {
  const result = await getPostgres().query(
    'DELETE FROM public.classes WHERE id = $1 AND teacher_id = $2 RETURNING id',
    [classId, teacherId],
  );
  if (!result.rowCount) throw new HttpError(404, 'Class not found.');
  // Membership and task history cascade from the class; student accounts are deliberately retained
  // if they are referenced by other application data or are later re-enrolled.
  return { ok: true };
}

export async function getClassDetail(teacherId: string, classId: string) {
  const owned = await getPostgres().query<ClassRow>(
    'SELECT id, name FROM public.classes WHERE id = $1 AND teacher_id = $2',
    [classId, teacherId],
  );
  const item = owned.rows[0];
  if (!item) throw new HttpError(404, 'Class not found.');
  const [students, cards] = await Promise.all([
    getPostgres().query<StudentRow>(
      `SELECT u.id, u.name, u.email FROM public.users u
       JOIN public.class_members m ON m.student_id = u.id
       WHERE m.class_id = $1 ORDER BY u.name`,
      [classId],
    ),
    classCards(classId),
  ]);
  const withStats = students.rows.map((student) => {
    const mine = cards.filter((card) => card.studentId === student.id);
    const completed = mine.filter((card) => card.status === 'on_time' || card.status === 'late').length;
    return {
      ...student,
      assigned: mine.length,
      completed,
      pending: mine.filter((card) => card.status === 'pending').length,
      overdue: mine.filter((card) => card.status === 'overdue').length,
      completionRate: mine.length ? Math.round((completed / mine.length) * 100) : 0,
    };
  });
  return {
    class: { id: item.id, name: item.name, studentCount: students.rowCount, ...stats(cards) },
    students: withStats,
  };
}

export async function addStudent(
  teacherId: string,
  classId: string,
  input: { name: unknown; email: unknown; password: unknown },
) {
  const name = requireText(input.name, 'Student name', 80);
  const email = requireText(input.email, 'Email', 120).toLowerCase();
  const password = String(input.password ?? '');
  if (!email.includes('@')) throw new HttpError(400, 'Enter a valid email.');
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');
  const passwordHash = await hashPassword(password);
  const studentId = newId();
  const created = nowIso();
  try {
    await transaction(async (client) => {
      const classCheck = await client.query('SELECT id FROM public.classes WHERE id = $1 AND teacher_id = $2 FOR UPDATE', [classId, teacherId]);
      if (!classCheck.rowCount) throw new HttpError(404, 'Class not found.');
      await client.query(
        'INSERT INTO public.users (id, email, password_hash, name, role, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [studentId, email, passwordHash, name, 'student', created],
      );
      await client.query(
        'INSERT INTO public.class_members (class_id, student_id, created_at) VALUES ($1, $2, $3)',
        [classId, studentId, created],
      );
    });
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') throw new HttpError(400, 'That email is already registered.');
    throw error;
  }
  return { id: studentId, name, email };
}

export async function updateStudent(
  teacherId: string,
  studentId: string,
  input: { name: unknown; email: unknown; password?: unknown },
) {
  const name = requireText(input.name, 'Student name', 80);
  const email = requireText(input.email, 'Email', 120).toLowerCase();
  if (!email.includes('@')) throw new HttpError(400, 'Enter a valid email.');
  const password = String(input.password ?? '');
  if (password && password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');
  const owned = await getPostgres().query(
    `SELECT 1 FROM public.class_members m
     JOIN public.classes c ON c.id = m.class_id
     WHERE m.student_id = $1 AND c.teacher_id = $2 LIMIT 1`,
    [studentId, teacherId],
  );
  if (!owned.rowCount) throw new HttpError(404, 'Student not found.');
  const passwordHash = password ? await hashPassword(password) : null;
  try {
    const result = await getPostgres().query(
      `UPDATE public.users SET name = $1, email = $2,
       password_hash = COALESCE($3, password_hash)
       WHERE id = $4 AND role = 'student' RETURNING id`,
      [name, email, passwordHash, studentId],
    );
    if (!result.rowCount) throw new HttpError(404, 'Student not found.');
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') throw new HttpError(400, 'That email is already registered.');
    throw error;
  }
  return { id: studentId, name, email };
}

export async function deleteStudent(teacherId: string, studentId: string) {
  const result = await getPostgres().query(
    `DELETE FROM public.users u WHERE u.id = $1 AND u.role = 'student'
     AND EXISTS (
       SELECT 1 FROM public.class_members m JOIN public.classes c ON c.id = m.class_id
       WHERE m.student_id = u.id AND c.teacher_id = $2
     ) RETURNING u.id`,
    [studentId, teacherId],
  );
  if (!result.rowCount) throw new HttpError(404, 'Student not found.');
  return { ok: true };
}
