import { db, withDb } from './db.ts';
import { HttpError } from './errors.ts';

export function getTeacherAssignment(teacherId: string, assignmentId: string) {
  return withDb(() => {
    const row = db.prepare(
      `SELECT a.id AS assignment_id, a.task_id, a.student_id
       FROM task_assignments a
       JOIN tasks t ON t.id = a.task_id
       WHERE a.id = ? AND t.teacher_id = ?`,
    ).get(assignmentId, teacherId) as
      | { assignment_id: string; task_id: string; student_id: string }
      | undefined;
    if (!row) throw new HttpError(404, 'Assignment not found.');
    return { assignmentId: row.assignment_id, taskId: row.task_id, studentId: row.student_id };
  });
}
