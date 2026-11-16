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
  stats: { assigned: number; completed: number; pending: number; quá hạn: number; completionRate: number };
  today: AssignmentCard[];
  upcoming: AssignmentCard[];
  completed: AssignmentCard[];
  quá hạn: AssignmentCard[];
  weekly: WeekPoint[];
};

export function StudentHomePage() {
  const { user } = useAuth();
  const { data, error, loading } = useQuery<Overview>('/api/student/overview');
  if (loading && !data) return <Loading />;
  if (!data) return <Banner tone="error">{error}</Banner>;
  return (
    <div classHọ và tên="grid gap-4">
      <section classHọ và tên="dashboard-hero flex items-center justify-between gap-3 px-5 py-5 sm:px-7 sm:py-6">
        <div classHọ và tên="relative z-10 max-w-xl">
          <span classHọ và tên="inline-flex rounded-full bg-white/75 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[#a66b22]">Góc học tập của bạn</span>
          <h1 classHọ và tên="mt-3 font-display text-3xl leading-tight text-[#34445e] sm:text-4xl">Xin chào, {user?.name}!</h1>
          <p classHọ và tên="mt-2 max-w-lg text-sm font-bold leading-relaxed text-[#5f6d7f] sm:text-base">Nhiệm vụ hôm nay ở ngay bên dưới. Cứ từng bước nhỏ một nhé, bạn làm được!</p>
          <div classHọ và tên="mt-3 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-extrabold text-[#4d8c6d]">
            <span classHọ và tên="text-[#FF914D]">✦</span> Không ngừng tiến bộ mỗi ngày!
          </div>
        </div>
        <div classHọ và tên="relative z-10 shrink-0">
          <Mascot size={132} />
        </div>
      </section>
      <section classHọ và tên="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Được giao" value={data.stats.assigned} tint="#FFF3B0" />
        <StatCard label="Đã hoàn thành" value={data.stats.completed} tint="#D8F6E4" />
        <StatCard label="Đang chờ" value={data.stats.pending} tint="#D6E6FF" />
        <StatCard label="Quá hạn" value={data.stats.quá hạn} tint="#FFD6E0" />
      </section>
      <NoteGrid title="Hôm nay" notes={data.today} empty="Hôm nay không có nhiệm vụ đến hạn." />
      <NoteGrid title="Sắp tới" notes={data.upcoming} empty="Không có nhiệm vụ sắp đến hạn." />
      <NoteGrid title="Quá hạn" notes={data.quá hạn} empty="Không có nhiệm vụ quá hạn." />
    </div>
  );
}

function NoteGrid({ title, notes, empty }: { title: string; notes: AssignmentCard[]; empty: string }) {
  return (
    <section>
      <h2 classHọ và tên="mb-2 text-xl font-extrabold">{title}</h2>
      {notes.length === 0 ? <Empty>{empty}</Empty> : (
        <div classHọ và tên="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <StickyNote
              key={note.assignmentId}
              id={note.assignmentId}
              href={`/student/tasks/${note.assignmentId}`}
              title={note.title}
              description={note.description}
              classHọ và tên={note.classHọ và tên}
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
    if (filter === 'quá hạn') return note.status === 'quá hạn';
    return true;
  });
  const filters = [
    ['all', 'Tất cả'],
    ['todo', 'Chưa bắt đầu'],
    ['progress', 'Đang thực hiện'],
    ['done', 'Đã hoàn thành'],
    ['quá hạn', 'Quá hạn'],
  ];
  return (
    <div classHọ và tên="grid gap-4">
      <div classHọ và tên="flex gap-2 overflow-x-auto">
        {filters.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setFilter(id)} classHọ và tên={`shrink-0 rounded-full px-4 py-2 font-extrabold ${filter === id ? 'bg-[#FFD84D]' : 'bg-white'}`}>
            {label}
          </button>
        ))}
      </div>
      {notes.length === 0 ? <Empty>Không có nhiệm vụ nào trong danh sách này.</Empty> : (
        <div classHọ và tên="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <StickyNote
              key={note.assignmentId}
              id={note.assignmentId}
              href={`/student/tasks/${note.assignmentId}`}
              title={note.title}
              description={note.description}
              classHọ và tên={note.classHọ và tên}
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
      if (totalBytes > 10 * 1024 * 1024) throw new Error('Tất cả files together must be 10 MB or smaller.');
      const payload: Record<string, unknown> = { linkUrl: link.trim(), comment };
      if (files.length) payload.files = await Promise.all(files.map((item) => fileUploadPayload(item)));
      if (!files.length && !link.trim()) throw new Error('Hãy chọn ít nhất một tệp hoặc thêm đường dẫn trước khi nộp.');
      await api(`/api/student/assignments/${task.assignmentId}/submissions`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setFiles([]);
      setLink('');
      setComment('');
      setMessage('Bạn đã nộp bài thành công! Nhiệm vụ sẽ được đánh dấu hoàn thành sau khi giáo viên duyệt.');
      setShowCelebration(true);
      playSubmissionCelebration();
      bump();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không thể nộp bài.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div classHọ và tên="mx-auto grid max-w-2xl gap-4">
      {showCelebration ? <SubmissionCelebration onDone={closeCelebration} /> : null}
      <StickyNote
        id={task.assignmentId}
        title={task.title}
        description={task.description}
        classHọ và tên={task.classHọ và tên}
        assignmentDate={task.assignmentDate}
        deadlineDate={task.deadlineDate}
        deadlineTime={task.deadlineTime}
        deadlineAt={task.deadlineAt}
        priority={task.priority}
        penalty={task.penalty}
        color={task.color}
        status={task.status}
      />
      <section classHọ và tên="rounded-3xl bg-white p-5 shadow-sm">
        <p classHọ và tên="font-bold">Hạn nộp {formatLongDate(task.deadlineDate)} lúc {formatTime(task.deadlineTime)}</p>
        <div classHọ và tên="mt-3 rounded-2xl bg-[#FFF3B0] p-3 font-extrabold">Xử lý nếu nộp muộn: {task.penalty || 'Không có'}</div>
        {task.instructions ? <p classHọ và tên="mt-3 font-bold">Hướng dẫn: {task.instructions}</p> : null}
        <div classHọ và tên="mt-4"><StatusPill status={task.status} /></div>
        {done && task.completedAt ? (
          <p classHọ và tên="mt-4 font-extrabold text-[#067a4b]" data-testid="completed-stamp">
            Giáo viên đã duyệt · {formatStamp(task.completedAt)}
          </p>
        ) : null}
      </section>

      <section classHọ và tên="rounded-3xl bg-white p-5 shadow-sm">
        <h2 classHọ và tên="mb-3 text-lg font-extrabold">Tài liệu giáo viên gửi</h2>
        {materials.loading && !materials.data ? <Loading /> : null}
        {materials.error ? <Banner tone="error">{materials.error}</Banner> : null}
        {(materials.data?.materials ?? []).length === 0 ? <p classHọ và tên="text-sm font-semibold text-slate-500">Chưa có tài liệu tham khảo.</p> : (
          <ul classHọ và tên="grid gap-2">
            {materials.data?.materials.map((item) => (
              <li key={item.id}>
                <a classHọ và tên="font-extrabold text-[#315fc4] underline" href={item.signedUrl || item.link_url || '#'} target="_blank" rel="noreferrer">{item.file_name}</a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section classHọ và tên="rounded-3xl bg-white p-5 shadow-sm">
        <h2 classHọ và tên="mb-3 text-lg font-extrabold">Bài nộp của bạn</h2>
        {latest ? (
          <div classHọ và tên="mb-4 rounded-2xl bg-[#f4f8ff] p-3">
            <p classHọ và tên="font-extrabold">Lần nộp gần nhất</p>
            <div classHọ và tên="mt-1 grid gap-1">
              {(latest.files?.length ? latest.files : [{ file_name: latest.file_name, signedUrl: latest.signedUrl }]).map((item, index) => (
                <a key={`${item.file_name}-${index}`} classHọ và tên="break-all text-sm font-bold text-[#315fc4] underline" href={item.signedUrl || latest.link_url || '#'} target="_blank" rel="noreferrer">{item.file_name}</a>
              ))}
            </div>
            <p classHọ và tên="text-xs font-semibold text-slate-500">{formatStamp(latest.created_at)}</p>
            {latest.review ? (
              <div classHọ và tên={`mt-2 rounded-xl p-3 font-bold ${latest.review.status === 'approved' ? 'bg-[#D8F6E4] text-green-800' : 'bg-[#FFE0C2] text-orange-900'}`}>
                {latest.review.status === 'approved' ? 'Đã duyệt' : 'Vui lòng chỉnh sửa và nộp lại'}
                {latest.review.feedback ? <p classHọ và tên="mt-1 font-semibold">Nhận xét của giáo viên: {latest.review.feedback}</p> : null}
              </div>
            ) : <p classHọ và tên="mt-2 text-sm font-bold text-[#315fc4]">Đang chờ giáo viên xem bài.</p>}
          </div>
        ) : <p classHọ và tên="mb-3 text-sm font-semibold text-slate-500">Bạn cần nộp tệp hoặc đường dẫn trước khi nhiệm vụ được ghi nhận hoàn thành.</p>}

        {!done ? (
          <form classHọ và tên="grid gap-3" onSubmit={(event) => void submitWork(event)}>
            <Field label="Tải tệp hoặc ảnh lên (PDF, Word hoặc hình ảnh — tổng tối đa 10 MB)">
              <input classHọ và tên={controlClass} type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
              {files.length > 0 ? (
                <div classHọ và tên="mt-2 grid gap-1 rounded-xl bg-[#f4f8ff] p-2 text-sm">
                  {files.map((item, index) => (
                    <div key={`${item.name}-${index}`} classHọ và tên="flex items-center justify-between gap-2">
                      <span classHọ và tên="min-w-0 break-all">{item.name} · {(item.size / 1024 / 1024).toFixed(2)} MB</span>
                      <button type="button" classHọ và tên="shrink-0 font-extrabold text-red-600" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}>Xóa</button>
                    </div>
                  ))}
                  <p classHọ và tên="font-extrabold">Tổng cộng: {(files.reduce((sum, item) => sum + item.size, 0) / 1024 / 1024).toFixed(2)} / 10 MB</p>
                </div>
              ) : null}
            </Field>
            <Field label="Hoặc dán đường dẫn">
              <input classHọ và tên={controlClass} type="url" value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://..." />
            </Field>
            <Field label="Lời nhắn cho giáo viên (không bắt buộc)">
              <textarea classHọ và tên={controlClass} rows={2} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Viết lời nhắn ngắn..." />
            </Field>
            {formError ? <Banner tone="error">{formError}</Banner> : null}
            {message ? <Banner tone="ok">{message}</Banner> : null}
            <Button type="submit" tone="green" disabled={busy}>{busy ? 'Đang nộp bài…' : latest?.review?.status === 'revision_requested' ? 'Nộp lại bài đã chỉnh sửa' : 'Gửi bài để giáo viên duyệt'}</Button>
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
    <div classHọ và tên="grid gap-4">
      <section classHọ và tên="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-4 shadow-sm">
        <div>
          <h1 classHọ và tên="text-2xl font-extrabold">Tiến độ của tôi</h1>
          <p classHọ và tên="font-bold">{data.stats.assigned} được giao · {data.stats.completed} đã hoàn thành · {data.stats.pending} đang chờ · {data.stats.quá hạn} quá hạn</p>
        </div>
        <Ring value={data.stats.completionRate} />
      </section>
      <section classHọ và tên="rounded-3xl bg-white p-4 shadow-sm">
        <h2 classHọ và tên="mb-2 font-extrabold">Hoạt động trong tuần</h2>
        <WeekBars days={data.weekly} />
      </section>
      <section classHọ và tên="grid gap-2">
        {data.completed.map((task) => (
          <Link key={task.assignmentId} to={`/student/tasks/${task.assignmentId}`} classHọ và tên="rounded-2xl bg-white px-4 py-3 font-extrabold shadow-sm">
            {task.title} · {STATUS_LABEL[task.status]} {task.completedAt ? `· ${formatStamp(task.completedAt)}` : ''}
          </Link>
        ))}
        {data.completed.length === 0 ? <Empty>Đã hoàn thành tasks will show up here.</Empty> : null}
      </section>
    </div>
  );
}

export function StudentThông báoPage() {
  const { data, error, loading } = useQuery<{ notifications: NotificationItem[] }>('/api/notifications');
  const { bump } = useAuth();
  if (loading && !data) return <Loading />;
  if (error) return <Banner tone="error">{error}</Banner>;
  return (
    <div classHọ và tên="grid gap-3">
      <div classHọ và tên="flex items-center justify-between">
        <h1 classHọ và tên="text-2xl font-extrabold">Thông báo</h1>
        <Button tone="ghost" onClick={() => void api('/api/notifications/read-all', { method: 'POST' }).then(() => bump())}>Đánh dấu đã đọc tất cả</Button>
      </div>
      {data?.notifications.length === 0 ? <Empty>Chưa có thông báo nào.</Empty> : null}
      {data?.notifications.map((item) => (
        <button key={item.id} type="button" onClick={() => void api(`/api/notifications/${item.id}/read`, { method: 'POST' }).then(() => bump())} classHọ và tên={`rounded-3xl p-4 text-left shadow-sm ${item.read ? 'bg-white' : 'bg-[#D6E6FF]'}`}>
          <p classHọ và tên="font-extrabold">{item.title}</p>
          <p classHọ và tên="font-semibold">{item.body}</p>
          <p classHọ và tên="text-xs font-bold text-slate-500">{formatStamp(item.createdAt)}</p>
        </button>
      ))}
    </div>
  );
}

export function Hồ sơPage() {
  const { user, setUser } = useAuth();
  const [name, setHọ và tên] = useState(user?.name ?? '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  return (
    <form
      classHọ và tên="mx-auto grid max-w-xl gap-3 rounded-3xl bg-white p-5 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        api<{ user: User }>('/api/me', { method: 'PATCH', body: JSON.stringify({ name }) })
          .then((result) => {
            setUser(result.user);
            setMessage('Hồ sơ saved.');
          })
          .catch((err: Error) => setError(err.message));
      }}
    >
      <h1 classHọ và tên="text-2xl font-extrabold">Hồ sơ</h1>
      {message ? <Banner tone="ok">{message}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Field label="Họ và tên"><input classHọ và tên={controlClass} value={name} onChange={(event) => setHọ và tên(event.target.value)} /></Field>
      <p classHọ và tên="font-bold text-slate-500">{user?.email}</p>
      <Button type="submit">Lưu</Button>
    </form>
  );
}
