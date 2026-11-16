import { addDays, todayInZone } from './time.ts';
import { addStudent, completeAssignmentAt, createClass, createTask, registerTeacher, studentTasks } from './store.ts';
import { db, withDb } from './db.ts';

export async function seed(): Promise<void> {
  const existing = await withDb(() => db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number });
  if (existing.n > 0) return;

  const teacher = await registerTeacher({
    name: 'Cô Mai Lan',
    email: 'giaovien@school.test',
    password: 'demo1234',
  });
  const classA = await createClass(teacher.id, '10A1');
  const classB = await createClass(teacher.id, '10A2');
  const an = await addStudent(teacher.id, classA.id, { name: 'Nguyễn An', email: 'an.10a1@school.test', password: 'demo1234' });
  const binh = await addStudent(teacher.id, classA.id, { name: 'Trần Bình', email: 'binh.10a1@school.test', password: 'demo1234' });
  await addStudent(teacher.id, classA.id, { name: 'Lê Chi', email: 'chi.10a1@school.test', password: 'demo1234' });
  await addStudent(teacher.id, classB.id, { name: 'Phạm Dung', email: 'dung.10a2@school.test', password: 'demo1234' });

  const today = todayInZone();
  const yesterday = addDays(today, -1);
  const soon = addDays(today, 2);

  await createTask(teacher.id, {
    title: 'Complete English homework',
    description: 'Finish workbook page 12 and write five sentences.',
    instructions: 'Use full sentences. Bring the notebook to class.',
    classId: classA.id,
    assignmentDate: today,
    deadlineDate: today,
    deadlineTime: '23:59',
    priority: 'high',
    penalty: 'Complete an additional review exercise.',
    color: 'yellow',
    recurrence: 'once',
  });

  const science = await createTask(teacher.id, {
    title: 'Submit science worksheet',
    description: 'Hand in the plant-cell worksheet.',
    instructions: 'Label every part you studied this week.',
    classId: classA.id,
    assignmentDate: yesterday,
    deadlineDate: yesterday,
    deadlineTime: '20:00',
    priority: 'medium',
    penalty: 'Stay 15 minutes after class to finish it.',
    color: 'green',
    recurrence: 'once',
  });

  await createTask(teacher.id, {
    title: 'Bring the class diary',
    description: 'You are the diary monitor this week.',
    instructions: 'Collect the diary from the teacher’s desk.',
    classId: classA.id,
    studentId: binh.id,
    assignmentDate: today,
    deadlineDate: soon,
    deadlineTime: '08:00',
    priority: 'low',
    penalty: 'Write a short apology note to the class.',
    color: 'blue',
    recurrence: 'once',
  });

  await createTask(teacher.id, {
    title: 'Read 10 pages',
    description: 'Silent reading for the class library log.',
    instructions: 'Record the book title in your notebook.',
    classId: classB.id,
    assignmentDate: today,
    deadlineDate: soon,
    deadlineTime: '16:00',
    priority: 'medium',
    penalty: 'Read five extra pages tomorrow.',
    color: 'pink',
    recurrence: 'once',
  });

  const anTasks = await studentTasks(an.id);
  const scienceAssignment = anTasks.find((task) => task.taskId === science[0]?.id);
  if (scienceAssignment) {
    await completeAssignmentAt(an.id, scienceAssignment.assignmentId, new Date(`${yesterday}T10:30:00+07:00`).toISOString());
  }

  console.log('Demo login — teacher: giaovien@school.test / demo1234');
  console.log('Demo students use the same password: an.10a1@school.test, binh.10a1@school.test, chi.10a1@school.test, dung.10a2@school.test');
}
