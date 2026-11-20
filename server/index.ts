import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, relative, sep } from 'node:path';
import { jwtSecret } from './db.ts';
import { getPushPublicKey, savePushSubscription, removePushSubscription } from './push.ts';
import { readToken, signToken } from './auth.ts';
import { HttpError } from './errors.ts';
import { subscribe } from './events.ts';
import { seed } from './seed.ts';
import { sweepDeadlines } from './store.ts';
import * as store from './store.ts';
import * as cloud from './supabase.ts';
import { getTeacherAssignment } from './access.ts';
import { adjustStudentPencils, awardQualityPencils, cleanupExpiredPencilHistory, resetStudentStreak, resolveStreakReview, saveEarlyRewardRules, studentRewards, teacherRewards } from './rewards.ts';

const port = Number(process.env.PORT ?? 8787);
const dev = process.env.DEV === '1';

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 15_000_000) throw new HttpError(413, 'Yêu cầu quá lớn. Mỗi tệp tải lên không được vượt quá 10 MB.');
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'Dữ liệu gửi lên phải có định dạng JSON.');
  }
}

function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

async function currentUser(req: IncomingMessage) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const payload = readToken(token, jwtSecret);
  if (!payload) return null;
  return store.getUser(payload.sub);
}

function requireUser(user: store.PublicUser | null, role?: store.Role): store.PublicUser {
  if (!user) throw new HttpError(401, 'Vui lòng đăng nhập.');
  if (role && user.role !== role) throw new HttpError(403, 'Bạn không có quyền truy cập trang này.');
  return user;
}

async function dispatch(method: string, path: string, body: Record<string, unknown>, user: store.PublicUser | null) {
  const routes: { method: string; pattern: string; run: (params: Record<string, string>) => Promise<unknown> }[] = [
    { method: 'POST', pattern: '/api/auth/register', run: async () => ({ user: await store.registerTeacher(body), token: '' }) },
    { method: 'GET', pattern: '/api/auth/setup', run: async () => store.authSetup() },
    { method: 'GET', pattern: '/api/teacher/permissions', run: async () => {
      const teacher = requireUser(user, 'teacher');
      return { canManageTeachers: await store.isPrimaryTeacher(teacher.id) };
    } },
    { method: 'POST', pattern: '/api/teacher/teachers', run: async () => {
      const teacher = requireUser(user, 'teacher');
      return { user: await store.registerAdditionalTeacher(teacher.id, body) };
    } },
    { method: 'POST', pattern: '/api/auth/login', run: async () => {
      const account = await store.login(body.email, body.password);
      return { user: account, token: signToken({ sub: account.id, role: account.role }, jwtSecret) };
    } },
    { method: 'GET', pattern: '/api/auth/me', run: async () => ({ user: requireUser(user) }) },
    { method: 'PATCH', pattern: '/api/me', run: async () => ({ user: await store.updateProfile(requireUser(user).id, body.name) }) },
    { method: 'POST', pattern: '/api/me/password', run: async () => { await store.changePassword(requireUser(user).id, body.currentPassword, body.newPassword); return { ok: true }; } },
    { method: 'GET', pattern: '/api/teacher/overview', run: async () => store.teacherOverview(requireUser(user, 'teacher').id) },
    { method: 'GET', pattern: '/api/teacher/classes', run: async () => ({ classes: await store.listClasses(requireUser(user, 'teacher').id) }) },
    { method: 'POST', pattern: '/api/teacher/classes', run: async () => ({ class: await store.createClass(requireUser(user, 'teacher').id, body.name) }) },
    { method: 'PATCH', pattern: '/api/teacher/classes/:id', run: async (params) => ({ class: await store.renameClass(requireUser(user, 'teacher').id, params.id, body.name) }) },
    { method: 'DELETE', pattern: '/api/teacher/classes/:id', run: async (params) => store.deleteClass(requireUser(user, 'teacher').id, params.id) },
    { method: 'GET', pattern: '/api/teacher/classes/:id', run: async (params) => store.getClassDetail(requireUser(user, 'teacher').id, params.id) },
    { method: 'POST', pattern: '/api/teacher/classes/:id/students', run: async (params) => ({ student: await store.addStudent(requireUser(user, 'teacher').id, params.id, body) }) },
    { method: 'PATCH', pattern: '/api/teacher/students/:id', run: async (params) => ({ student: await store.updateStudent(requireUser(user, 'teacher').id, params.id, body) }) },
    { method: 'DELETE', pattern: '/api/teacher/students/:id', run: async (params) => store.deleteStudent(requireUser(user, 'teacher').id, params.id) },
    { method: 'GET', pattern: '/api/teacher/students/:id', run: async (params) => store.studentProgress(requireUser(user, 'teacher').id, params.id) },
    { method: 'POST', pattern: '/api/teacher/reports/preview', run: async () => store.teacherStudentReports(requireUser(user, 'teacher').id, body as { classId: unknown; studentIds: unknown; from: unknown; to: unknown }) },
    { method: 'GET', pattern: '/api/teacher/rewards', run: async () => teacherRewards(requireUser(user, 'teacher').id) },
    { method: 'PUT', pattern: '/api/teacher/rewards/early-rules', run: async () => saveEarlyRewardRules(requireUser(user, 'teacher').id, body.rules) },
    { method: 'POST', pattern: '/api/teacher/rewards/students/:id/adjust', run: async (params) => adjustStudentPencils(requireUser(user, 'teacher').id, params.id, body.amount, body.note) },
    { method: 'POST', pattern: '/api/teacher/rewards/students/:id/streak-reset', run: async (params) => resetStudentStreak(requireUser(user, 'teacher').id, params.id) },
    { method: 'POST', pattern: '/api/teacher/rewards/streaks/:id/decision', run: async (params) => resolveStreakReview(requireUser(user, 'teacher').id, params.id, body.decision) },
    { method: 'GET', pattern: '/api/student/rewards', run: async () => studentRewards(requireUser(user, 'student').id) },
    { method: 'GET', pattern: '/api/teacher/tasks', run: async () => ({ tasks: await store.listTeacherTasks(requireUser(user, 'teacher').id) }) },
    { method: 'POST', pattern: '/api/teacher/tasks', run: async () => ({ tasks: await store.createTask(requireUser(user, 'teacher').id, { ...body, studentIds: undefined }) }) },
    { method: 'GET', pattern: '/api/teacher/tasks/:id', run: async (params) => store.getTeacherTask(requireUser(user, 'teacher').id, params.id) },
    { method: 'GET', pattern: '/api/teacher/tasks/:id/materials', run: async (params) => {
      await store.getTeacherTask(requireUser(user, 'teacher').id, params.id);
      return { materials: await cloud.listMaterials(params.id) };
    } },
    { method: 'POST', pattern: '/api/teacher/tasks/:id/materials', run: async (params) => {
      const teacher = requireUser(user, 'teacher');
      await store.getTeacherTask(teacher.id, params.id);
      return { material: await cloud.createMaterial(params.id, teacher.id, body) };
    } },
    { method: 'PATCH', pattern: '/api/teacher/tasks/:id', run: async (params) => store.updateTask(requireUser(user, 'teacher').id, params.id, body) },
    { method: 'POST', pattern: '/api/teacher/tasks/:id/duplicate', run: async (params) => ({ tasks: await store.duplicateTask(requireUser(user, 'teacher').id, params.id) }) },
    { method: 'POST', pattern: '/api/teacher/tasks/:id/cancel', run: async (params) => ({ task: await store.cancelTask(requireUser(user, 'teacher').id, params.id) }) },
    { method: 'DELETE', pattern: '/api/teacher/tasks/:id', run: async (params) => store.deleteTask(requireUser(user, 'teacher').id, params.id) },
    { method: 'POST', pattern: '/api/teacher/assignments/:id/reopen', run: async (params) => ({ assignment: await store.reopenAssignment(requireUser(user, 'teacher').id, params.id) }) },
    { method: 'GET', pattern: '/api/student/overview', run: async () => store.studentOverview(requireUser(user, 'student').id) },
    { method: 'GET', pattern: '/api/student/tasks', run: async () => ({ assignments: await store.studentTasks(requireUser(user, 'student').id) }) },
    { method: 'GET', pattern: '/api/student/tasks/:id', run: async (params) => ({ assignment: await store.studentTask(requireUser(user, 'student').id, params.id) }) },
    { method: 'GET', pattern: '/api/student/tasks/:id/materials', run: async (params) => {
      const student = requireUser(user, 'student');
      const assignment = await store.studentTask(student.id, params.id);
      return { materials: await cloud.listMaterials(assignment.taskId) };
    } },
    { method: 'GET', pattern: '/api/student/assignments/:id/submissions', run: async (params) => {
      const student = requireUser(user, 'student');
      await store.studentTask(student.id, params.id);
      return { submissions: await cloud.listSubmissions(params.id, student.id) };
    } },
    { method: 'POST', pattern: '/api/student/assignments/:id/submissions', run: async (params) => {
      const student = requireUser(user, 'student');
      const assignment = await store.studentTask(student.id, params.id);
      const expiresAt = new Date(new Date(assignment.deadlineAt).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const submission = await cloud.createSubmission(params.id, student.id, body, expiresAt);
      await store.markAssignmentSubmitted(student.id, assignment.assignmentId, submission.created_at || new Date().toISOString());
      return { submission };
    } },
    { method: 'GET', pattern: '/api/teacher/assignments/:id/submissions', run: async (params) => {
      const teacher = requireUser(user, 'teacher');
      const assignment = await getTeacherAssignment(teacher.id, params.id);
      return { submissions: await cloud.listSubmissions(assignment.assignmentId) };
    } },
    { method: 'POST', pattern: '/api/teacher/submissions/:id/review', run: async (params) => {
      const teacher = requireUser(user, 'teacher');
      const submission = await cloud.getSubmission(params.id);
      const assignment = await getTeacherAssignment(teacher.id, submission.assignment_id);
      const status = String(body.status);
      if (status !== 'approved' && status !== 'revision_requested') throw new HttpError(400, 'Hãy chọn duyệt bài hoặc yêu cầu chỉnh sửa.');
      const review = await cloud.reviewSubmission(params.id, teacher.id, status, String(body.feedback || ''));
      if (status === 'approved') {
        await store.completeAssignmentAt(assignment.studentId, assignment.assignmentId, submission.created_at);
        await awardQualityPencils(teacher.id, assignment.assignmentId, body.qualityPencils ?? 0);
        if (Number(body.qualityPencils ?? 0) > 0) {
          await store.notifySubmissionReview(assignment.studentId, assignment.assignmentId, true);
        }
      } else {
        await store.requestAssignmentRevision(teacher.id, assignment.assignmentId, review.review.created_at || new Date().toISOString());
      }
      return { review };
    } },
    { method: 'POST', pattern: '/api/student/assignments/:id/start', run: async (params) => ({ assignment: await store.startAssignment(requireUser(user, 'student').id, params.id) }) },
    { method: 'GET', pattern: '/api/push/public-key', run: async () => getPushPublicKey() },
    { method: 'POST', pattern: '/api/push/subscribe', run: async () => savePushSubscription(requireUser(user).id, body.subscription) },
    { method: 'POST', pattern: '/api/push/unsubscribe', run: async () => removePushSubscription(requireUser(user).id, body.endpoint) },
    { method: 'GET', pattern: '/api/notifications', run: async () => store.listNotifications(requireUser(user).id) },
    { method: 'POST', pattern: '/api/notifications/:id/read', run: async (params) => store.markRead(requireUser(user).id, params.id) },
    { method: 'POST', pattern: '/api/notifications/read-all', run: async () => store.markAllRead(requireUser(user).id) },
    { method: 'DELETE', pattern: '/api/notifications/:id', run: async (params) => store.deleteNotification(requireUser(user).id, params.id) },
    { method: 'DELETE', pattern: '/api/notifications', run: async () => store.deleteAllNotifications(requireUser(user).id) },
    { method: 'GET', pattern: '/api/health', run: async () => ({ ok: true }) },
  ];

  if (method === 'POST' && path === '/api/auth/register') {
    const account = await store.registerTeacher(body);
    return { user: account, token: signToken({ sub: account.id, role: account.role }, jwtSecret) };
  }

  for (const route of routes) {
    if (route.method !== method) continue;
    const params = match(route.pattern, path);
    if (!params) continue;
    if (route.pattern === '/api/auth/register') continue;
    return route.run(params);
  }
  return null;
}

const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function serveStatic(req: IncomingMessage, res: ServerResponse, pathname: string): void {
  const dist = join(process.cwd(), 'dist');
  const cleaned = pathname === '/' ? '/index.html' : pathname;
  const target = normalize(join(dist, cleaned));
  const rel = relative(dist, target);
  const missing = rel.startsWith('..') || rel.includes(`..${sep}`);
  const file = !missing && existsSync(target) && statSync(target).isFile() ? target : join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
  void req;
}

if (dev || process.env.SEED_DEMO === '1') await seed();
setInterval(() => {
  sweepDeadlines().catch((error) => console.error(error));
}, 60_000);

// Keep the student-facing pencil history to the most recent 30 days.
// Lifetime pencil balances and reward idempotency records are stored separately.
cleanupExpiredPencilHistory().then((count) => {
  if (count) console.log(`Removed ${count} expired pencil-history row(s).`);
}).catch((error) => console.error('Pencil history cleanup failed:', error));
setInterval(() => {
  cleanupExpiredPencilHistory().catch((error) => console.error('Pencil history cleanup failed:', error));
}, 24 * 60 * 60 * 1000);

// Run cloud-file retention cleanup on startup and periodically.
// On Render's free plan the service may sleep; startup cleanup catches up after it wakes.
cloud.cleanupExpiredSubmissions().then((count) => {
  if (count) console.log(`Removed ${count} expired student submission(s).`);
}).catch((error) => console.error('Submission cleanup failed:', error));
setInterval(() => {
  cloud.cleanupExpiredSubmissions().catch((error) => console.error('Submission cleanup failed:', error));
}, 6 * 60 * 60 * 1000);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  try {
    if (req.method === 'GET' && url.pathname === '/api/events') {
      const payload = readToken(url.searchParams.get('token') ?? '', jwtSecret);
      const account = payload ? await store.getUser(payload.sub) : null;
      if (!account) {
        send(res, 401, { error: 'Vui lòng đăng nhập.' });
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(':\n\n');
      const unsubscribe = subscribe(account.id, (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });
      const ping = setInterval(() => res.write(':\n\n'), 20_000);
      req.on('close', () => {
        clearInterval(ping);
        unsubscribe();
      });
      return;
    }

    if (!url.pathname.startsWith('/api')) {
      if (!dev && existsSync(join(process.cwd(), 'dist'))) {
        serveStatic(req, res, url.pathname);
        return;
      }
      send(res, 404, { error: 'Không tìm thấy nội dung yêu cầu.' });
      return;
    }

    const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await readBody(req);
    const user = await currentUser(req);
    const result = await dispatch(req.method ?? 'GET', url.pathname, body, user);
    if (result == null) {
      send(res, 404, { error: 'Không tìm thấy nội dung yêu cầu.' });
      return;
    }
    send(res, 200, result);
  } catch (error) {
    if (error instanceof HttpError) {
      send(res, error.status, { error: error.message });
      return;
    }
    console.error(error);
    if (!res.headersSent) send(res, 500, { error: 'Đã xảy ra lỗi. Vui lòng thử lại.' });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Daily Duty Reminder API on http://127.0.0.1:${port}`);
});
