import { readToken, signToken } from '../server/auth.ts';
import { HttpError } from '../server/errors.ts';
import * as store from '../server/postgres-store-api.ts';
import * as cloud from '../server/supabase.ts';
import { getTeacherAssignment } from '../server/access.pg.ts';

type Request = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined> & { authorization?: string };
  body?: unknown;
};
type Response = {
  status(code: number): Response;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
};

const jwtSecret = process.env.JWT_SECRET || '';

function requireSecret() {
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new HttpError(503, 'The server authentication secret is not configured.');
  }
  return jwtSecret;
}

function match(pattern: string, path: string): Record<string, string> | null {
  const expected = pattern.split('/').filter(Boolean);
  const actual = path.split('/').filter(Boolean);
  if (expected.length !== actual.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < expected.length; i += 1) {
    if (expected[i].startsWith(':')) params[expected[i].slice(1)] = decodeURIComponent(actual[i]);
    else if (expected[i] !== actual[i]) return null;
  }
  return params;
}

function requireUser(user: store.PublicUser | null, role?: store.Role): store.PublicUser {
  if (!user) throw new HttpError(401, 'Please log in.');
  if (role && user.role !== role) throw new HttpError(403, 'You cannot open that page.');
  return user;
}

async function dispatch(method: string, path: string, body: Record<string, unknown>, user: store.PublicUser | null) {
  const routes: { method: string; pattern: string; run: (params: Record<string, string>) => Promise<unknown> }[] = [
    { method: 'POST', pattern: '/api/storage/sign-upload', run: async () => {
      const purpose = String(body.purpose || '');
      const file = { fileName: body.fileName, mimeType: body.mimeType, size: body.size };
      if (purpose === 'material') {
        const teacher = requireUser(user, 'teacher');
        const taskId = String(body.taskId || '');
        await store.getTeacherTask(teacher.id, taskId);
        return cloud.createUploadTicket(`materials/${taskId}`, file);
      }
      if (purpose === 'submission') {
        const student = requireUser(user, 'student');
        const assignmentId = String(body.assignmentId || '');
        await store.studentTask(student.id, assignmentId);
        return cloud.createUploadTicket(`submissions/${assignmentId}`, file);
      }
      throw new HttpError(400, 'Choose a valid upload purpose.');
    } },
    { method: 'GET', pattern: '/api/auth/setup', run: async () => store.authSetup() },
    { method: 'POST', pattern: '/api/auth/login', run: async () => { const secret = requireSecret(); const account = await store.login(body.email, body.password); return { user: account, token: signToken({ sub: account.id, role: account.role }, secret) }; } },
    { method: 'GET', pattern: '/api/teacher/permissions', run: async () => ({ canManageTeachers: await store.isPrimaryTeacher(requireUser(user, 'teacher').id) }) },
    { method: 'POST', pattern: '/api/teacher/teachers', run: async () => ({ user: await store.registerAdditionalTeacher(requireUser(user, 'teacher').id, body as any) }) },
    { method: 'GET', pattern: '/api/auth/me', run: async () => ({ user: requireUser(user) }) },
    { method: 'PATCH', pattern: '/api/me', run: async () => ({ user: await store.updateProfile(requireUser(user).id, body.name) }) },
    { method: 'POST', pattern: '/api/me/password', run: async () => { await store.changePassword(requireUser(user).id, body.currentPassword, body.newPassword); return { ok: true }; } },
    { method: 'GET', pattern: '/api/teacher/overview', run: async () => store.teacherOverview(requireUser(user, 'teacher').id) },
    { method: 'GET', pattern: '/api/teacher/classes', run: async () => ({ classes: await store.listClasses(requireUser(user, 'teacher').id) }) },
    { method: 'POST', pattern: '/api/teacher/classes', run: async () => ({ class: await store.createClass(requireUser(user, 'teacher').id, body.name) }) },
    { method: 'PATCH', pattern: '/api/teacher/classes/:id', run: async (p) => ({ class: await store.renameClass(requireUser(user, 'teacher').id, p.id, body.name) }) },
    { method: 'DELETE', pattern: '/api/teacher/classes/:id', run: async (p) => store.deleteClass(requireUser(user, 'teacher').id, p.id) },
    { method: 'GET', pattern: '/api/teacher/classes/:id', run: async (p) => store.getClassDetail(requireUser(user, 'teacher').id, p.id) },
    { method: 'POST', pattern: '/api/teacher/classes/:id/students', run: async (p) => ({ student: await store.addStudent(requireUser(user, 'teacher').id, p.id, body as any) }) },
    { method: 'PATCH', pattern: '/api/teacher/students/:id', run: async (p) => ({ student: await store.updateStudent(requireUser(user, 'teacher').id, p.id, body as any) }) },
    { method: 'DELETE', pattern: '/api/teacher/students/:id', run: async (p) => store.deleteStudent(requireUser(user, 'teacher').id, p.id) },
    { method: 'GET', pattern: '/api/teacher/students/:id', run: async (p) => store.studentProgress(requireUser(user, 'teacher').id, p.id) },
    { method: 'GET', pattern: '/api/teacher/tasks', run: async () => ({ tasks: await store.listTeacherTasks(requireUser(user, 'teacher').id) }) },
    { method: 'POST', pattern: '/api/teacher/tasks', run: async () => ({ tasks: await store.createTask(requireUser(user, 'teacher').id, { ...body, studentIds: undefined } as any) }) },
    { method: 'GET', pattern: '/api/teacher/tasks/:id', run: async (p) => store.getTeacherTask(requireUser(user, 'teacher').id, p.id) },
    { method: 'GET', pattern: '/api/teacher/tasks/:id/materials', run: async (p) => { await store.getTeacherTask(requireUser(user, 'teacher').id, p.id); return { materials: await cloud.listMaterials(p.id) }; } },
    { method: 'POST', pattern: '/api/teacher/tasks/:id/materials', run: async (p) => { const teacher = requireUser(user, 'teacher'); await store.getTeacherTask(teacher.id, p.id); return { material: await cloud.createMaterial(p.id, teacher.id, body) }; } },
    { method: 'PATCH', pattern: '/api/teacher/tasks/:id', run: async (p) => store.updateTask(requireUser(user, 'teacher').id, p.id, body as any) },
    { method: 'POST', pattern: '/api/teacher/tasks/:id/duplicate', run: async (p) => ({ tasks: await store.duplicateTask(requireUser(user, 'teacher').id, p.id) }) },
    { method: 'POST', pattern: '/api/teacher/tasks/:id/cancel', run: async (p) => ({ task: await store.cancelTask(requireUser(user, 'teacher').id, p.id) }) },
    { method: 'DELETE', pattern: '/api/teacher/tasks/:id', run: async (p) => store.deleteTask(requireUser(user, 'teacher').id, p.id) },
    { method: 'POST', pattern: '/api/teacher/assignments/:id/reopen', run: async (p) => ({ assignment: await store.reopenAssignment(requireUser(user, 'teacher').id, p.id) }) },
    { method: 'GET', pattern: '/api/student/overview', run: async () => store.studentOverview(requireUser(user, 'student').id) },
    { method: 'GET', pattern: '/api/student/tasks', run: async () => ({ assignments: await store.studentTasks(requireUser(user, 'student').id) }) },
    { method: 'GET', pattern: '/api/student/tasks/:id', run: async (p) => ({ assignment: await store.studentTask(requireUser(user, 'student').id, p.id) }) },
    { method: 'GET', pattern: '/api/student/tasks/:id/materials', run: async (p) => { const s = requireUser(user, 'student'); const a = await store.studentTask(s.id, p.id); return { materials: await cloud.listMaterials(a.taskId) }; } },
    { method: 'GET', pattern: '/api/student/assignments/:id/submissions', run: async (p) => { const s = requireUser(user, 'student'); await store.studentTask(s.id, p.id); return { submissions: await cloud.listSubmissions(p.id, s.id) }; } },
    { method: 'POST', pattern: '/api/student/assignments/:id/submissions', run: async (p) => { const s = requireUser(user, 'student'); const a = await store.studentTask(s.id, p.id); const expiresAt = new Date(new Date(a.deadlineAt).getTime() + 30 * 86400000).toISOString(); return { submission: await cloud.createSubmission(p.id, s.id, body, expiresAt) }; } },
    { method: 'GET', pattern: '/api/teacher/assignments/:id/submissions', run: async (p) => { const t = requireUser(user, 'teacher'); const a = await getTeacherAssignment(t.id, p.id); return { submissions: await cloud.listSubmissions(a.assignmentId) }; } },
    { method: 'POST', pattern: '/api/teacher/submissions/:id/review', run: async (p) => { const t = requireUser(user, 'teacher'); const submission = await cloud.getSubmission(p.id); const a = await getTeacherAssignment(t.id, submission.assignment_id); const status = String(body.status); if (status !== 'approved' && status !== 'revision_requested') throw new HttpError(400, 'Choose approve or request changes.'); const review = await cloud.reviewSubmission(p.id, t.id, status, String(body.feedback || '')); if (status === 'approved') await store.completeAssignmentAt(a.studentId, a.assignmentId, new Date().toISOString()); return { review }; } },
    { method: 'POST', pattern: '/api/student/assignments/:id/start', run: async (p) => ({ assignment: await store.startAssignment(requireUser(user, 'student').id, p.id) }) },
    { method: 'GET', pattern: '/api/notifications', run: async () => store.listNotifications(requireUser(user).id) },
    { method: 'POST', pattern: '/api/notifications/:id/read', run: async (p) => store.markRead(requireUser(user).id, p.id) },
    { method: 'POST', pattern: '/api/notifications/read-all', run: async () => store.markAllRead(requireUser(user).id) },
    { method: 'GET', pattern: '/api/health', run: async () => ({ ok: true }) },
  ];

  if (method === 'POST' && path === '/api/auth/register') {
    const secret = requireSecret();
    const account = await store.registerTeacher(body as any);
    return { user: account, token: signToken({ sub: account.id, role: account.role }, secret) };
  }
  for (const route of routes) {
    if (route.method !== method) continue;
    const params = match(route.pattern, path);
    if (params) return route.run(params);
  }
  return null;
}

export default async function handler(req: Request, res: Response) {
  try {
    const url = new URL(req.url || '/', 'https://daily-duty.invalid');
    const path = url.pathname;
    const method = String(req.method || 'GET').toUpperCase();
    if (!path.startsWith('/api/')) {
      res.status(404).json({ error: 'Not found.' });
      return;
    }
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body as Record<string, unknown>
      : {};
    // Setup status is public and must remain available even before JWT_SECRET is configured.
    if (method === 'GET' && path === '/api/auth/setup') {
      const result = await dispatch(method, path, body, null);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(result);
      return;
    }
    const secret = requireSecret();
    const auth = req.headers.authorization;
    const bearer = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const payload = bearer ? readToken(bearer, secret) : null;
    const user = payload ? await store.getUser(payload.sub) : null;
    const result = await dispatch(method, path, body, user);
    if (result == null) {
      res.status(404).json({ error: 'Not found.' });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error('Daily Duty API error:', error);
    res.status(500).json({ error: 'Something went wrong.' });
  }
}
