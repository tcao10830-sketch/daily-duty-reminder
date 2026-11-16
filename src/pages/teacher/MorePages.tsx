import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarBoard } from '../../components/CalendarBoard';
import { Banner, Button, Empty, Field, Loading, Ring, StatusPill, WeekBars, controlClass } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { formatStamp } from '../../lib/format';
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
            <p className="font-bold text-slate-500">{item.completedCount} completed · {item.pendingCount} pending · {item.overdueCount} overdue</p>
          </Link>
        ))}
      </section>
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xl font-extrabold">Open a task to see each student</h2>
        <div className="grid gap-2">
          {tasks.map((task) => (
            <Link key={task.id} to={`/teacher/tasks/${task.id}`} className="flex items-center justify-between rounded-2xl bg-[#f7fbff] px-3 py-2 font-extrabold">
              <span>{task.title} · {task.className}</span>
              <span>{task.completedCount}/{task.assignedCount} · {task.completionRate}%</span>
            </Link>
          ))}
          {tasks.length === 0 ? <Empty>No active tasks.</Empty> : null}
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
  if (!data) return <Banner tone="error">{error || 'Student not found.'}</Banner>;
  return (
    <div className="grid gap-4">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold">{data.student.name}</h1>
          <p className="font-bold text-slate-500">{data.student.class_name} · {data.student.email}</p>
          <p className="mt-2 font-bold">{data.stats.completed} completed · {data.stats.pending} pending · {data.stats.overdue} overdue</p>
        </div>
        <Ring value={data.stats.completionRate} />
      </section>
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-extrabold">Weekly completions</h2>
        <WeekBars days={data.weekly} />
      </section>
      <div className="overflow-x-auto rounded-3xl bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="font-extrabold"><tr><th className="p-3">Task</th><th className="p-3">Status</th><th className="p-3">Completed</th></tr></thead>
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
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Notifications</h1>
        <Button tone="ghost" onClick={() => void api('/api/notifications/read-all', { method: 'POST' }).then(() => bump())}>Mark all read</Button>
      </div>
      {data?.notifications.length === 0 ? <Empty>No notifications yet. They appear when tasks are assigned, updated, completed, or become overdue.</Empty> : null}
      {data?.notifications.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => void api(`/api/notifications/${item.id}/read`, { method: 'POST' }).then(() => bump())}
          className={`rounded-3xl p-4 text-left shadow-sm ${item.read ? 'bg-white' : 'bg-[#FFF3B0]'}`}
        >
          <p className="font-extrabold">{item.title}</p>
          <p className="font-semibold">{item.body}</p>
          <p className="text-xs font-bold text-slate-500">{formatStamp(item.createdAt)}</p>
        </button>
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

  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <h1 className="text-2xl font-extrabold">Settings</h1>
      {message ? <Banner tone="ok">{message}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <form
        className="grid gap-3 rounded-3xl bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          api<{ user: User }>('/api/me', { method: 'PATCH', body: JSON.stringify({ name }) })
            .then((result) => {
              setUser(result.user);
              setMessage('Name saved.');
              bump();
            })
            .catch((err: Error) => setError(err.message));
        }}
      >
        <Field label="Display name"><input className={controlClass} value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <p className="text-sm font-bold text-slate-500">{user?.email} · {user?.role} · times use Asia/Ho_Chi_Minh</p>
        <Button type="submit">Save name</Button>
      </form>
      <form
        className="grid gap-3 rounded-3xl bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          api('/api/me/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) })
            .then(() => {
              setCurrentPassword('');
              setNewPassword('');
              setMessage('Password updated.');
            })
            .catch((err: Error) => setError(err.message));
        }}
      >
        <Field label="Current password"><input className={controlClass} type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></Field>
        <Field label="New password"><input className={controlClass} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></Field>
        <Button type="submit" tone="orange">Change password</Button>
      </form>
    </div>
  );
}
