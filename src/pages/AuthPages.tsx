import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Banner, Button, Field, controlLớp } from '../components/ui';
import { api } from '../lib/api';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('giaovien@school.test');
  const [password, setMật khẩu] = useState('demo1234');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [hasTeacher, setHasTeacher] = useState<boolean | null>(null);
  useEffect(() => { api<{ hasTeacher: boolean }>('/api/auth/setup').then((result) => setHasTeacher(result.hasTeacher)).catch(() => setHasTeacher(true)); }, []);

  async function submit(nextEmail = email, nextMật khẩu = password) {
    setBusy(true);
    setError('');
    try {
      const user = await login(nextEmail, nextMật khẩu);
      navigate(user.role === 'teacher' ? '/teacher' : '/student');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Chào mừng quay trở lại" subtitle="Giao nhiệm vụ, theo dõi hạn nộp và xem tiến độ hoàn thành.">
      <form
        classHọ và tên="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {error ? <Banner tone="error">{error}</Banner> : null}
        <Field label="Email">
          <input classHọ và tên={controlLớp} data-testid="login-email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label="Mật khẩu">
          <input classHọ và tên={controlLớp} data-testid="login-password" type="password" value={password} onChange={(event) => setMật khẩu(event.target.value)} />
        </Field>
        <Button type="submit" disabled={busy} testId="login-submit">
          {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </Button>
      </form>
      <div classHọ và tên="mt-4 grid gap-2">
        <button type="button" classHọ và tên="rounded-2xl bg-[#FFF3B0] px-3 py-2 text-left text-sm font-extrabold" onClick={() => void submit('giaovien@school.test', 'demo1234')}>
          Tài khoản giáo viên mẫu · giaovien@school.test
        </button>
        <button type="button" classHọ và tên="rounded-2xl bg-[#D6E6FF] px-3 py-2 text-left text-sm font-extrabold" onClick={() => void submit('an.10a1@school.test', 'demo1234')} data-testid="demo-student">
          Tài khoản học sinh mẫu · an.10a1@school.test
        </button>
      </div>
      {hasTeacher === false ? <p classHọ và tên="mt-4 text-sm font-bold">Bạn là giáo viên đầu tiên? <Link classHọ và tên="text-[#315fbf]" to="/register">Tạo tài khoản đầu tiên</Link></p> : null}
    </AuthCard>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setHọ và tên] = useState('');
  const [email, setEmail] = useState('');
  const [password, setMật khẩu] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [setupReady, setSetupReady] = useState(false);
  const [hasTeacher, setHasTeacher] = useState(true);
  useEffect(() => { api<{ hasTeacher: boolean }>('/api/auth/setup').then((result) => setHasTeacher(result.hasTeacher)).catch(() => setHasTeacher(true)).finally(() => setSetupReady(true)); }, []);
  if (!setupReady) return <AuthCard title="Đang kiểm tra thiết lập" subtitle="Vui lòng chờ…"><p classHọ và tên="font-bold text-slate-500">Đang tải thiết lập tài khoản.</p></AuthCard>;
  if (hasTeacher) return <AuthCard title="Đã đóng đăng ký" subtitle="Tài khoản giáo viên được quản lý bởi giáo viên đầu tiên."><Banner tone="error">Đã có tài khoản giáo viên. Hãy nhờ giáo viên đầu tiên tạo tài khoản cho bạn.</Banner><p classHọ và tên="mt-4 text-sm font-bold"><Link classHọ và tên="text-[#315fbf]" to="/login">Quay lại đăng nhập</Link></p></AuthCard>;

  return (
    <AuthCard title="Đăng ký tài khoản giáo viên" subtitle="Tài khoản học sinh được tạo trong từng lớp học.">
      <form
        classHọ và tên="grid gap-3"
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
        <Field label="Họ và tên">
          <input classHọ và tên={controlLớp} value={name} onChange={(event) => setHọ và tên(event.target.value)} required />
        </Field>
        <Field label="Email">
          <input classHọ và tên={controlLớp} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </Field>
        <Field label="Mật khẩu">
          <input classHọ và tên={controlLớp} type="password" value={password} onChange={(event) => setMật khẩu(event.target.value)} required minLength={6} />
        </Field>
        <Button type="submit" disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo tài khoản giáo viên'}</Button>
      </form>
      <p classHọ và tên="mt-4 text-sm font-bold">
        Đã có tài khoản? <Link classHọ và tên="text-[#315fbf]" to="/login">Đăng nhập</Link>
      </p>
    </AuthCard>
  );
}

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div classHọ và tên="mx-auto grid min-h-screen max-w-md place-items-center px-4 py-10">
      <div classHọ và tên="w-full">
        <p classHọ và tên="font-display text-4xl text-[#FF914D]">Hằng ngày Duty</p>
        <h1 classHọ và tên="mt-2 text-2xl font-extrabold">{title}</h1>
        <p classHọ và tên="mb-4 font-bold text-slate-500">{subtitle}</p>
        <div classHọ và tên="rounded-3xl bg-white p-5 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
