import { getPostgres } from './postgres.ts';
import { HttpError } from './errors.ts';

export async function getTeacherAssignment(teacherId: string, assignmentId: string) {
  const result = await getPostgres().query<{
    assignment_id: string;
    task_id: string;
    student_id: string;
  }>(
    `SELECT a.id AS assignment_id, a.task_id, a.student_id
     FROM public.task_assignments a
     JOIN public.tasks t ON t.id = a.task_id
     WHERE a.id = $1 AND t.teacher_id = $2`,
    [assignmentId, teacherId],
  );
  const row = result.rows[0];
  if (!row) throw new HttpError(404, 'Assignment not found.');
  return { assignmentId: row.assignment_id, taskId: row.task_id, studentId: row.student_id };
}
