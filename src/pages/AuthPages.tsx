import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Banner, Button, Field, controlClass } from '../components/ui';
import { api } from '../lib/api';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('giaovien@school.test');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [hasTeacher, setHasTeacher] = useState<boolean | null>(null);
  useEffect(() => { api<{ hasTeacher: boolean }>('/api/auth/setup').then((result) => setHasTeacher(result.hasTeacher)).catch(() => setHasTeacher(true)); }, []);

  async function submit(nextEmail = email, nextPassword = password) {
    setBusy(true);
    setError('');
    try {
      const user = await login(nextEmail, nextPassword);
      navigate(user.role === 'teacher' ? '/teacher' : '/student');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Welcome back" subtitle="Assign duties, track deadlines, and see who finished.">
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {error ? <Banner tone="error">{error}</Banner> : null}
        <Field label="Email">
          <input className={controlClass} data-testid="login-email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label="Password">
          <input className={controlClass} data-testid="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
        <Button type="submit" disabled={busy} testId="login-submit">
          {busy ? 'Signing in…' : 'Log in'}
        </Button>
      </form>
      <div className="mt-4 grid gap-2">
        <button type="button" className="rounded-2xl bg-[#FFF3B0] px-3 py-2 text-left text-sm font-extrabold" onClick={() => void submit('giaovien@school.test', 'demo1234')}>
          Demo teacher · giaovien@school.test
        </button>
        <button type="button" className="rounded-2xl bg-[#D6E6FF] px-3 py-2 text-left text-sm font-extrabold" onClick={() => void submit('an.10a1@school.test', 'demo1234')} data-testid="demo-student">
          Demo student · an.10a1@school.test
        </button>
      </div>
      {hasTeacher === false ? <p className="mt-4 text-sm font-bold">First teacher? <Link className="text-[#315fbf]" to="/register">Create the first account</Link></p> : null}
    </AuthCard>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [setupReady, setSetupReady] = useState(false);
  const [hasTeacher, setHasTeacher] = useState(true);
  useEffect(() => { api<{ hasTeacher: boolean }>('/api/auth/setup').then((result) => setHasTeacher(result.hasTeacher)).catch(() => setHasTeacher(true)).finally(() => setSetupReady(true)); }, []);
  if (!setupReady) return <AuthCard title="Checking setup" subtitle="Please wait…"><p className="font-bold text-slate-500">Loading account setup.</p></AuthCard>;
  if (hasTeacher) return <AuthCard title="Registration closed" subtitle="Teacher accounts are managed by the first teacher."><Banner tone="error">A teacher account already exists. Ask the first teacher to create an account for you.</Banner><p className="mt-4 text-sm font-bold"><Link className="text-[#315fbf]" to="/login">Back to log in</Link></p></AuthCard>;

  return (
    <AuthCard title="Teacher sign up" subtitle="Student accounts are created inside a class.">
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          register(name, email, password)
            .then(() => navigate('/teacher'))
            .catch((err: Error) => setError(err.message))
            .finally(() => setBusy(false));
        }}
      >
        {error ? <Banner tone="error">{error}</Banner> : null}
        <Field label="Name">
          <input className={controlClass} value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="Email">
          <input className={controlClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </Field>
        <Field label="Password">
          <input className={controlClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
        </Field>
        <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create teacher account'}</Button>
      </form>
      <p className="mt-4 text-sm font-bold">
        Already registered? <Link className="text-[#315fbf]" to="/login">Log in</Link>
      </p>
    </AuthCard>
  );
}

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid min-h-screen max-w-md place-items-center px-4 py-10">
      <div className="w-full">
        <p className="font-display text-4xl text-[#FF914D]">Daily Duty</p>
        <h1 className="mt-2 text-2xl font-extrabold">{title}</h1>
        <p className="mb-4 font-bold text-slate-500">{subtitle}</p>
        <div className="rounded-3xl bg-white p-5 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
