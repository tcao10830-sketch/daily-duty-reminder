import type { CompletionStatus, Priority } from '../types';

export function hcmToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: 'numeric', hourCycle: 'h23' }).format(new Date()),
  );
  if (hour < 12) return 'Chào buổi sáng';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export function formatLongDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('vi-VN', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatWeekdayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('vi-VN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatTime(value: string): string {
  const [hour, minute] = value.split(':').map(Number);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export function formatStamp(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function priorityLabel(priority: Priority): string {
  if (priority === 'high') return 'Cao';
  if (priority === 'medium') return 'Trung bình';
  return 'Thấp';
}

export function statusClass(status: CompletionStatus): string {
  if (status === 'on_time') return 'bg-[#38C98B] text-white';
  if (status === 'late') return 'bg-[#FF914D] text-white';
  if (status === 'overdue') return 'bg-[#EF5B68] text-white';
  return 'bg-[#4F87FF] text-white';
}
