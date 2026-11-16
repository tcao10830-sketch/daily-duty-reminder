import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarBoard } from '../../components/CalendarBoard';
import { StickyNote } from '../../components/StickyNote';
import { Banner, Button, Empty, Field, Loading, Modal, Ring, StatCard, StatusPill, WeekBars, controlClass } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { formatLongDate, formatStamp, formatTime } from '../../lib/format';
import { useQuery } from '../../lib/query';
import type { AssignmentCard, NotificationItem, User, WeekPoint } from '../../types';
import { STATUS_LABEL } from '../../types';

type Overview = {
  stats: { assigned: number; completed: number; pending: number; overdue: number; completionRate: number };
  today: AssignmentCard[];
  upcoming: AssignmentCard[];
  completed: AssignmentCard[];
  overdue: AssignmentCard[];
  weekly: WeekPoint[];
};

export function StudentHomePage() {
  const { user } = useAuth();
  const { data, error, loading } = useQuery<Overview>('/api/student/overview');
  if (loading && !data) return <Loading />;
  if (!data) return <Banner tone="error">{error}</Banner>;
  return (
    <div className="grid gap-4">
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-extrabold">Hello, {user?.name}</h1>
        <p className="font-bold text-slate-500">Your duties for today are on the board below.</p>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Assigned" value={data.stats.assigned} tint="#FFF3B0" />
        <StatCard label="Completed" value={data.stats.completed} tint="#D8F6E4" />
        <StatCard label="Pending" value={data.stats.pending} tint="#D6E6FF" />
        <StatCard label="Overdue" value={data.stats.overdue} tint="#FFD6E0" />
      </section>
      <NoteGrid title="Today" notes={data.today} empty="Nothing due today." />
      <NoteGrid title="Coming up" notes={data.upcoming} empty="No upcoming deadlines." />
      <NoteGrid title="Overdue" notes={data.overdue} empty="No overdue tasks." />
    </div>
  );
}

function NoteGrid({ title, notes, empty }: { title: string; notes: AssignmentCard[]; empty: string }) {
  return (
    <section>
      <h2 className="mb-2 text-xl font-extrabold">{title}</h2>
      {notes.length === 0 ? <Empty>{empty}</Empty> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <StickyNote
              key={note.assignmentId}
              id={note.assignmentId}
              href={`/student/tasks/${note.assignmentId}`}
              title={note.title}
              description={note.description}
              className={note.className}
              assignmentDate={note.assignmentDate}
              deadlineDate={note.deadlineDate}
              deadlineTime={note.deadlineTime}
              deadlineAt={note.deadlineAt}
              priority={note.priority}
              penalty={note.penalty}
              color={note.color}
              status={note.status}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function MyTasksPage() {
  const { data, error, loading } = useQuery<{ assignments: AssignmentCard[] }>('/api/student/tasks');
  const [filter, setFilter] = useState('all');
  if (loading && !data) return <Loading />;
  if (error) return <Banner tone="error">{error}</Banner>;
  const notes = (data?.assignments ?? []).filter((note) => {
    if (filter === 'todo') return note.status === 'pending' && !note.inProgress;
    if (filter === 'progress') return note.status === 'pending' && note.inProgress;
    if (filter === 'done') return note.status === 'on_time' || note.status === 'late';
    if (filter === 'overdue') return note.status === 'overdue';
    return true;
  });
  const filters = [
    ['all', 'All'],
    ['todo', 'To Do'],
    ['progress', 'In Progress'],
    ['done', 'Completed'],
    ['overdue', 'Overdue'],
  ];
  return (
    <div className="grid gap-4">
      <div className="flex gap-2 overflow-x-auto">
        {filters.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setFilter(id)} className={`shrink-0 rounded-full px-4 py-2 font-extrabold ${filter === id ? 'bg-[#FFD84D]' : 'bg-white'}`}>
            {label}
          </button>
        ))}
      </div>
      {notes.length === 0 ? <Empty>No tasks in this list.</Empty> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <StickyNote
              key={note.assignmentId}
              id={note.assignmentId}
              href={`/student/tasks/${note.assignmentId}`}
              title={note.title}
              description={note.description}
              className={note.className}
              assignmentDate={note.assignmentDate}
              deadlineDate={note.deadlineDate}
              deadlineTime={note.deadlineTime}
              deadlineAt={note.deadlineAt}
              priority={note.priority}
              penalty={note.penalty}
              color={note.color}
              status={note.status}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function StudentTaskPage() {
  const { id = '' } = useParams();
  const { data, error, loading } = useQuery<{ assignment: AssignmentCard }>(`/api/student/tasks/${id}`);
  const { bump } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  if (loading && !data) return <Loading />;
  if (!data) return <Banner tone="error">{error || 'Task not found.'}</Banner>;
  const task = data.assignment;
  const done = task.status === 'on_time' || task.status === 'late';

  async function complete() {
    setBusy(true);
    setFormError('');
    try {
      await api(`/api/student/assignments/${task.assignmentId}/complete`, { method: 'POST' });
      setOpen(false);
      bump();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save completion.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <StickyNote
        id={task.assignmentId}
        title={task.title}
        description={task.description}
        className={task.className}
        assignmentDate={task.assignmentDate}
        deadlineDate={task.deadlineDate}
        deadlineTime={task.deadlineTime}
        deadlineAt={task.deadlineAt}
        priority={task.priority}
        penalty={task.penalty}
        color={task.color}
        status={task.status}
      />
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <p className="font-bold">Due {formatLongDate(task.deadlineDate)} at {formatTime(task.deadlineTime)}</p>
        <div className="mt-3 rounded-2xl bg-[#FFF3B0] p-3 font-extrabold">Penalty if late: {task.penalty || 'None'}</div>
        {task.instructions ? <p className="mt-3 font-bold">Instructions: {task.instructions}</p> : null}
        <div className="mt-4"><StatusPill status={task.status} /></div>
        {done && task.completedAt ? (
          <p className="mt-4 font-extrabold text-[#067a4b]" data-testid="completed-stamp">
            {STATUS_LABEL[task.status]} · {formatStamp(task.completedAt)}
          </p>
        ) : (
          <div className="mt-4 grid gap-2">
            {task.status === 'pending' && !task.inProgress ? (
              <Button tone="ghost" onClick={() => void api(`/api/student/assignments/${task.assignmentId}/start`, { method: 'POST' }).then(() => bump())}>
                Start — mark in progress
              </Button>
            ) : null}
            <button
              type="button"
              data-testid="complete-task"
              onClick={() => setOpen(true)}
              className="rounded-3xl bg-[#38C98B] px-4 py-4 text-xl font-extrabold text-white shadow-md"
            >
              ✓ ĐÃ HOÀN THÀNH
            </button>
          </div>
        )}
        {formError ? <div className="mt-3"><Banner tone="error">{formError}</Banner></div> : null}
      </section>
      <Modal open={open} title="Confirm completion" onClose={() => setOpen(false)}>
        <p className="font-bold">Save this task as finished? You cannot change it back yourself. Your teacher can reopen it.</p>
        <div className="mt-4 flex gap-2">
          <Button tone="green" disabled={busy} onClick={() => void complete()} testId="confirm-complete">{busy ? 'Saving…' : '✓ ĐÃ HOÀN THÀNH'}</Button>
          <Button tone="ghost" onClick={() => setOpen(false)}>Not yet</Button>
        </div>
      </Modal>
    </div>
  );
}

export function StudentCalendarPage() {
  const { data, loading, error } = useQuery<{ assignments: AssignmentCard[] }>('/api/student/tasks');
  if (loading && !data) return <Loading />;
  if (error) return <Banner tone="error">{error}</Banner>;
  const items = (data?.assignments ?? []).map((task) => ({
    date: task.deadlineDate,
    title: task.title,
    href: `/student/tasks/${task.assignmentId}`,
    meta: STATUS_LABEL[task.status],
  }));
  return <CalendarBoard items={items} />;
}

export function StudentProgressPage() {
  const { data, error, loading } = useQuery<Overview>('/api/student/overview');
  if (loading && !data) return <Loading />;
  if (!data) return <Banner tone="error">{error}</Banner>;
  return (
    <div className="grid gap-4">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold">My progress</h1>
          <p className="font-bold">{data.stats.assigned} assigned · {data.stats.completed} completed · {data.stats.pending} pending · {data.stats.overdue} overdue</p>
        </div>
        <Ring value={data.stats.completionRate} />
      </section>
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-extrabold">Weekly activity</h2>
        <WeekBars days={data.weekly} />
      </section>
      <section className="grid gap-2">
        {data.completed.map((task) => (
          <Link key={task.assignmentId} to={`/student/tasks/${task.assignmentId}`} className="rounded-2xl bg-white px-4 py-3 font-extrabold shadow-sm">
            {task.title} · {STATUS_LABEL[task.status]} {task.completedAt ? `· ${formatStamp(task.completedAt)}` : ''}
          </Link>
        ))}
        {data.completed.length === 0 ? <Empty>Completed tasks will show up here.</Empty> : null}
      </section>
    </div>
  );
}

export function StudentNotificationsPage() {
  const { data, error, loading } = useQuery<{ notifications: NotificationItem[] }>('/api/notifications');
  const { bump } = useAuth();
  if (loading && !data) return <Loading />;
  if (error) return <Banner tone="error">{error}</Banner>;
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Notifications</h1>
        <Button tone="ghost" onClick={() => void api('/api/notifications/read-all', { method: 'POST' }).then(() => bump())}>Mark all read</Button>
      </div>
      {data?.notifications.length === 0 ? <Empty>No notifications yet.</Empty> : null}
      {data?.notifications.map((item) => (
        <button key={item.id} type="button" onClick={() => void api(`/api/notifications/${item.id}/read`, { method: 'POST' }).then(() => bump())} className={`rounded-3xl p-4 text-left shadow-sm ${item.read ? 'bg-white' : 'bg-[#D6E6FF]'}`}>
          <p className="font-extrabold">{item.title}</p>
          <p className="font-semibold">{item.body}</p>
          <p className="text-xs font-bold text-slate-500">{formatStamp(item.createdAt)}</p>
        </button>
      ))}
    </div>
  );
}

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  return (
    <form
      className="mx-auto grid max-w-xl gap-3 rounded-3xl bg-white p-5 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        api<{ user: User }>('/api/me', { method: 'PATCH', body: JSON.stringify({ name }) })
          .then((result) => {
            setUser(result.user);
            setMessage('Profile saved.');
          })
          .catch((err: Error) => setError(err.message));
      }}
    >
      <h1 className="text-2xl font-extrabold">Profile</h1>
      {message ? <Banner tone="ok">{message}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Field label="Name"><input className={controlClass} value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <p className="font-bold text-slate-500">{user?.email}</p>
      <Button type="submit">Save</Button>
    </form>
  );
}
