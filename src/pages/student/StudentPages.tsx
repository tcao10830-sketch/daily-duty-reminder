import { useCallback, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LịchBoard } from '../../components/LịchBoard';
import { Mascot } from '../../components/Mascot';
import { SubmissionCelebration } from '../../components/SubmissionCelebration';
import { StickyNote } from '../../components/StickyNote';
import { Banner, Button, Empty, Field, Loading, Modal, Ring, StatCard, Trạng tháiPill, WeekBars, controlLớp } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { fileUploadPayload } from '../../lib/fileUpload';
import { playSubmissionCelebration } from '../../lib/sounds';
import { formatLongDate, formatStamp, formatTime } from '../../lib/format';
import { useQuery } from '../../lib/query';
import type { AssignmentCard, NotificationItem, User, WeekPoint } from '../../types';
import { STATUS_LABEL } from '../../types';

type Overview = {
  stats: { assigned: number; hoàn thànhd: number; pending: number; quá hạn: number; completionTỷ lệ: number };
  today: AssignmentCard[];
  upcoming: AssignmentCard[];
  hoàn thànhd: AssignmentCard[];
  quá hạn: AssignmentCard[];
  weekly: WeekPoint[];
};

export function Học sinhTrang chủPage() {
  const { user } = useAuth();
  const { data, error, loading } = useQuery<Overview>('/api/student/overview');
  const rewards = useQuery<{ totalBút chì: number; currentStreak: number; streakTrạng thái: string; graceDeadlineAt: string | null; threatenedNhiệm vụTitle: string | null }>('/api/student/rewards');
  if (loading && !data) return <Loading />;
  if (!data) return <Banner tone="error">{error}</Banner>;
  return (
    <div classHọ và tên="grid gap-4">
      <section classHọ và tên="dashboard-hero flex items-center justify-between gap-3 px-5 py-5 sm:px-7 sm:py-6">
        <div classHọ và tên="relative z-10 max-w-xl">
          <span classHọ và tên="inline-flex rounded-full bg-white/75 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[#a66b22]">Góc học tập của bạn</span>
          <h1 classHọ và tên="mt-3 font-display text-3xl leading-tight text-[#34445e] sm:text-4xl">Xin chào, {user?.name}!</h1>
          <p classHọ và tên="mt-2 max-w-lg text-sm font-bold leading-relaxed text-[#5f6d7f] sm:text-base">Các nhiệm vụ hôm nay của bạn nằm bên dưới. Cứ hoàn thành từng bước một nhé, bạn làm được mà!</p>
          <div classHọ và tên="mt-3 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-extrabold text-[#4d8c6d]">
            <span classHọ và tên="text-[#FF914D]">✦</span> Không ngừng tiến bộ mỗi ngày
          </div>
        </div>
        <div classHọ và tên="relative z-10 shrink-0">
          <Mascot size={132} />
        </div>
      </section>
      {rewards.data?.streakTrạng thái === 'threatened' ? (
        <section classHọ và tên="rounded-3xl border-2 border-red-300 bg-red-50 p-4 text-red-800 shadow-sm">
          <p classHọ và tên="font-extrabold">⚠ Chuỗi hoàn thành của bạn đang có nguy cơ bị gián đoạn!</p>
          <p classHọ và tên="mt-1 text-sm font-bold">Hãy hoàn thành “{rewards.data.threatenedNhiệm vụTitle || 'your quá hạn task'}” trong vòng 24 giờ để duy trì chuỗi nhé.</p>
          {rewards.data.graceDeadlineAt ? <p classHọ và tên="mt-1 text-xs font-extrabold">Hạn cuối để duy trì chuỗi: {formatStamp(rewards.data.graceDeadlineAt)}</p> : null}
        </section>
      ) : null}
      <Link to="/student/achievements" classHọ và tên="flex flex-wrap items-center justify-between gap-2 rounded-3xl bg-[#FFF3B0] p-4 shadow-sm">
        <div><p classHọ và tên="font-extrabold text-[#805b19]">Thành tích của bạn</p><p classHọ và tên="text-sm font-bold text-[#805b19]">{rewards.data?.currentStreak ?? 0} nhiệm vụ liên tiếp</p></div>
        <strong classHọ và tên="text-2xl text-[#34445e]">{rewards.data?.totalBút chì ?? 0} ✏️</strong>
      </Link>
      <section classHọ và tên="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Được giao" value={data.stats.assigned} tint="#FFF3B0" />
        <StatCard label="Đã hoàn thành" value={data.stats.hoàn thànhd} tint="#D8F6E4" />
        <StatCard label="Đang chờ" value={data.stats.pending} tint="#D6E6FF" />
        <StatCard label="Quá hạn" value={data.stats.quá hạn} tint="#FFD6E0" />
      </section>
      <NoteGrid title="Hôm nay" notes={data.today} empty="Hôm nay không có nhiệm vụ đến hạn." />
      <NoteGrid title="Sắp đến hạn" notes={data.upcoming} empty="Không có hạn nộp sắp tới." />
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
              submissionĐang chờ={note.submissionĐang chờ}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function MyNhiệm vụPage() {
  const { data, error, loading } = useQuery<{ assignments: AssignmentCard[] }>('/api/student/tasks');
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setTrạng tháiFilter] = useState('all');
  const [priorityFilter, setMức độ ưu tiênFilter] = useState('all');
  if (loading && !data) return <Loading />;
  if (error) return <Banner tone="error">{error}</Banner>;
  const now = Date.now();
  const today = new Date();
  const startOfHôm nay = new Date(today.getFullYear(), today.getT2th(), today.getDate()).getTime();
  const endOfHôm nay = startOfHôm nay + 24 * 60 * 60 * 1000;
  const endOfWeek = endOfHôm nay + 7 * 24 * 60 * 60 * 1000;
  const notes = (data?.assignments ?? [])
    .filter((note) => {
      const deadline = new Date(note.deadlineAt).getTime();
      if (dateFilter === 'today') return deadline >= startOfHôm nay && deadline < endOfHôm nay;
      if (dateFilter === 'week') return deadline >= startOfHôm nay && deadline < endOfWeek;
      if (dateFilter === 'later') return deadline >= endOfWeek;
      return true;
    })
    .filter((note) => {
      if (statusFilter === 'pending') return note.status === 'pending';
      if (statusFilter === 'upcoming') return note.status === 'pending' && new Date(note.deadlineAt).getTime() - now > 48 * 60 * 60 * 1000;
      if (statusFilter === 'quá hạn') return note.status === 'quá hạn';
      return true;
    })
    .filter((note) => priorityFilter === 'all' || note.priority === priorityFilter)
    .sort((a, b) => {
      const rank = (note: AssignmentCard) => note.status === 'quá hạn' ? 0 : note.status === 'pending' && new Date(note.deadlineAt).getTime() - now <= 48 * 60 * 60 * 1000 ? 1 : note.status === 'pending' ? 2 : 3;
      return rank(a) - rank(b) || new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime();
    });
  return (
    <div classHọ và tên="grid gap-4">
      <section classHọ và tên="grid gap-3 rounded-3xl bg-white p-4 shadow-sm sm:grid-cols-3">
        <label classHọ và tên="grid gap-1 text-sm font-extrabold text-[#34445e]">Ngày đến hạn
          <select classHọ và tên={controlLớp} value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>
            <option value="all">Tất cả ngày</option>
            <option value="today">Đến hạn hôm nay</option>
            <option value="week">7 ngày tới</option>
            <option value="later">Sau 7 ngày</option>
          </select>
        </label>
        <label classHọ và tên="grid gap-1 text-sm font-extrabold text-[#34445e]">Trạng thái
          <select classHọ và tên={controlLớp} value={statusFilter} onChange={(event) => setTrạng tháiFilter(event.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">Đang chờ</option>
            <option value="upcoming">Sắp đến hạn (còn hơn 48 giờ)</option>
            <option value="quá hạn">Quá hạn</option>
          </select>
        </label>
        <label classHọ và tên="grid gap-1 text-sm font-extrabold text-[#34445e]">Mức độ ưu tiên
          <select classHọ và tên={controlLớp} value={priorityFilter} onChange={(event) => setMức độ ưu tiênFilter(event.target.value)}>
            <option value="all">Tất cả mức độ</option>
            <option value="high">Cao</option>
            <option value="medium">Trung bình</option>
            <option value="low">Thấp</option>
          </select>
        </label>
      </section>
      {notes.length === 0 ? <Empty>Không có nhiệm vụ phù hợp với bộ lọc.</Empty> : (
        <div classHọ và tên="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <div key={note.assignmentId} classHọ và tên="relative">
              {note.status === 'quá hạn' ? <span classHọ và tên="absolute -top-2 -right-2 z-10 rounded-full bg-red-600 px-3 py-1 text-sm font-black text-white shadow-md" aria-label="Quá hạn warning">⚠ QUÁ HẠN</span> : null}
              {note.status === 'pending' && new Date(note.deadlineAt).getTime() - now <= 48 * 60 * 60 * 1000 ? <span classHọ và tên="absolute -top-2 -right-2 z-10 rounded-full bg-amber-400 px-3 py-1 text-sm font-black text-[#513b12] shadow-md">⏰ SẮP ĐẾN HẠN</span> : null}
              <StickyNote
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
              submissionĐang chờ={note.submissionĐang chờ}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Học sinhNhiệm vụPage() {
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
  if (!data) return <Banner tone="error">{error || 'Không tìm thấy nhiệm vụ.'}</Banner>;
  const task = data.assignment;
  const đã xong = task.status === 'on_time' || task.status === 'late';
  const latest = submissions.data?.submissions?.[0];

  async function submitWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    setMessage('');
    try {
      const totalBytes = files.reduce((sum, item) => sum + item.size, 0);
      if (totalBytes > 10 * 1024 * 1024) throw new Error('Tổng dung lượng các tệp không được vượt quá 10 MB.');
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
      setMessage('Bạn đã nộp bài thành công. Đồng hồ đếm ngược sẽ tạm dừng trong khi giáo viên xem bài.');
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
        submissionĐang chờ={task.submissionĐang chờ}
      />
      <section classHọ và tên="rounded-3xl bg-white p-5 shadow-sm">
        <p classHọ và tên="font-bold">Hạn nộp {formatLongDate(task.deadlineDate)} lúc {formatTime(task.deadlineTime)}</p>
        <div classHọ và tên="mt-3 rounded-2xl bg-[#FFF3B0] p-3 font-extrabold">Hình phạt nếu nộp muộn: {task.penalty || 'Không có'}</div>
        {task.instructions ? <p classHọ và tên="mt-3 font-bold">Hướng dẫn: {task.instructions}</p> : null}
        <div classHọ và tên="mt-4"><Trạng tháiPill status={task.status} /></div>
        {task.submissionĐang chờ ? <p classHọ và tên="mt-3 rounded-xl bg-[#D6E6FF] p-3 font-extrabold text-[#315fc4]">Đã nộp bài thành công. Thời gian được tạm dừng trong khi chờ giáo viên xem bài.</p> : null}
        {task.revisionDeadlineAt && !task.submissionĐang chờ && !đã xong ? <p classHọ và tên="mt-3 rounded-xl bg-[#FFE0C2] p-3 font-extrabold text-orange-900">Cần chỉnh sửa · Hạn nộp mới: {formatStamp(task.revisionDeadlineAt)}</p> : null}
        {đã xong && task.hoàn thànhdAt ? (
          <p classHọ và tên="mt-4 font-extrabold text-[#067a4b]" data-testid="hoàn thànhd-stamp">
            Được giáo viên duyệt · {formatStamp(task.hoàn thànhdAt)}
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
                {latest.review.status === 'approved' ? 'Đã duyệt' : 'Please revise and submit again'}
                {latest.review.feedback ? <p classHọ và tên="mt-1 font-semibold">Nhận xét của giáo viên: {latest.review.feedback}</p> : null}
              </div>
            ) : <p classHọ và tên="mt-2 text-sm font-bold text-[#315fc4]">Đang chờ giáo viên xem bài.</p>}
          </div>
        ) : <p classHọ và tên="mb-3 text-sm font-semibold text-slate-500">You need to submit a file or a link before this task can be hoàn thànhd.</p>}

        {!đã xong && !task.submissionĐang chờ ? (
          <form classHọ và tên="grid gap-3" onSubmit={(event) => void submitWork(event)}>
            <Field label="Tải tệp hoặc ảnh lên (PDF, Word hoặc hình ảnh — tổng tối đa 10 MB)">
              <input classHọ và tên={controlLớp} type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
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
              <input classHọ và tên={controlLớp} type="url" value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://..." />
            </Field>
            <Field label="Lời nhắn cho giáo viên (không bắt buộc)">
              <textarea classHọ và tên={controlLớp} rows={2} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Viết lời nhắn ngắn..." />
            </Field>
            {formError ? <Banner tone="error">{formError}</Banner> : null}
            {message ? <Banner tone="ok">{message}</Banner> : null}
            <Button type="submit" tone="green" disabled={busy}>{busy ? 'Đang nộp…' : latest?.review?.status === 'revision_requested' ? 'Nộp lại bài đã chỉnh sửa' : 'Nộp bài để giáo viên chấm'}</Button>
          </form>
        ) : null}
      </section>
    </div>
  );
}

export function Học sinhLịchPage() {
  const { data, loading, error } = useQuery<{ assignments: AssignmentCard[] }>('/api/student/tasks');
  if (loading && !data) return <Loading />;
  if (error) return <Banner tone="error">{error}</Banner>;
  const items = (data?.assignments ?? []).map((task) => ({
    date: task.deadlineDate,
    title: task.title,
    href: `/student/tasks/${task.assignmentId}`,
    meta: STATUS_LABEL[task.status],
  }));
  return <LịchBoard items={items} />;
}

export function Học sinhProgressPage() {
  const { data, error, loading } = useQuery<Overview>('/api/student/overview');
  if (loading && !data) return <Loading />;
  if (!data) return <Banner tone="error">{error}</Banner>;
  return (
    <div classHọ và tên="grid gap-4">
      <section classHọ và tên="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-4 shadow-sm">
        <div>
          <h1 classHọ và tên="text-2xl font-extrabold">Tiến độ của tôi</h1>
          <p classHọ và tên="font-bold">{data.stats.assigned} được giao · {data.stats.hoàn thànhd} hoàn thànhd · {data.stats.pending} đang chờ · {data.stats.quá hạn} quá hạn</p>
        </div>
        <Ring value={data.stats.completionTỷ lệ} />
      </section>
      <section classHọ và tên="rounded-3xl bg-white p-4 shadow-sm">
        <h2 classHọ và tên="mb-2 font-extrabold">Hoạt động trong tuần</h2>
        <WeekBars days={data.weekly} />
      </section>
      <section classHọ và tên="grid gap-2">
        {data.hoàn thànhd.map((task) => (
          <Link key={task.assignmentId} to={`/student/tasks/${task.assignmentId}`} classHọ và tên="rounded-2xl bg-white px-4 py-3 font-extrabold shadow-sm">
            {task.title} · {STATUS_LABEL[task.status]} {task.hoàn thànhdAt ? `· ${formatStamp(task.hoàn thànhdAt)}` : ''}
          </Link>
        ))}
        {data.hoàn thànhd.length === 0 ? <Empty>Đã hoàn thành tasks will show up here.</Empty> : null}
      </section>
    </div>
  );
}

export function Học sinhThông báoPage() {
  const { data, error, loading } = useQuery<{ notifications: NotificationItem[] }>('/api/notifications');
  const { bump } = useAuth();
  if (loading && !data) return <Loading />;
  if (error) return <Banner tone="error">{error}</Banner>;
  const removeOne = async (id: string) => {
    if (!window.confirm('Xóa this notification không?)) return;
    await api(`/api/notifications/${id}`, { method: 'DELETE' });
    bump();
  };
  const removeTất cả = async () => {
    if (!window.confirm('Xóa tất cả notifications? This cannot be unđã xong.')) return;
    await api('/api/notifications', { method: 'DELETE' });
    bump();
  };
  return (
    <div classHọ và tên="grid gap-3">
      <div classHọ và tên="flex flex-wrap items-center justify-between gap-2">
        <h1 classHọ và tên="text-2xl font-extrabold">Thông báo</h1>
        <div classHọ và tên="flex gap-2">
          <Button tone="ghost" onClick={() => void api('/api/notifications/read-all', { method: 'POST' }).then(() => bump())}>Đánh dấu đã đọc tất cả</Button>
          <Button tone="red" onClick={() => void removeTất cả()}>Xóa tất cả</Button>
        </div>
      </div>
      {data?.notifications.length === 0 ? <Empty>Chưa có thông báo nào.</Empty> : null}
      {data?.notifications.map((item) => (
        <div key={item.id} classHọ và tên={`flex items-start gap-3 rounded-3xl p-4 shadow-sm ${item.read ? 'bg-white' : 'bg-[#D6E6FF]'}`}>
          <button type="button" onClick={() => void api(`/api/notifications/${item.id}/read`, { method: 'POST' }).then(() => bump())} classHọ và tên="min-w-0 flex-1 text-left">
            <p classHọ và tên="font-extrabold">{item.title}</p>
            <p classHọ và tên="font-semibold">{item.body}</p>
            <p classHọ và tên="text-xs font-bold text-slate-500">{formatStamp(item.createdAt)}</p>
          </button>
          <button type="button" aria-label="Xóa thông báo" onClick={() => void removeOne(item.id)} classHọ và tên="rounded-xl bg-white/80 px-3 py-2 text-sm font-extrabold text-red-600 shadow-sm">Xóa</button>
        </div>
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
      <Field label="Họ và tên"><input classHọ và tên={controlLớp} value={name} onChange={(event) => setHọ và tên(event.target.value)} /></Field>
      <p classHọ và tên="font-bold text-slate-500">{user?.email}</p>
      <Button type="submit">Lưu</Button>
    </form>
  );
}
