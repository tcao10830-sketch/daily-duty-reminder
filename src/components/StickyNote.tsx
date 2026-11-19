import { Link } from 'react-router-dom';
import type { NoteColor, Priority } from '../types';
import type { CompletionStatus } from '../types';
import { Countdown, StatusPill } from './ui';
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
  className,
  studentName,
  wholeClass,
  assignmentDate,
  deadlineDate,
  deadlineTime,
  deadlineAt,
  priority,
  penalty,
  color,
  status,
  submissionPending = false,
  footer,
}: {
  id: string;
  href?: string;
  title: string;
  description: string;
  className: string;
  studentName?: string;
  wholeClass?: boolean;
  assignmentDate: string;
  deadlineDate: string;
  deadlineTime: string;
  deadlineAt?: string;
  priority: Priority;
  penalty: string;
  color: NoteColor;
  status?: CompletionStatus;
  submissionPending?: boolean;
  footer?: string;
}) {
  const body = (
    <>
      <span className="note-pin" />
      <span className="note-clip" />
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-extrabold leading-tight">{title}</h3>
        <span className="shrink-0 rounded-full bg-white/70 px-2 py-1 text-[11px] font-extrabold">{priorityLabel(priority)}</span>
      </div>
      {description ? <p className="mt-1 line-clamp-3 text-sm font-semibold text-[#24324a]/80">{description}</p> : null}
      <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-extrabold">
        <span className="rounded-full bg-white/70 px-2 py-1">{className}</span>
        {studentName ? <span className="rounded-full bg-white/70 px-2 py-1">{studentName}</span> : null}
        {wholeClass ? <span className="rounded-full bg-white/70 px-2 py-1">Cả lớp</span> : null}
      </div>
      <dl className="mt-3 space-y-1 text-sm font-bold">
        <div>Assigned {formatLongDate(assignmentDate)}</div>
        <div>
          Due {formatLongDate(deadlineDate)} · {formatTime(deadlineTime)}
        </div>
        {deadlineAt && status ? (
          <div>
            <Countdown deadlineAt={deadlineAt} status={status} paused={submissionPending} />
          </div>
        ) : null}
      </dl>
      <p className="mt-2 text-xs font-bold">
        <span className="font-extrabold">Hình phạt: </span>
        {penalty || 'Không có'}
      </p>
      {submissionPending ? <p className="mt-2 text-xs font-extrabold text-[#315fc4]">Đã nộp · đang chờ giáo viên xem bài</p> : null}
      <div className="mt-3 flex items-center justify-between gap-2">
        {status ? <StatusPill status={status} /> : <span />}
        {footer ? <span className="text-xs font-extrabold">{footer}</span> : null}
      </div>
    </>
  );
  const classNames = `relative block w-full rounded-3xl p-4 pt-6 text-left shadow-[0_12px_24px_rgba(36,50,74,0.08)] transition hover:-translate-y-1 ${noteColors[color]}`;
  const style = { transform: `rotate(${tilt(id)}deg)` };
  if (href) {
    return (
      <Link to={href} className={classNames} style={style}>
        {body}
      </Link>
    );
  }
  return (
    <article className={classNames} style={style}>
      {body}
    </article>
  );
}
