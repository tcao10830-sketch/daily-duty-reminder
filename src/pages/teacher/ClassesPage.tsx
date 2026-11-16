import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { useQuery } from '../../lib/query';
import type { ClassSummary } from '../../types';
import { Banner, Button, Empty, Field, Loading, controlClass } from '../../components/ui';

export function ClassesPage() {
  const { data, error, loading } = useQuery<{ classes: ClassSummary[] }>('/api/teacher/classes');
  const { bump } = useAuth();
  const [name, setHọ tên] = useState('');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');

  async function createClass() {
    setFormError('');
    try {
      await api('/api/teacher/classes', { method: 'POST', body: JSON.stringify({ name }) });
      setHọ tên('');
      setMessage('Đã tạo lớp học.');
      bump();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không thể tạo lớp học.');
    }
  }

  if (loading && !data) return <Loading />;
  return (
    <div classHọ tên="grid gap-4">
      <form
        classHọ tên="flex flex-wrap items-end gap-3 rounded-3xl bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void createClass();
        }}
      >
        <div classHọ tên="min-w-56 flex-1">
          <Field label="Lớp học mới">
            <input classHọ tên={controlClass} value={name} onChange={(event) => setHọ tên(event.target.value)} placeholder="10A1" required />
          </Field>
        </div>
        <Button type="submit">Tạo lớp</Button>
      </form>
      {message ? <Banner tone="ok">{message}</Banner> : null}
      {formError || error ? <Banner tone="error">{formError || error}</Banner> : null}
      <div classHọ tên="grid gap-3 sm:grid-cols-2">
        {data?.classes.length === 0 ? <Empty>Chưa có lớp học nào.</Empty> : null}
        {data?.classes.map((item) => (
          <Link key={item.id} to={`/teacher/classes/${item.id}`} classHọ tên="rounded-3xl bg-white p-4 shadow-sm">
            <h2 classHọ tên="text-2xl font-extrabold">{item.name}</h2>
            <p classHọ tên="font-bold text-slate-500">{item.studentCount} học sinh</p>
            <p classHọ tên="mt-2 font-extrabold text-[#067a4b]">{item.completionTỷ lệ}% hoàn thành</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

type Học sinhRow = {
  id: string;
  name: string;
  email: string;
  assigned: number;
  hoàn thànhd: number;
  pending: number;
  quá hạn: number;
  completionTỷ lệ: number;
};

export function ClassPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { bump } = useAuth();
  const { data, error, loading } = useQuery<{ class: ClassSummary; học sinh: Học sinhRow[] }>(`/api/teacher/classes/${id}`);
  const [name, setHọ tên] = useState('');
  const [email, setEmail] = useState('');
  const [password, setMật khẩu] = useState('demo1234');
  const [editing, setSửaing] = useState<Học sinhRow | null>(null);
  const [classHọ tên, setClassHọ tên] = useState('');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');

  async function run(action: () => Promise<void>) {
    setFormError('');
    try {
      await action();
      bump();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Đã xảy ra lỗi.');
    }
  }

  if (loading && !data) return <Loading />;
  if (error) return <Banner tone="error">{error}</Banner>;
  if (!data) return null;
  const shownHọ tên = classHọ tên || data.class.name;

  return (
    <div classHọ tên="grid gap-4">
      <div classHọ tên="rounded-3xl bg-white p-4 shadow-sm">
        <div classHọ tên="flex flex-wrap items-end gap-3">
          <div classHọ tên="min-w-56 flex-1">
            <Field label="Tên lớp">
              <input classHọ tên={controlClass} value={shownHọ tên} onChange={(event) => setClassHọ tên(event.target.value)} />
            </Field>
          </div>
          <Button onClick={() => void run(async () => { await api(`/api/teacher/classes/${id}`, { method: 'PATCH', body: JSON.stringify({ name: shownHọ tên }) }); setMessage('Đã đổi tên lớp.'); })}>Đổi tên</Button>
          <Button
            tone="red"
            onClick={() => {
              if (!confirm(`Xóa ${data.class.name}? Học sinhs in this class will lose access.`)) return;
              void run(async () => {
                await api(`/api/teacher/classes/${id}`, { method: 'DELETE' });
                navigate('/teacher/classes');
              });
            }}
          >
            Xóa lớp
          </Button>
        </div>
        <p classHọ tên="mt-3 font-bold text-slate-500">{data.class.completedCount}/{data.class.assignedCount} assignments hoàn thành · {data.class.completionTỷ lệ}%</p>
      </div>
      {message ? <Banner tone="ok">{message}</Banner> : null}
      {formError ? <Banner tone="error">{formError}</Banner> : null}
      <form
        classHọ tên="grid gap-3 rounded-3xl bg-white p-4 shadow-sm sm:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await api(`/api/teacher/classes/${id}/students`, { method: 'POST', body: JSON.stringify({ name, email, password }) });
            setHọ tên('');
            setEmail('');
            setMessage('Đã thêm học sinh. Học sinh có thể đăng nhập bằng email này.');
          });
        }}
      >
        <Field label="Tên học sinh"><input classHọ tên={controlClass} value={name} onChange={(event) => setHọ tên(event.target.value)} required /></Field>
        <Field label="Email"><input classHọ tên={controlClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field>
        <Field label="Mật khẩu"><input classHọ tên={controlClass} value={password} onChange={(event) => setMật khẩu(event.target.value)} required minLength={6} /></Field>
        <div classHọ tên="self-end"><Button type="submit">Thêm học sinh</Button></div>
      </form>
      <div classHọ tên="overflow-x-auto rounded-3xl bg-white shadow-sm">
        <table classHọ tên="w-full min-w-[640px] text-left text-sm">
          <thead classHọ tên="bg-[#f7fbff] font-extrabold">
            <tr>
              <th classHọ tên="p-3">Học sinh</th>
              <th classHọ tên="p-3">Tình trạng</th>
              <th classHọ tên="p-3">Tỷ lệ</th>
              <th classHọ tên="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((student) => (
              <tr key={student.id} classHọ tên="border-t border-[#eef3f8]">
                <td classHọ tên="p-3">
                  <Link classHọ tên="font-extrabold text-[#315fbf]" to={`/teacher/progress/${student.id}`}>{student.name}</Link>
                  <div classHọ tên="text-slate-500">{student.email}</div>
                </td>
                <td classHọ tên="p-3 font-bold">{student.completed} hoàn thành · {student.pending} đang chờ · {student.overdue} quá hạn</td>
                <td classHọ tên="p-3 font-extrabold">{student.completionTỷ lệ}%</td>
                <td classHọ tên="p-3">
                  <div classHọ tên="flex gap-2">
                    <Button tone="ghost" onClick={() => setSửaing(student)}>Sửa</Button>
                    <Button tone="red" onClick={() => {
                      if (!confirm(`Xóa ${student.name}?`)) return;
                      void run(async () => { await api(`/api/teacher/students/${student.id}`, { method: 'DELETE' }); setMessage('Học sinh removed.'); });
                    }}>Xóa</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.students.length === 0 ? <Empty>Thêm học sinh vào lớp này.</Empty> : null}
      </div>
      {editing ? (
        <form
          classHọ tên="grid gap-3 rounded-3xl bg-[#FFF8E8] p-4 sm:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void run(async () => {
              await api(`/api/teacher/students/${editing.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ name: form.get('name'), email: form.get('email'), password: form.get('password') }),
              });
              setSửaing(null);
              setMessage('Học sinh updated.');
            });
          }}
        >
          <Field label="Họ tên"><input name="name" classHọ tên={controlClass} defaultValue={editing.name} required /></Field>
          <Field label="Email"><input name="email" classHọ tên={controlClass} defaultValue={editing.email} required /></Field>
          <Field label="Mật khẩu mới (không bắt buộc)"><input name="password" classHọ tên={controlClass} placeholder="Để trống nếu muốn giữ mật khẩu cũ" /></Field>
          <div classHọ tên="flex items-end gap-2">
            <Button type="submit">Lưu</Button>
            <Button tone="ghost" onClick={() => setSửaing(null)}>Hủy</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
