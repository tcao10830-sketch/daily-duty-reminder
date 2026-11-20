import { useMemo, useState, type CSSProperties } from 'react';
import { Mascot } from '../../components/Mascot';
import { Banner, Button, Empty, Field, Loading, controlClass } from '../../components/ui';
import { api } from '../../lib/api';
import { useQuery } from '../../lib/query';
import type { ClassSummary } from '../../types';

type ReportData = {
  student: { id: string; name: string; email: string };
  className: string;
  teacherName: string;
  period: { from: string; to: string };
  stats: {
    assigned: number; completed: number; completionRate: number; onTime: number;
    late: number; overdue: number; submittedWaiting: number; pending: number;
    pencils: number; pencilsEarned: number;
  };
  assignments: { title: string; assignmentDate: string; deadlineDate: string; status: string }[];
};
type Notes = { strengths: string; improve: string; comment: string; next: string };
const emptyNotes: Notes = { strengths: '', improve: '', comment: '', next: '' };
const today = new Date();
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
const toDateInput = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const prettyDate = (value: string) => {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};
const periodLabel = (from: string, to: string) => `${prettyDate(from)} – ${prettyDate(to)}`;

export function ReportsPage() {
  const { data, loading, error } = useQuery<{ classes: ClassSummary[] }>('/api/teacher/classes');
  const [classId, setClassId] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [from, setFrom] = useState(toDateInput(monthStart));
  const [to, setTo] = useState(toDateInput(today));
  const [reports, setReports] = useState<ReportData[]>([]);
  const [notes, setNotes] = useState<Record<string, Notes>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const classes = data?.classes ?? [];
  const selectedClass = classes.find((item) => item.id === classId);
  const students = selectedClass?.students ?? [];
  const allSelected = students.length > 0 && students.every((student) => selectedIds.includes(student.id));

  const selectedCount = useMemo(() => selectedIds.length, [selectedIds]);

  function toggleStudent(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function createReports() {
    setBusy(true);
    setFormError('');
    setMessage('');
    try {
      const result = await api<{ reports: ReportData[] }>('/api/teacher/reports/preview', {
        method: 'POST',
        body: JSON.stringify({ classId, studentIds: selectedIds, from, to }),
      });
      setReports(result.reports);
      setNotes(Object.fromEntries(result.reports.map((report) => [report.student.id, { ...emptyNotes }])));
      setMessage(`Đã tạo ${result.reports.length} báo cáo. Hãy kiểm tra và bổ sung nhận xét trước khi in.`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không thể tạo báo cáo.');
    } finally {
      setBusy(false);
    }
  }

  function updateNote(studentId: string, key: keyof Notes, value: string) {
    setNotes((current) => ({
      ...current,
      [studentId]: { ...emptyNotes, ...current[studentId], [key]: value },
    }));
  }

  if (loading && !data) return <Loading />;

  return (
    <div className="grid gap-4">
      <style>{`
        .report-preview { color: #263b60; font-family: "Be Vietnam Pro", "Segoe UI", sans-serif; }
        .report-sheet { box-sizing: border-box; width: 100%; max-width: 820px; min-height: 1060px; margin: 0 auto 22px; padding: 34px; overflow: hidden; position: relative; border: 1px solid #e4ecfa; border-radius: 28px; background: radial-gradient(circle at 95% 5%, #e5efff 0, transparent 22%), linear-gradient(155deg,#fff 0%,#fffdf7 100%); box-shadow: 0 8px 28px rgba(50,80,130,.08); }
        .report-chip { display:inline-flex; align-items:center; gap:8px; border-radius:999px; padding:9px 16px; background:#fff0c4; color:#344b70; font-weight:800; }
        .report-stat { border-radius:20px; padding:16px 10px; text-align:center; background:#fff; border:1px solid #e7edfa; }
        .report-stat strong { display:block; font-size:30px; line-height:1.15; color:#263b60; }
        .report-stat span { display:block; margin-top:5px; font-size:12px; font-weight:700; color:#64748b; }
        .report-note { min-height:80px; white-space:pre-wrap; overflow-wrap:anywhere; border-radius:16px; background:#f6f9ff; padding:14px; color:#34445e; font-size:13px; line-height:1.6; }
        .report-section { border:1px solid #e2eaf8; border-radius:22px; padding:17px; background:rgba(255,255,255,.88); }
        .report-section h3 { margin:0 0 11px; color:#263b60; font-size:17px; font-weight:900; }
        .report-table { width:100%; border-collapse:collapse; font-size:11px; }
        .report-table th { background:#eaf1ff; text-align:left; color:#34445e; padding:9px 8px; }
        .report-table td { border-bottom:1px solid #e8edf5; padding:8px; vertical-align:top; }
        .report-footer { position:absolute; bottom:25px; left:34px; right:34px; border-radius:20px; background:#edf4ff; padding:14px 18px; display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .report-donut { width:118px; height:118px; border-radius:50%; display:grid; place-items:center; background:conic-gradient(#4f87ff var(--rate), #ffb65e 0); position:relative; flex:none; }
        .report-donut:before { content:""; position:absolute; inset:13px; border-radius:50%; background:white; }
        .report-donut strong { position:relative; font-size:23px; }
        .report-edit { display:grid; gap:9px; border-radius:22px; background:#fff; padding:16px; box-shadow:0 2px 12px rgba(50,80,130,.06); }
        .report-edit label { display:grid; gap:5px; font-size:13px; font-weight:800; color:#34445e; }
        .report-edit textarea { width:100%; min-height:72px; resize:vertical; border:1px solid #d7e4f5; border-radius:13px; padding:10px; font:inherit; font-size:13px; outline-color:#4f87ff; }
        @page { size: A4; margin: 9mm; }
        @media print {
          body { background:#fff !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
          body * { visibility:hidden !important; }
          .report-print-area, .report-print-area * { visibility:visible !important; }
          .report-tools, .report-edit, .report-screen-only { display:none !important; }
          .report-print-area { position:absolute; left:0; top:0; width:100%; }
          .report-sheet { width:100%; max-width:none; min-height:277mm; height:277mm; margin:0; padding:8mm; border:0; border-radius:0; box-shadow:none; break-after:page; page-break-after:always; }
          .report-sheet:last-child { break-after:auto; page-break-after:auto; }
          .report-footer { left:8mm; right:8mm; bottom:7mm; }
        }
      `}</style>

      <section className="report-tools rounded-3xl bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <img src="/icon.svg" alt="Daily Duty Reminder" className="h-14 w-14 rounded-2xl" />
          <div>
            <h1 className="text-2xl font-extrabold text-[#34445e]">Báo cáo phụ huynh</h1>
            <p className="text-sm font-semibold text-slate-500">Tạo báo cáo tiến độ học tập theo từng học sinh.</p>
          </div>
        </div>
        {error ? <Banner tone="error">{error}</Banner> : null}
        {formError ? <div className="mb-3"><Banner tone="error">{formError}</Banner></div> : null}
        {message ? <div className="mb-3"><Banner tone="ok">{message}</Banner></div> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Lớp">
            <select className={controlClass} value={classId} onChange={(event) => { setClassId(event.target.value); setSelectedIds([]); setReports([]); }}>
              <option value="">Chọn lớp</option>
              {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Từ ngày"><input className={controlClass} type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></Field>
            <Field label="Đến ngày"><input className={controlClass} type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></Field>
          </div>
        </div>
        {selectedClass ? (
          <div className="mt-4 rounded-2xl bg-[#f7faff] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-extrabold">Chọn học sinh · {selectedCount}/{students.length}</h2>
              <button type="button" className="text-sm font-extrabold text-[#315fbf]" onClick={() => setSelectedIds(allSelected ? [] : students.map((student) => student.id))}>
                {allSelected ? 'Bỏ chọn tất cả' : 'Chọn cả lớp'}
              </button>
            </div>
            {students.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {students.map((student) => (
                <label key={student.id} className="flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold">
                  <input type="checkbox" checked={selectedIds.includes(student.id)} onChange={() => toggleStudent(student.id)} />
                  {student.name}
                </label>
              ))}
            </div> : <Empty>Lớp này chưa có học sinh.</Empty>}
          </div>
        ) : <p className="mt-3 text-sm font-semibold text-slate-500">Chọn lớp để xem danh sách học sinh.</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={busy || !classId || !selectedIds.length || !from || !to || from > to} onClick={() => void createReports()}>
            {busy ? 'Đang tổng hợp…' : selectedIds.length > 1 ? `Tạo ${selectedIds.length} báo cáo` : 'Tạo báo cáo'}
          </Button>
          {reports.length ? <Button tone="ghost" onClick={() => window.print()}>In / Lưu PDF</Button> : null}
        </div>
        <p className="mt-2 text-xs font-semibold text-slate-400">Chọn một học sinh để tạo riêng hoặc chọn nhiều em để in hàng loạt. Báo cáo chỉ lấy nhiệm vụ được giao trong khoảng thời gian đã chọn.</p>
      </section>

      {reports.length ? (
        <div className="report-preview report-print-area grid gap-5">
          {reports.map((report) => {
            const note = notes[report.student.id] ?? emptyNotes;
            const stats = report.stats;
            const ratio = stats.completionRate;
            return (
              <div key={report.student.id} className="grid gap-3">
                <section className="report-edit report-tools">
                  <h2 className="font-extrabold">Nhận xét · {report.student.name}</h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label>Điểm mạnh<textarea value={note.strengths} onChange={(event) => updateNote(report.student.id, 'strengths', event.target.value)} placeholder="Ghi nhận điểm tích cực…" /></label>
                    <label>Cần cải thiện<textarea value={note.improve} onChange={(event) => updateNote(report.student.id, 'improve', event.target.value)} placeholder="Nội dung cần cải thiện…" /></label>
                    <label className="sm:col-span-2">Nhận xét của giáo viên<textarea value={note.comment} onChange={(event) => updateNote(report.student.id, 'comment', event.target.value)} placeholder="Nhận xét dành cho phụ huynh…" /></label>
                    <label className="sm:col-span-2">Định hướng tiếp theo<textarea value={note.next} onChange={(event) => updateNote(report.student.id, 'next', event.target.value)} placeholder="Mục tiêu trong giai đoạn tiếp theo…" /></label>
                  </div>
                </section>

                <article className="report-sheet">
                  <header className="mb-5 flex items-center justify-between gap-3 border-b border-[#e5edf9] pb-4">
                    <div className="flex items-center gap-3">
                      <img src="/icon.svg" alt="" className="h-12 w-12 rounded-xl" />
                      <div><p className="text-sm font-extrabold text-[#315fbf]">Daily Duty Reminder</p><p className="text-xs font-bold tracking-wide text-slate-400">BÁO CÁO TIẾN ĐỘ HỌC TẬP</p></div>
                    </div>
                    <span className="rounded-full bg-[#fff0c4] px-3 py-1.5 text-xs font-extrabold">01 / 02</span>
                  </header>
                  <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                    <div>
                      <h2 className="font-display text-3xl font-black leading-tight text-[#263b60]">Báo cáo<br/>tiến độ học tập</h2>
                      <p className="mt-2 inline-flex rounded-full bg-[#fff0c4] px-4 py-2 text-sm font-extrabold"> {periodLabel(report.period.from, report.period.to)} </p>
                    </div>
                    <Mascot size={116} />
                  </div>
                  <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dce7fb] bg-[#f7faff] p-4">
                    <div><p className="text-lg font-black">{report.student.name}</p><p className="text-sm font-semibold text-slate-500">Lớp {report.className}</p></div>
                    <div className="text-sm"><p><b>Giáo viên:</b> {report.teacherName || '—'}</p><p className="text-slate-500">{report.student.email}</p></div>
                  </section>
                  <section className="mt-4 rounded-3xl border border-[#ffe3a0] bg-[#fff8e5] p-4">
                    <h3 className="mb-3 font-extrabold">Tổng quan trong kỳ</h3>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="report-stat"><strong>{stats.completed}/{stats.assigned}</strong><span>Hoàn thành</span></div>
                      <div className="report-stat"><strong>{stats.completionRate}%</strong><span>Tỷ lệ hoàn thành</span></div>
                      <div className="report-stat"><strong>{stats.onTime}</strong><span>Đúng hạn</span></div>
                    </div>
                  </section>
                  <section className="mt-4 rounded-3xl border border-[#dce7fb] bg-[#f7faff] p-4">
                    <h3 className="mb-3 font-extrabold">Kết quả theo trạng thái</h3>
                    <div className="flex flex-wrap items-center gap-5">
                      <div className="report-donut" style={{ '--rate': `${ratio * 3.6}deg` } as CSSProperties}><strong>{ratio}%</strong></div>
                      <div className="grid flex-1 gap-2 text-sm font-bold">
                        <p><span className="mr-2 inline-block h-3 w-3 rounded-full bg-[#4f87ff]"/>Đúng hạn <b className="float-right">{stats.onTime}</b></p>
                        <p><span className="mr-2 inline-block h-3 w-3 rounded-full bg-[#ffad4d]"/>Hoàn thành muộn <b className="float-right">{stats.late}</b></p>
                        <p><span className="mr-2 inline-block h-3 w-3 rounded-full bg-[#cbd5e1]"/>Quá hạn <b className="float-right">{stats.overdue}</b></p>
                        <p><span className="mr-2 inline-block h-3 w-3 rounded-full bg-[#38c98b]"/>Đã nộp, chờ duyệt <b className="float-right">{stats.submittedWaiting}</b></p>
                        <p className="text-slate-500">Chưa hoàn thành: <b className="float-right">{stats.pending}</b></p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs font-semibold text-slate-500">Bút chì nhận được trong kỳ: {stats.pencils > 0 ? '+' : ''}{stats.pencils} · Tổng thưởng được cộng: {stats.pencilsEarned}</p>
                  </section>
                  <div className="report-footer"><div><p className="font-display text-sm font-extrabold">Daily Duty Reminder</p><p className="text-xs font-semibold text-slate-500">Báo cáo cá nhân · Trang 1</p></div><Mascot size={48}/></div>
                </article>

                <article className="report-sheet">
                  <header className="mb-5 flex items-center justify-between border-b border-[#e5edf9] pb-4">
                    <div className="flex items-center gap-3"><img src="/icon.svg" alt="" className="h-10 w-10 rounded-xl"/><div><p className="text-sm font-extrabold text-[#315fbf]">Daily Duty Reminder</p><p className="text-xs font-bold text-slate-400">{report.student.name} · {report.className}</p></div></div>
                    <span className="rounded-full bg-[#fff0c4] px-3 py-1.5 text-xs font-extrabold">02 / 02</span>
                  </header>
                  <div className="grid gap-3">
                    <section className="report-section">
                      <h3>Điểm mạnh</h3>
                      <div className="report-note">{note.strengths || '—'}</div>
                    </section>
                    <section className="report-section">
                      <h3>Cần cải thiện</h3>
                      <div className="report-note">{note.improve || '—'}</div>
                    </section>
                    <section className="report-section">
                      <h3>Nhận xét của giáo viên</h3>
                      <div className="report-note">{note.comment || '—'}</div>
                    </section>
                    <section className="report-section">
                      <h3>Định hướng tiếp theo</h3>
                      <div className="report-note">{note.next || '—'}</div>
                    </section>
                    <section className="report-section">
                      <h3>Nhiệm vụ trong kỳ</h3>
                      {report.assignments.length ? <table className="report-table"><thead><tr><th>Nhiệm vụ</th><th>Ngày giao</th><th>Hạn nộp</th><th>Trạng thái</th></tr></thead><tbody>
                        {report.assignments.slice(0, 12).map((item, index) => <tr key={index}><td>{item.title}</td><td>{prettyDate(item.assignmentDate)}</td><td>{prettyDate(item.deadlineDate)}</td><td>{item.status}</td></tr>)}
                      </tbody></table> : <p className="text-sm font-semibold text-slate-500">Không có nhiệm vụ được giao trong khoảng thời gian này.</p>}
                      {report.assignments.length > 12 ? <p className="mt-2 text-xs font-semibold text-slate-500">Còn {report.assignments.length - 12} nhiệm vụ khác không hiển thị trong bảng này.</p> : null}
                    </section>
                  </div>
                  <div className="report-footer"><div><p className="font-display text-sm font-extrabold">Cùng nhau đồng hành</p><p className="text-xs font-semibold text-slate-500">Vì một hành trình học tập tốt hơn!</p></div><Mascot size={48}/></div>
                </article>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
