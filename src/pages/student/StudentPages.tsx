import { useCallback, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarBoard } from '../../components/CalendarBoard';
import { Mascot } from '../../components/Mascot';
import { SubmissionCelebration } from '../../components/SubmissionCelebration';
import { StickyNote } from '../../components/StickyNote';
import { Banner, Button, Empty, Field, Loading, Modal, Ring, StatCard, StatusPill, WeekBars, controlClass } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { fileUploadPayload } from '../../lib/fileUpload';
import { playSubmissionCelebration } from '../../lib/sounds';
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
      <section className="dashboard-hero flex items-center justify-between gap-3 px-5 py-5 sm:px-7 sm:py-6">
        <div className="relative z-10 max-w-xl">
          <span className="inline-flex rounded-full bg-white/75 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[#a66b22]">Your study corner</span>
          <h1 className="mt-3 font-display text-3xl leading-tight text-[#34445e] sm:text-4xl">Hello, {user?.name}!</h1>
          <p className="mt-2 max-w-lg text-sm font-bold leading-relaxed text-[#5f6d7f] sm:text-base">Your duties for today are on the board below. One small step at a time — you’ve got this!</p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-extrabold text-[#4d8c6d]">
            <span className="text-[#FF914D]">✦</span> Keep growing, keep glowing
          </div>
        </div>
        <div className="relative z-10 shrink-0">
          <Mascot size={132} />
        </div>
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
              submissionPending={note.submissionPending}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function MyTasksPage() {
  const { data, error, loading } = useQuery<{ assignments: AssignmentCard[] }>('/api/student/tasks');
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  if (loading && !data) return <Loading />;
  if (error) return <Banner tone="error">{error}</Banner>;
  const now = Date.now();
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const endOfToday = startOfToday + 24 * 60 * 60 * 1000;
  const endOfWeek = endOfToday + 7 * 24 * 60 * 60 * 1000;
  const notes = (data?.assignments ?? [])
    .filter((note) => {
      const deadline = new Date(note.deadlineAt).getTime();
      if (dateFilter === 'today') return deadline >= startOfToday && deadline < endOfToday;
      if (dateFilter === 'week') return deadline >= startOfToday && deadline < endOfWeek;
      if (dateFilter === 'later') return deadline >= endOfWeek;
      return true;
    })
    .filter((note) => {
      if (statusFilter === 'pending') return note.status === 'pending';
      if (statusFilter === 'upcoming') return note.status === 'pending' && new Date(note.deadlineAt).getTime() - now > 48 * 60 * 60 * 1000;
      if (statusFilter === 'overdue') return note.status === 'overdue';
      return true;
    })
    .filter((note) => priorityFilter === 'all' || note.priority === priorityFilter)
    .sort((a, b) => {
      const rank = (note: AssignmentCard) => note.status === 'overdue' ? 0 : note.status === 'pending' && new Date(note.deadlineAt).getTime() - now <= 48 * 60 * 60 * 1000 ? 1 : note.status === 'pending' ? 2 : 3;
      return rank(a) - rank(b) || new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime();
    });
  return (
    <div className="grid gap-4">
      <section className="grid gap-3 rounded-3xl bg-white p-4 shadow-sm sm:grid-cols-3">
        <label className="grid gap-1 text-sm font-extrabold text-[#34445e]">Deadline date
          <select className={controlClass} value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>
            <option value="all">All dates</option>
            <option value="today">Due today</option>
            <option value="week">Next 7 days</option>
            <option value="later">After 7 days</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-extrabold text-[#34445e]">Status
          <select className={controlClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="upcoming">Upcoming (over 48 hours)</option>
            <option value="overdue">Overdue</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-extrabold text-[#34445e]">Priority
          <select className={controlClass} value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
      </section>
      {notes.length === 0 ? <Empty>No tasks match these filters.</Empty> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <div key={note.assignmentId} className="relative">
              {note.status === 'overdue' ? <span className="absolute -top-2 -right-2 z-10 rounded-full bg-red-600 px-3 py-1 text-sm font-black text-white shadow-md" aria-label="Overdue warning">⚠ OVERDUE</span> : null}
              {note.status === 'pending' && new Date(note.deadlineAt).getTime() - now <= 48 * 60 * 60 * 1000 ? <span className="absolute -top-2 -right-2 z-10 rounded-full bg-amber-400 px-3 py-1 text-sm font-black text-[#513b12] shadow-md">⏰ DUE SOON</span> : null}
              <StickyNote
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
              submissionPending={note.submissionPending}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StudentTaskPage() {
  const { id = '' } = useParams();
  const { data, error, loading } = useQuery<{ assignment: AssignmentCard }>(`/api/student/tasks/${id}`);
  const materials = useQuery<{ materials: { id: string; file_name: string; signedUrl: string | null; link_url: string | null }[] }>(`/api/student/tasks/${id}/materials`);
  const submissions = useQuery<{ submissions: { id: string; file_name: string; files?: { file_name: string; signedUrl: string | null }[]; signedUrl: string | null; link_url: string | null; comment: string; created_at: string; review: { status: 'approved' | 'revision_requested'; feedback: string; created_at: string } | null }[] }>(`/api/student/assignments/${id}/submissions`);
  const { bump } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [link, setLink] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  const closeCelebration = useCallback(() => setShowCelebration(false), []);
  if (loading && !data) return <Loading />;
  if (!data) return <Banner tone="error">{error || 'Task not found.'}</Banner>;
  const task = data.assignment;
  const done = task.status === 'on_time' || task.status === 'late';
  const latest = submissions.data?.submissions?.[0];

  async function submitWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    setMessage('');
    try {
      const totalBytes = files.reduce((sum, item) => sum + item.size, 0);
      if (totalBytes > 10 * 1024 * 1024) throw new Error('All files together must be 10 MB or smaller.');
      const payload: Record<string, unknown> = { linkUrl: link.trim(), comment };
      if (files.length) payload.files = await Promise.all(files.map((item) => fileUploadPayload(item)));
      if (!files.length && !link.trim()) throw new Error('Choose one or more files or add a link before submitting.');
      await api(`/api/student/assignments/${task.assignmentId}/submissions`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setFiles([]);
      setLink('');
      setComment('');
      setMessage('Your work has been submitted. The countdown is paused while your teacher reviews it.');
      setShowCelebration(true);
      playSubmissionCelebration();
      bump();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not submit your work.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      {showCelebration ? <SubmissionCelebration onDone={closeCelebration} /> : null}
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
        submissionPending={task.submissionPending}
      />
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <p className="font-bold">Due {formatLongDate(task.deadlineDate)} at {formatTime(task.deadlineTime)}</p>
        <div className="mt-3 rounded-2xl bg-[#FFF3B0] p-3 font-extrabold">Penalty if late: {task.penalty || 'None'}</div>
        {task.instructions ? <p className="mt-3 font-bold">Instructions: {task.instructions}</p> : null}
        <div className="mt-4"><StatusPill status={task.status} /></div>
        {task.submissionPending ? <p className="mt-3 rounded-xl bg-[#D6E6FF] p-3 font-extrabold text-[#315fc4]">Submitted successfully. The countdown is paused while you wait for your teacher to review.</p> : null}
        {task.revisionDeadlineAt && !task.submissionPending && !done ? <p className="mt-3 rounded-xl bg-[#FFE0C2] p-3 font-extrabold text-orange-900">Needs revision · New deadline: {formatStamp(task.revisionDeadlineAt)}</p> : null}
        {done && task.completedAt ? (
          <p className="mt-4 font-extrabold text-[#067a4b]" data-testid="completed-stamp">
            Approved by your teacher · {formatStamp(task.completedAt)}
          </p>
        ) : null}
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-extrabold">Materials from your teacher</h2>
        {materials.loading && !materials.data ? <Loading /> : null}
        {materials.error ? <Banner tone="error">{materials.error}</Banner> : null}
        {(materials.data?.materials ?? []).length === 0 ? <p className="text-sm font-semibold text-slate-500">No reference materials attached.</p> : (
          <ul className="grid gap-2">
            {materials.data?.materials.map((item) => (
              <li key={item.id}>
                <a className="font-extrabold text-[#315fc4] underline" href={item.signedUrl || item.link_url || '#'} target="_blank" rel="noreferrer">{item.file_name}</a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-extrabold">Your submission</h2>
        {latest ? (
          <div className="mb-4 rounded-2xl bg-[#f4f8ff] p-3">
            <p className="font-extrabold">Latest submission</p>
            <div className="mt-1 grid gap-1">
              {(latest.files?.length ? latest.files : [{ file_name: latest.file_name, signedUrl: latest.signedUrl }]).map((item, index) => (
                <a key={`${item.file_name}-${index}`} className="break-all text-sm font-bold text-[#315fc4] underline" href={item.signedUrl || latest.link_url || '#'} target="_blank" rel="noreferrer">{item.file_name}</a>
              ))}
            </div>
            <p className="text-xs font-semibold text-slate-500">{formatStamp(latest.created_at)}</p>
            {latest.review ? (
              <div className={`mt-2 rounded-xl p-3 font-bold ${latest.review.status === 'approved' ? 'bg-[#D8F6E4] text-green-800' : 'bg-[#FFE0C2] text-orange-900'}`}>
                {latest.review.status === 'approved' ? 'Approved' : 'Please revise and submit again'}
                {latest.review.feedback ? <p className="mt-1 font-semibold">Teacher feedback: {latest.review.feedback}</p> : null}
              </div>
            ) : <p className="mt-2 text-sm font-bold text-[#315fc4]">Waiting for your teacher to review.</p>}
          </div>
        ) : <p className="mb-3 text-sm font-semibold text-slate-500">You need to submit a file or a link before this task can be completed.</p>}

        {!done && !task.submissionPending ? (
          <form className="grid gap-3" onSubmit={(event) => void submitWork(event)}>
            <Field label="Upload files or photos (PDF, Word or images — 10 MB total)">
              <input className={controlClass} type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
              {files.length > 0 ? (
                <div className="mt-2 grid gap-1 rounded-xl bg-[#f4f8ff] p-2 text-sm">
                  {files.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 break-all">{item.name} · {(item.size / 1024 / 1024).toFixed(2)} MB</span>
                      <button type="button" className="shrink-0 font-extrabold text-red-600" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}>Remove</button>
                    </div>
                  ))}
                  <p className="font-extrabold">Total: {(files.reduce((sum, item) => sum + item.size, 0) / 1024 / 1024).toFixed(2)} / 10 MB</p>
                </div>
              ) : null}
            </Field>
            <Field label="Or paste a link">
              <input className={controlClass} type="url" value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://..." />
            </Field>
            <Field label="Message to your teacher (optional)">
              <textarea className={controlClass} rows={2} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a short note..." />
            </Field>
            {formError ? <Banner tone="error">{formError}</Banner> : null}
            {message ? <Banner tone="ok">{message}</Banner> : null}
            <Button type="submit" tone="green" disabled={busy}>{busy ? 'Submitting…' : latest?.review?.status === 'revision_requested' ? 'Submit revised work' : 'Submit work for review'}</Button>
          </form>
        ) : null}
      </section>
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
  const removeOne = async (id: string) => {
    if (!window.confirm('Delete this notification?')) return;
    await api(`/api/notifications/${id}`, { method: 'DELETE' });
    bump();
  };
  const removeAll = async () => {
    if (!window.confirm('Delete all notifications? This cannot be undone.')) return;
    await api('/api/notifications', { method: 'DELETE' });
    bump();
  };
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">Notifications</h1>
        <div className="flex gap-2">
          <Button tone="ghost" onClick={() => void api('/api/notifications/read-all', { method: 'POST' }).then(() => bump())}>Mark all read</Button>
          <Button tone="red" onClick={() => void removeAll()}>Delete all</Button>
        </div>
      </div>
      {data?.notifications.length === 0 ? <Empty>No notifications yet.</Empty> : null}
      {data?.notifications.map((item) => (
        <div key={item.id} className={`flex items-start gap-3 rounded-3xl p-4 shadow-sm ${item.read ? 'bg-white' : 'bg-[#D6E6FF]'}`}>
          <button type="button" onClick={() => void api(`/api/notifications/${item.id}/read`, { method: 'POST' }).then(() => bump())} className="min-w-0 flex-1 text-left">
            <p className="font-extrabold">{item.title}</p>
            <p className="font-semibold">{item.body}</p>
            <p className="text-xs font-bold text-slate-500">{formatStamp(item.createdAt)}</p>
          </button>
          <button type="button" aria-label="Delete notification" onClick={() => void removeOne(item.id)} className="rounded-xl bg-white/80 px-3 py-2 text-sm font-extrabold text-red-600 shadow-sm">Delete</button>
        </div>
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
