export const TIMEZONE = 'Asia/Ho_Chi_Minh';

export type CompletionStatus = 'pending' | 'on_time' | 'late' | 'overdue';

export function todayInZone(now = new Date()): string {
  return dateTimeParts(now).date;
}

export function dateTimeParts(date: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

export function diffDays(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.round((b - a) / 86_400_000);
}

export function weekday(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function deadlineMs(date: string, time: string): number {
  return new Date(`${date}T${time}:00+07:00`).getTime();
}

export function completionStatus(
  completedAt: string | null,
  deadlineDate: string,
  deadlineTime: string,
  now = Date.now(),
): CompletionStatus {
  const deadline = deadlineMs(deadlineDate, deadlineTime);
  if (completedAt) {
    return new Date(completedAt).getTime() <= deadline ? 'on_time' : 'late';
  }
  return now > deadline ? 'overdue' : 'pending';
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(deadlineMs(value, '00:00'));
}

export function isHm(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export type Recurrence = 'once' | 'daily' | 'weekly' | 'custom';

export function planInstances(input: {
  recurrence: Recurrence;
  assignmentDate: string;
  deadlineDate: string;
  weekdays?: number[];
  customDates?: string[];
  horizonDays?: number;
}): { assignmentDate: string; deadlineDate: string }[] {
  if (!isIsoDate(input.assignmentDate) || !isIsoDate(input.deadlineDate)) {
    throw new Error('Use real assignment and deadline dates.');
  }
  const offset = diffDays(input.assignmentDate, input.deadlineDate);
  if (offset < 0) throw new Error('The deadline date cannot be before the assignment date.');

  if (input.recurrence === 'once') {
    return [{ assignmentDate: input.assignmentDate, deadlineDate: input.deadlineDate }];
  }

  if (input.recurrence === 'custom') {
    const dates = [...new Set([input.assignmentDate, ...(input.customDates ?? [])])].filter(isIsoDate).sort();
    if (!dates.length) throw new Error('Choose at least one date.');
    return dates.map((date) => ({ assignmentDate: date, deadlineDate: addDays(date, offset) }));
  }

  const horizon = input.horizonDays ?? 14;
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 31) {
    throw new Error('The schedule window must be between 1 and 31 days.');
  }
  const end = addDays(input.assignmentDate, horizon - 1);
  const weekdays = input.weekdays ?? [];
  if (input.recurrence === 'weekly' && weekdays.length === 0) {
    throw new Error('Choose at least one weekday.');
  }

  const instances: { assignmentDate: string; deadlineDate: string }[] = [];
  for (let date = input.assignmentDate; date <= end; date = addDays(date, 1)) {
    if (input.recurrence === 'weekly' && !weekdays.includes(weekday(date))) continue;
    instances.push({ assignmentDate: date, deadlineDate: addDays(date, offset) });
  }
  if (!instances.length) throw new Error('That schedule does not create any tasks.');
  if (instances.length > 31) throw new Error('Too many task instances.');
  return instances;
}
