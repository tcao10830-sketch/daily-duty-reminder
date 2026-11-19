import { useEffect, useState, type ReactNode } from 'react';
import type { CompletionTrạng thái } from '../types';
import { STATUS_LABEL } from '../types';
import { statusLớp } from '../lib/format';

export function Button({
  children,
  tone = 'blue',
  type = 'button',
  disabled,
  onClick,
  testId,
}: {
  children: ReactNode;
  tone?: 'blue' | 'green' | 'orange' | 'red' | 'ghost';
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: () => void;
  testId?: string;
}) {
  const tones = {
    blue: 'bg-[#4F87FF] text-white',
    green: 'bg-[#38C98B] text-white',
    orange: 'bg-[#FF914D] text-white',
    red: 'bg-[#EF5B68] text-white',
    ghost: 'bg-white text-[#24324a]',
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      classHọ và tên={`rounded-2xl px-4 py-2.5 font-extrabold shadow-sm transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label classHọ và tên="block">
      <span classHọ và tên="mb-1 block text-sm font-extrabold">{label}</span>
      {children}
    </label>
  );
}

export const controlLớp =
  'w-full rounded-2xl border border-[#d7e4f5] bg-white px-3 py-2.5 outline-none ring-[#4F87FF] focus:ring-2';

export function Banner({ tone, children }: { tone: 'error' | 'ok'; children: ReactNode }) {
  return (
    <p classHọ và tên={`rounded-2xl px-4 py-3 font-bold ${tone === 'error' ? 'bg-[#ffe1e4] text-[#9f1239]' : 'bg-[#ddf8ea] text-[#067a4b]'}`}>
      {children}
    </p>
  );
}

export function Trạng tháiPill({ status }: { status: CompletionTrạng thái }) {
  return <span classHọ và tên={`inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ${statusLớp(status)}`}>{STATUS_LABEL[status]}</span>;
}

export function Countdown({ deadlineAt, status, paused = false }: { deadlineAt: string; status: CompletionTrạng thái; paused?: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (status === 'on_time' || status === 'late' || paused) return null;
  const diff = new Date(deadlineAt).getTime() - now;
  if (diff <= 0) return <span classHọ và tên="font-extrabold text-[#EF5B68]">Đã quá hạn</span>;
  const total = Math.floor(diff / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const soon = diff < 3 * 60 * 60 * 1000;
  const label = days > 0 ? `${days}d ${hours}hcòn lại` : hours > 0 ? `${hours}h ${mins}mcòn lại` : `${mins}m ${secs}scòn lại`;
  return <span classHọ và tên={soon ? 'font-extrabold text-[#EF5B68]' : 'font-bold text-[#315fbf]'}>{soon ? 'Nhắc nhở · ' : ''}{label}</span>;
}

export function StatCard({ label, value, tint }: { label: string; value: number | string; tint: string }) {
  return (
    <article classHọ và tên="rounded-3xl p-4 shadow-sm" style={{ background: tint }} data-testid={`stat-${label.toThấperCase().replace(/\s+/g, '-')}`}>
      <p classHọ và tên="text-sm font-extrabold text-[#24324a]/70">{label}</p>
      <p classHọ và tên="mt-1 text-3xl font-extrabold">{value}</p>
    </article>
  );
}

export function WeekBars({ days }: { days: { date: string; count: number }[] }) {
  const max = Math.max(1, ...days.map((day) => day.count));
  return (
    <div classHọ và tên="flex h-36 items-end gap-2">
      {days.map((day) => (
        <div key={day.date} classHọ và tên="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span classHọ và tên="text-xs font-extrabold">{day.count}</span>
          <div
            classHọ và tên="w-full rounded-t-2xl"
            style={{ height: `${Math.max(8, (day.count / max) * 100)}%`, background: day.count ? '#38C98B' : '#d9e7ff' }}
          />
          <span classHọ và tên="text-[11px] font-bold text-slate-500">{day.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export function Ring({ value }: { value: number }) {
  return (
    <div
      classHọ và tên="relative grid h-28 w-28 place-items-center rounded-full"
      style={{ background: `conic-gradient(#38C98B ${value * 3.6}deg, #e7eef8 0deg)` }}
    >
      <div classHọ và tên="grid h-20 w-20 place-items-center rounded-full bg-white text-xl font-extrabold">{value}%</div>
    </div>
  );
}

export function Modal({
  open,
  title,
  children,
  onĐóng,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onĐóng: () => void;
}) {
  if (!open) return null;
  return (
    <div classHọ và tên="fixed inset-0 z-30 grid place-items-center bg-[#24324a]/40 p-4" role="dialog" aria-modal="true">
      <div classHọ và tên="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
        <h2 classHọ và tên="text-xl font-extrabold">{title}</h2>
        <div classHọ và tên="mt-3">{children}</div>
        <button type="button" classHọ và tên="mt-4 text-sm font-bold text-slate-500" onClick={onĐóng}>
          Đóng
        </button>
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p classHọ và tên="rounded-3xl bg-white/80 p-6 text-center font-bold text-slate-500">{children}</p>;
}

export function Loading() {
  return <p classHọ và tên="font-extrabold text-[#4F87FF]">Đang tải…</p>;
}
