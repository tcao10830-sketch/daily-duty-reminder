import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarBoard } from '../../components/CalendarBoard';
import { Banner, Button, Empty, Field, Loading, Ring, StatusPill, WeekBars, controlClass } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { formatStamp, translateNotificationBody, translateNotificationTitle } from '../../lib/format';
import { useQuery } from '../../lib/query';
import type { AssignmentCard, ClassSummary, NotificationItem, TaskSummary, User, WeekPoint } from '../../types';

export function TeacherCalendarPage() {
  const { data, loading, error } = useQuery<{ tasks: TaskSummary[] }>('/api/teacher/tasks');
  if (loading && !data) return <Loading />;
  if (error) return <Banner tone="error">{error}</Banner>;
  const items = (data?.tasks ?? [])
    .filter((task) => task.taskStatus === 'active')
    .map((task) => ({
      date: task.deadlineDate,
      title: task.title,
      href: `/teacher/tasks/${task.id}`,
      meta: `${task.className} · ${task.completionRate}%`,
    }));
  return <CalendarBoard items={items} />;
}

export function ProgressPage() {
  const overview = useQuery<{ classes: ClassSummary[]; tasks: TaskSummary[] }>('/api/teacher/overview');
  if (overview.loading && !overview.data) return <Loading />;
  if (!overview.data) return <Banner tone="error">{overview.error}</Banner>;
  const tasks = overview.data.tasks.filter((task) => task.taskStatus === 'active');
  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-2">
        {overview.data.classes.map((item) => (
          <Link key={item.id} to={`/teacher/classes/${item.id}`} className="rounded-3xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold">{item.name}</h2>
              <Ring value={item.completionRate} />
            </div>
            <p className="font-bold text-slate-500">{item.completedCount} đã hoàn thành · {item.pendingCount} đang chờ · {item.overdueCount} quá hạn</p>
          </Link>
        ))}
      </section>
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xl font-extrabold">Mở nhiệm vụ để xem tiến độ từng học sinh</h2>
        <div className="grid gap-2">
          {tasks.map((task) => (
            <Link key={task.id} to={`/teacher/tasks/${task.id}`} className="flex items-center justify-between rounded-2xl bg-[#f7fbff] px-3 py-2 font-extrabold">
              <span>{task.title} · {task.className}</span>
              <span>{task.completedCount}/{task.assignedCount} · {task.completionRate}%</span>
            </Link>
          ))}
          {tasks.length === 0 ? <Empty>Không có nhiệm vụ đang hoạt động.</Empty> : null}
        </div>
      </section>
    </div>
  );
}

export function StudentProgressPage() {
  const { id = '' } = useParams();
  const { data, error, loading } = useQuery<{
    student: { name: string; email: string; class_name: string };
    stats: { assigned: number; completed: number; pending: number; overdue: number; completionRate: number };
    assignments: AssignmentCard[];
    weekly: WeekPoint[];
  }>(`/api/teacher/students/${id}`);
  if (loading && !data) return <Loading />;
  if (!data) return <Banner tone="error">{error || 'Không tìm thấy học sinh.'}</Banner>;
  return (
    <div className="grid gap-4">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold">{data.student.name}</h1>
          <p className="font-bold text-slate-500">{data.student.class_name} · {data.student.email}</p>
          <p className="mt-2 font-bold">{data.stats.completed} đã hoàn thành · {data.stats.pending} đang chờ · {data.stats.overdue} quá hạn</p>
        </div>
        <Ring value={data.stats.completionRate} />
      </section>
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-extrabold">Nhiệm vụ hoàn thành theo tuần</h2>
        <WeekBars days={data.weekly} />
      </section>
      <div className="overflow-x-auto rounded-3xl bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="font-extrabold"><tr><th className="p-3">Nhiệm vụ</th><th className="p-3">Trạng thái</th><th className="p-3">Đã hoàn thành</th></tr></thead>
          <tbody>
            {data.assignments.map((row) => (
              <tr key={row.assignmentId} className="border-t">
                <td className="p-3 font-extrabold"><Link to={`/teacher/tasks/${row.taskId}`}>{row.title}</Link></td>
                <td className="p-3"><StatusPill status={row.status} /></td>
                <td className="p-3 font-bold">{row.completedAt ? formatStamp(row.completedAt) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function NotificationsPage() {
  const { data, error, loading } = useQuery<{ notifications: NotificationItem[]; unread: number }>('/api/notifications');
  const { bump } = useAuth();
  if (loading && !data) return <Loading />;
  if (error) return <Banner tone="error">{error}</Banner>;
  const removeOne = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa thông báo này không?')) return;
    await api(`/api/notifications/${id}`, { method: 'DELETE' });
    bump();
  };
  const removeAll = async () => {
    if (!window.confirm('Bạn có chắc muốn xóa tất cả thông báo? Thao tác này không thể hoàn tác.')) return;
    await api('/api/notifications', { method: 'DELETE' });
    bump();
  };
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">Thông báo</h1>
        <div className="flex gap-2">
          <Button tone="ghost" onClick={() => void api('/api/notifications/read-all', { method: 'POST' }).then(() => bump())}>Đánh dấu đã đọc tất cả</Button>
          <Button tone="red" onClick={() => void removeAll()}>Xóa tất cả</Button>
        </div>
      </div>
      {data?.notifications.length === 0 ? <Empty>Chưa có thông báo. Thông báo sẽ xuất hiện khi nhiệm vụ được giao, cập nhật, hoàn thành hoặc quá hạn.</Empty> : null}
      {data?.notifications.map((item) => (
        <div key={item.id} className={`flex items-start gap-3 rounded-3xl p-4 shadow-sm ${item.read ? 'bg-white' : 'bg-[#FFF3B0]'}`}>
          <button type="button" onClick={() => void api(`/api/notifications/${item.id}/read`, { method: 'POST' }).then(() => bump())} className="min-w-0 flex-1 text-left">
            <p className="font-extrabold">{translateNotificationTitle(item.title)}</p>
            <p className="font-semibold">{translateNotificationBody(item.body)}</p>
            <p className="text-xs font-bold text-slate-500">{formatStamp(item.createdAt)}</p>
          </button>
          <button type="button" aria-label="Xóa thông báo" onClick={() => void removeOne(item.id)} className="rounded-xl bg-white/80 px-3 py-2 text-sm font-extrabold text-red-600 shadow-sm">Xóa</button>
        </div>
      ))}
    </div>
  );
}

export function SettingsPage() {
  const { user, setUser, bump } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [canManageTeachers, setCanManageTeachers] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [creatingTeacher, setCreatingTeacher] = useState(false);

  useEffect(() => {
    api<{ canManageTeachers: boolean }>('/api/teacher/permissions')
      .then((result) => setCanManageTeachers(result.canManageTeachers))
      .catch(() => setCanManageTeachers(false));
  }, []);

  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <h1 className="text-2xl font-extrabold">Cài đặt</h1>
      {message ? <Banner tone="ok">{message}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <form
        className="grid gap-3 rounded-3xl bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          api<{ user: User }>('/api/me', { method: 'PATCH', body: JSON.stringify({ name }) })
            .then((result) => {
              setUser(result.user);
              setMessage('Đã lưu tên.');
              bump();
            })
            .catch((err: Error) => setError(err.message));
        }}
      >
        <Field label="Tên hiển thị"><input className={controlClass} value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <p className="text-sm font-bold text-slate-500">{user?.email} · {user?.role} · giờ theo múi giờ Việt Nam</p>
        <Button type="submit">Lưu tên</Button>
      </form>
      <form
        className="grid gap-3 rounded-3xl bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          api('/api/me/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) })
            .then(() => {
              setCurrentPassword('');
              setNewPassword('');
              setMessage('Đã cập nhật mật khẩu.');
            })
            .catch((err: Error) => setError(err.message));
        }}
      >
        <Field label="Mật khẩu hiện tại"><input className={controlClass} type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></Field>
        <Field label="Mật khẩu mới"><input className={controlClass} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></Field>
        <Button type="submit" tone="orange">Đổi mật khẩu</Button>
      </form>
      {canManageTeachers ? (
        <form
          className="grid gap-3 rounded-3xl bg-white p-4 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            setCreatingTeacher(true);
            setError('');
            api('/api/teacher/teachers', {
              method: 'POST',
              body: JSON.stringify({ name: teacherName, email: teacherEmail, password: teacherPassword }),
            })
              .then(() => {
                setTeacherName('');
                setTeacherEmail('');
                setTeacherPassword('');
                setMessage('Đã tạo tài khoản giáo viên. Giáo viên có thể đăng nhập ngay.');
              })
              .catch((err: Error) => setError(err.message))
              .finally(() => setCreatingTeacher(false));
          }}
        >
          <div>
            <h2 className="font-extrabold">Quản lý tài khoản giáo viên</h2>
            <p className="text-sm font-bold text-slate-500">Chỉ giáo viên đầu tiên mới có thể tạo thêm tài khoản giáo viên.</p>
          </div>
          <Field label="Tên giáo viên"><input className={controlClass} value={teacherName} onChange={(event) => setTeacherName(event.target.value)} required /></Field>
          <Field label="Email giáo viên"><input className={controlClass} type="email" value={teacherEmail} onChange={(event) => setTeacherEmail(event.target.value)} required /></Field>
          <Field label="Mật khẩu tạm thời"><input className={controlClass} type="password" minLength={6} value={teacherPassword} onChange={(event) => setTeacherPassword(event.target.value)} required /></Field>
          <Button type="submit" disabled={creatingTeacher}>{creatingTeacher ? 'Đang tạo…' : 'Tạo tài khoản giáo viên'}</Button>
        </form>
      ) : null}
    </div>
  );
}
