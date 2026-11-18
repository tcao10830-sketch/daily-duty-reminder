import { randomUUID } from 'node:crypto';
import { HttpError } from './errors.ts';

const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'task-files';
const maxBytes = 10 * 1024 * 1024;

type StoredFile = {
  id: string;
  task_id?: string;
  assignment_id?: string;
  student_id?: string;
  teacher_id?: string;
  file_name: string;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number;
  link_url: string | null;
  comment?: string;
  created_at: string;
  signedUrl?: string | null;
};

function config() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const legacyKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const secretKey = process.env.SUPABASE_SECRET_KEY || '';
  const key = secretKey || legacyKey;
  if (!url || !key) throw new HttpError(503, 'Supabase is not connected yet. Add SUPABASE_URL and SUPABASE_SECRET_KEY in Render.');
  return { url, key, legacy: !secretKey && Boolean(legacyKey) };
}

async function request(path: string, init: RequestInit = {}) {
  const { url, key, legacy } = config();
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: key,
      ...(legacy ? { Authorization: `Bearer ${key}` } : {}),
      ...(init.headers || {}),
    },
  });
  const raw = await response.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) {
    console.error('Supabase request failed:', response.status, data);
    throw new HttpError(502, 'Cloud storage could not complete the request. Check the Supabase setup.');
  }
  return data;
}

const databaseSnapshotPath = '_system/duty.sqlite.gz';

function storageAuthHeaders(key: string, legacy: boolean): Record<string, string> {
  return {
    apikey: key,
    ...(legacy ? { Authorization: `Bearer ${key}` } : {}),
  };
}

/** Download the last durable SQLite snapshot before the app opens its local database. */
export async function downloadDatabaseSnapshot(): Promise<Buffer | null> {
  const { url, key, legacy } = config();
  const objectPath = databaseSnapshotPath.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${url}/storage/v1/object/${bucket}/${objectPath}`, {
    headers: storageAuthHeaders(key, legacy),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    console.error('Database snapshot download failed:', response.status);
    throw new Error('Could not restore the application database from cloud storage.');
  }
  return Buffer.from(await response.arrayBuffer());
}

/** Save a compressed, consistent SQLite snapshot to private Supabase Storage. */
export async function uploadDatabaseSnapshot(snapshot: Buffer): Promise<void> {
  const { url, key, legacy } = config();
  const objectPath = databaseSnapshotPath.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${url}/storage/v1/object/${bucket}/${objectPath}`, {
    method: 'POST',
    headers: {
      ...storageAuthHeaders(key, legacy),
      'Content-Type': 'application/gzip',
      'x-upsert': 'true',
      'Cache-Control': 'no-store',
    },
    body: snapshot,
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error('Database snapshot upload failed:', response.status, detail.slice(0, 500));
    throw new Error('Could not save the application database to cloud storage.');
  }
}

/** One-time import of the existing core tables when no cloud snapshot exists yet. */
export async function loadLegacyDatabaseRows(): Promise<Record<string, Record<string, unknown>[]>> {
  const tables = [
    'users',
    'classes',
    'class_members',
    'tasks',
    'task_assignments',
    'task_completions',
    'notifications',
  ];
  const entries = await Promise.all(tables.map(async (table) => {
    const result = await request(`/rest/v1/${table}?select=*&limit=1000`, { method: 'GET' });
    return [table, Array.isArray(result) ? result as Record<string, unknown>[] : []] as const;
  }));
  return Object.fromEntries(entries);
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'upload';
}

function storedPaths(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((item) => typeof item === 'string');
  } catch {}
  return [value];
}

function storedNames(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {}
  return [value];
}

function decodeFile(body: Record<string, unknown>) {
  const name = String(body.fileName || '').trim();
  const mime = String(body.mimeType || '').toLowerCase();
  const encoded = String(body.base64 || '');
  if (!name || !encoded) throw new HttpError(400, 'Choose a file to upload.');
  const allowed = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);
  if (!allowed.has(mime)) throw new HttpError(400, 'Supported files: PDF, DOC, DOCX, JPG, PNG and WEBP.');
  const base64 = encoded.replace(/^data:[^;]+;base64,/, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new HttpError(400, 'Invalid file data.');
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length || buffer.length > maxBytes) throw new HttpError(413, 'Each file must be 10 MB or smaller.');
  return { name: safeName(name), mime, buffer };
}

async function uploadFile(body: Record<string, unknown>, folder: string) {
  config();
  const file = decodeFile(body);
  const path = `${folder}/${randomUUID()}-${file.name}`;
  await request(`/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    headers: { 'Content-Type': file.mime, 'x-upsert': 'false' },
    body: file.buffer as unknown as BodyInit,
  });
  return { path, name: file.name, mime: file.mime, size: file.buffer.length };
}

async function uploadMany(files: Record<string, unknown>[], folder: string) {
  if (!files.length) return [];
  const decoded = files.map(decodeFile);
  const total = decoded.reduce((sum, item) => sum + item.buffer.length, 0);
  if (total > maxBytes) throw new HttpError(413, 'All files together must be 10 MB or smaller.');
  const uploaded: { path: string; name: string; mime: string; size: number }[] = [];
  try {
    for (const file of decoded) {
      const path = `${folder}/${randomUUID()}-${file.name}`;
      await request(`/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'POST',
        headers: { 'Content-Type': file.mime, 'x-upsert': 'false' },
        body: file.buffer as unknown as BodyInit,
      });
      uploaded.push({ path, name: file.name, mime: file.mime, size: file.buffer.length });
    }
    return uploaded;
  } catch (error) {
    await Promise.all(uploaded.map((item) => request(`/storage/v1/object/${bucket}/${item.path.split('/').map(encodeURIComponent).join('/')}`, { method: 'DELETE' }).catch(() => null)));
    throw error;
  }
}

async function signedUrl(path: string | null) {
  if (!path) return null;
  const result = await request(`/storage/v1/object/sign/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 3600 }),
  });
  const value = result?.signedURL || result?.signedUrl;
  if (!value) return null;
  const { url } = config();
  return String(value).startsWith('http') ? value : `${url}/storage/v1${String(value).startsWith('/') ? '' : '/'}${value}`;
}

async function rows(table: string, query: string) {
  return await request(`/rest/v1/${table}?${query}`, { method: 'GET' }) as StoredFile[];
}

async function insert(table: string, values: Record<string, unknown>) {
  const result = await request(`/rest/v1/${table}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(values),
  });
  return Array.isArray(result) ? result[0] : result;
}

export async function listMaterials(taskId: string) {
  const items = await rows('task_materials', `task_id=eq.${encodeURIComponent(taskId)}&select=*&order=created_at.asc`);
  return await Promise.all(items.map(async (item) => ({ ...item, signedUrl: await signedUrl(item.storage_path) })));
}

export async function createMaterial(taskId: string, teacherId: string, body: Record<string, unknown>) {
  const link = String(body.linkUrl || '').trim();
  let file: { path: string; name: string; mime: string; size: number } | null = null;
  if (body.base64) file = await uploadFile(body, `materials/${taskId}`);
  if (!file && !/^https?:\/\//i.test(link)) throw new HttpError(400, 'Add a file or a valid https:// link.');
  return await insert('task_materials', {
    task_id: taskId,
    teacher_id: teacherId,
    file_name: file?.name || String(body.label || 'Reference link').slice(0, 160),
    storage_path: file?.path || null,
    mime_type: file?.mime || null,
    size_bytes: file?.size || 0,
    link_url: file ? null : link,
  });
}

export async function createSubmission(assignmentId: string, studentId: string, body: Record<string, unknown>, expiresAt: string) {
  const link = String(body.linkUrl || '').trim();
  const suppliedFiles = Array.isArray(body.files) ? body.files as Record<string, unknown>[] : [];
  const files = suppliedFiles.length ? await uploadMany(suppliedFiles, `submissions/${assignmentId}`) :
    body.base64 ? [await uploadFile(body, `submissions/${assignmentId}`)] : [];
  if (!files.length && !/^https?:\/\//i.test(link)) throw new HttpError(400, 'Submit one or more files or a valid https:// link.');
  const total = files.reduce((sum, item) => sum + item.size, 0);
  if (total > maxBytes) throw new HttpError(413, 'All files together must be 10 MB or smaller.');
  return await insert('assignment_submissions', {
    assignment_id: assignmentId,
    student_id: studentId,
    file_name: files.length ? JSON.stringify(files.map((item) => item.name)) : String(body.label || 'Submitted link').slice(0, 160),
    storage_path: files.length ? JSON.stringify(files.map((item) => item.path)) : null,
    mime_type: files.length ? JSON.stringify(files.map((item) => item.mime)) : null,
    size_bytes: total,
    link_url: files.length ? null : link,
    comment: String(body.comment || '').slice(0, 1000),
    expires_at: expiresAt,
  });
}

export async function listSubmissions(assignmentId: string, studentId?: string) {
  const filter = studentId ? `&student_id=eq.${encodeURIComponent(studentId)}` : '';
  const items = await rows('assignment_submissions', `assignment_id=eq.${encodeURIComponent(assignmentId)}&select=*&order=created_at.desc${filter}`);
  return await Promise.all(items.map(async (item) => {
    const reviews = await rows('assignment_reviews', `submission_id=eq.${encodeURIComponent(item.id)}&select=*&order=created_at.desc&limit=1`);
    const paths = storedPaths(item.storage_path);
    const names = storedNames(item.file_name);
    const files = await Promise.all(paths.map(async (path, index) => ({
      file_name: names[index] || item.file_name,
      signedUrl: await signedUrl(path),
    })));
    const primaryUrl = files[0]?.signedUrl || null;
    return { ...item, files, signedUrl: primaryUrl, review: reviews[0] || null };
  }));
}

export async function getSubmission(submissionId: string): Promise<StoredFile & { assignment_id: string; student_id: string }> {
  const items = await rows('assignment_submissions', `id=eq.${encodeURIComponent(submissionId)}&select=*&limit=1`);
  if (!items[0]) throw new HttpError(404, 'Submission not found.');
  return items[0];
}

export async function reviewSubmission(submissionId: string, teacherId: string, status: 'approved' | 'revision_requested', feedback: string) {
  const submission = await getSubmission(submissionId);
  const result = await insert('assignment_reviews', {
    submission_id: submissionId,
    teacher_id: teacherId,
    status,
    feedback: feedback.slice(0, 2000),
  });
  return { submission, review: result };
}


export async function cleanupExpiredSubmissions() {
  const expired = await rows('assignment_submissions', `expires_at=lte.${encodeURIComponent(new Date().toISOString())}&select=id,storage_path`);
  let removed = 0;
  for (const item of expired) {
    const paths = storedPaths(item.storage_path);
    for (const path of paths) {
      await request(`/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`, { method: 'DELETE' });
    }
    await request(`/rest/v1/assignment_submissions?id=eq.${encodeURIComponent(item.id)}`, { method: 'DELETE' });
    removed += 1;
  }
  return removed;
}
