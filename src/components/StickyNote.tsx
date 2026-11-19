import { Link } from 'react-router-dom';
import type { NoteColor, Mức độ ưu tiên } from '../types';
import type { CompletionTrạng thái } from '../types';
import { Countdown, Trạng tháiPill } from './ui';
import { formatLongDate, formatTime, priorityLabel } from '../lib/format';

const noteColors: Record<NoteColor, string> = {
  yellow: 'bg-[#FFF3B0]',
  pink: 'bg-[#FFD6E0]',
  blue: 'bg-[#D6E6FF]',
  green: 'bg-[#D8F6E4]',
  orange: 'bg-[#FFE0C2]',
  purple: 'bg-[#E6D9FF]',
};

function tilt(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash + char.charCodeAt(0)) % 5;
  return hash - 2;
}

export function StickyNote({
  id,
  href,
  title,
  description,
  classHọ và tên,
  studentHọ và tên,
  wholeLớp,
  assignmentDate,
  deadlineDate,
  deadlineTime,
  deadlineAt,
  priority,
  penalty,
  color,
  status,
  submissionĐang chờ = false,
  footer,
}: {
  id: string;
  href?: string;
  title: string;
  description: string;
  classHọ và tên: string;
  studentHọ và tên?: string;
  wholeLớp?: boolean;
  assignmentDate: string;
  deadlineDate: string;
  deadlineTime: string;
  deadlineAt?: string;
  priority: Mức độ ưu tiên;
  penalty: string;
  color: NoteColor;
  status?: CompletionTrạng thái;
  submissionĐang chờ?: boolean;
  footer?: string;
}) {
  const body = (
    <>
      <span classHọ và tên="note-pin" />
      <span classHọ và tên="note-clip" />
      <div classHọ và tên="flex items-start justify-between gap-3">
        <h3 classHọ và tên="text-lg font-extrabold leading-tight">{title}</h3>
        <span classHọ và tên="shrink-0 rounded-full bg-white/70 px-2 py-1 text-[11px] font-extrabold">{priorityLabel(priority)}</span>
      </div>
      {description ? <p classHọ và tên="mt-1 line-clamp-3 text-sm font-semibold text-[#24324a]/80">{description}</p> : null}
      <div classHọ và tên="mt-3 flex flex-wrap gap-1.5 text-xs font-extrabold">
        <span classHọ và tên="rounded-full bg-white/70 px-2 py-1">{classHọ và tên}</span>
        {studentHọ và tên ? <span classHọ và tên="rounded-full bg-white/70 px-2 py-1">{studentHọ và tên}</span> : null}
        {wholeLớp ? <span classHọ và tên="rounded-full bg-white/70 px-2 py-1">Cả lớp</span> : null}
      </div>
      <dl classHọ và tên="mt-3 space-y-1 text-sm font-bold">
        <div>Được giao {formatLongDate(assignmentDate)}</div>
        <div>
          Hạn nộp {formatLongDate(deadlineDate)} · {formatTime(deadlineTime)}
        </div>
        {deadlineAt && status ? (
          <div>
            <Countdown deadlineAt={deadlineAt} status={status} paused={submissionĐang chờ} />
          </div>
        ) : null}
      </dl>
      <p classHọ và tên="mt-2 text-xs font-bold">
        <span classHọ và tên="font-extrabold">Hình phạt: </span>
        {penalty || 'Không có'}
      </p>
      {submissionĐang chờ ? <p classHọ và tên="mt-2 text-xs font-extrabold text-[#315fc4]">Đã nộp · đang chờ giáo viên xem bài</p> : null}
      <div classHọ và tên="mt-3 flex items-center justify-between gap-2">
        {status ? <Trạng tháiPill status={status} /> : <span />}
        {footer ? <span classHọ và tên="text-xs font-extrabold">{footer}</span> : null}
      </div>
    </>
  );
  const classHọ và têns = `relative block w-full rounded-3xl p-4 pt-6 text-left shadow-[0_12px_24px_rgba(36,50,74,0.08)] transition hover:-translate-y-1 ${noteColors[color]}`;
  const style = { transform: `rotate(${tilt(id)}deg)` };
  if (href) {
    return (
      <Link to={href} classHọ và tên={classHọ và têns} style={style}>
        {body}
      </Link>
    );
  }
  return (
    <article classHọ và tên={classHọ và têns} style={style}>
      {body}
    </article>
  );
}
