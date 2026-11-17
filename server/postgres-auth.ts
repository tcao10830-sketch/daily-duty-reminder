import { hashPassword, verifyPassword } from './auth.ts';
import { HttpError } from './errors.ts';
import { getPostgres } from './postgres.ts';
import { transaction } from './postgres-store.ts';
import { newId, nowIso, clean, requireText, type PublicUser } from './postgres-store.ts';

type UserRow = PublicUser & { password_hash: string };

export async function authSetup(): Promise<{ hasTeacher: boolean }> {
  const result = await getPostgres().query("SELECT EXISTS (SELECT 1 FROM public.users WHERE role = 'teacher') AS present");
  return { hasTeacher: Boolean(result.rows[0]?.present) };
}

export async function registerTeacher(input: { name: unknown; email: unknown; password: unknown }): Promise<PublicUser> {
  const name = requireText(input.name, 'Name', 80);
  const email = requireText(input.email, 'Email', 120).toLowerCase();
  const password = String(input.password ?? '');
  if (!email.includes('@')) throw new HttpError(400, 'Enter a valid email.');
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');
  const passwordHash = await hashPassword(password);

  return transaction(async (client) => {
    // Serialize first-teacher registration so two simultaneous requests cannot both claim setup.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('daily-duty-first-teacher'))");
    const existingTeacher = await client.query("SELECT id FROM public.users WHERE role = 'teacher' LIMIT 1");
    if (existingTeacher.rowCount) throw new HttpError(403, 'A teacher account already exists. Please sign in.');
    const existingEmail = await client.query('SELECT id FROM public.users WHERE lower(email) = lower($1) LIMIT 1', [email]);
    if (existingEmail.rowCount) throw new HttpError(400, 'That email is already registered.');
    const user: PublicUser = { id: newId(), name, email, role: 'teacher' };
    await client.query(
      'INSERT INTO public.users (id, email, password_hash, name, role, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [user.id, email, passwordHash, name, user.role, nowIso()],
    );
    return user;
  });
}

export async function isPrimaryTeacher(userId: string): Promise<boolean> {
  const result = await getPostgres().query(
    "SELECT id FROM public.users WHERE role = 'teacher' ORDER BY created_at ASC, id ASC LIMIT 1",
  );
  return result.rows[0]?.id === userId;
}

export async function registerAdditionalTeacher(
  creatorId: string,
  input: { name: unknown; email: unknown; password: unknown },
): Promise<PublicUser> {
  const name = requireText(input.name, 'Name', 80);
  const email = requireText(input.email, 'Email', 120).toLowerCase();
  const password = String(input.password ?? '');
  if (!email.includes('@')) throw new HttpError(400, 'Enter a valid email.');
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');
  const passwordHash = await hashPassword(password);
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('daily-duty-first-teacher'))");
    const first = await client.query(
      "SELECT id FROM public.users WHERE role = 'teacher' ORDER BY created_at ASC, id ASC LIMIT 1",
    );
    if (!first.rowCount || first.rows[0].id !== creatorId) {
      throw new HttpError(403, 'Only the first teacher can create teacher accounts.');
    }
    const clash = await client.query('SELECT id FROM public.users WHERE lower(email) = lower($1) LIMIT 1', [email]);
    if (clash.rowCount) throw new HttpError(400, 'That email is already registered.');
    const user: PublicUser = { id: newId(), name, email, role: 'teacher' };
    await client.query(
      'INSERT INTO public.users (id, email, password_hash, name, role, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [user.id, email, passwordHash, name, user.role, nowIso()],
    );
    return user;
  });
}

export async function login(emailRaw: unknown, password: unknown): Promise<PublicUser> {
  const email = clean(emailRaw, 120).toLowerCase();
  const result = await getPostgres().query<UserRow>(
    'SELECT id, email, password_hash, name, role FROM public.users WHERE lower(email) = lower($1) LIMIT 1',
    [email],
  );
  const row = result.rows[0];
  if (!row || !(await verifyPassword(String(password ?? ''), row.password_hash))) {
    throw new HttpError(401, 'Email or password is incorrect.');
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

export async function getUser(userId: string): Promise<PublicUser | null> {
  const result = await getPostgres().query<PublicUser>(
    'SELECT id, email, name, role FROM public.users WHERE id = $1 LIMIT 1',
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function updateProfile(userId: string, nameRaw: unknown): Promise<PublicUser> {
  const name = requireText(nameRaw, 'Name', 80);
  const result = await getPostgres().query<PublicUser>(
    'UPDATE public.users SET name = $1 WHERE id = $2 RETURNING id, email, name, role',
    [name, userId],
  );
  if (!result.rowCount) throw new HttpError(404, 'Account not found.');
  return result.rows[0];
}

export async function changePassword(userId: string, currentPassword: unknown, nextPassword: unknown): Promise<void> {
  const next = String(nextPassword ?? '');
  if (next.length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');
  const result = await getPostgres().query<{ password_hash: string }>(
    'SELECT password_hash FROM public.users WHERE id = $1 LIMIT 1',
    [userId],
  );
  const row = result.rows[0];
  if (!row || !(await verifyPassword(String(currentPassword ?? ''), row.password_hash))) {
    throw new HttpError(400, 'Current password is incorrect.');
  }
  const passwordHash = await hashPassword(next);
  await getPostgres().query('UPDATE public.users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
}
