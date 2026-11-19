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


const notificationTitles: Record<string, string> = {
  'New task assigned': 'Có nhiệm vụ mới được giao',
  'Task deadline changed': 'Hạn nộp nhiệm vụ đã thay đổi',
  'Task updated': 'Nhiệm vụ đã được cập nhật',
  'Task cancelled': 'Nhiệm vụ đã bị hủy',
  'Task deleted': 'Nhiệm vụ đã bị xóa',
  'Student completed a task': 'Học sinh đã hoàn thành nhiệm vụ',
  'Task reopened': 'Nhiệm vụ đã được mở lại',
  'Revision requested': 'Giáo viên yêu cầu chỉnh sửa',
  'Task overdue': 'Nhiệm vụ đã quá hạn',
  'Task became overdue': 'Nhiệm vụ của học sinh đã quá hạn',
  'Deadline approaching': 'Sắp đến hạn nộp',
  'Streak decision needed': 'Cần quyết định về chuỗi thành tích',
  'Your streak has ended': 'Chuỗi thành tích của bạn đã kết thúc',
  'Your streak is at risk': 'Chuỗi thành tích của bạn đang có nguy cơ bị gián đoạn',
  'A student streak is at risk': 'Chuỗi thành tích của học sinh có nguy cơ bị gián đoạn',
  'Your streak was reset': 'Chuỗi thành tích của bạn đã được đặt lại',
  'Streak reset by teacher': 'Giáo viên đã đặt lại chuỗi',
  'Streak approved to continue': 'Chuỗi thành tích được tiếp tục',
};

export function translateNotificationTitle(title: string): string {
  return notificationTitles[title] ?? title;
}

export function translateNotificationBody(body: string): string {
  const patterns: [RegExp, (match: RegExpMatchArray) => string][] = [
    [/^(.+) is due (.+) at (.+)\\.$/, (m) => `${m[1]} có hạn nộp vào ${m[2]} lúc ${m[3]}.`],
    [/^(.+) is now due (.+) at (.+)\\.$/, (m) => `Hạn nộp của ${m[1]} đã được đổi thành ${m[2]} lúc ${m[3]}.`],
    [/^(.+) was updated\\.$/, (m) => `Nhiệm vụ ${m[1]} đã được cập nhật.`],
    [/^(.+) was cancelled\\.$/, (m) => `Nhiệm vụ ${m[1]} đã bị hủy.`],
    [/^(.+) was deleted\\.$/, (m) => `Nhiệm vụ ${m[1]} đã bị xóa.`],
    [/^(.+) completed “(.+)”\\. Class progress: (.+)\\.$/, (m) => `${m[1]} đã hoàn thành “${m[2]}”. Tiến độ lớp: ${m[3]}.`],
    [/^(.+) was reopened by your teacher\\.$/, (m) => `Giáo viên đã mở lại nhiệm vụ “${m[1]}”.`],
    [/^Your teacher asked you to revise “(.+)”\\.$/, (m) => `Giáo viên yêu cầu bạn chỉnh sửa bài “${m[1]}”.`],
    [/^(.+) is past the deadline\\. Penalty: (.+)\\.$/, (m) => `Nhiệm vụ “${m[1]}” đã quá hạn. Hình phạt: ${m[2]}.`],
    [/^(.+) has not completed “(.+)”\\.$/, (m) => `${m[1]} chưa hoàn thành “${m[2]}”.`],
    [/^“(.+)” is overdue\\. Complete it within 24 hours to keep your streak\\.$/, (m) => `Nhiệm vụ “${m[1]}” đã quá hạn. Hãy hoàn thành trong vòng 24 giờ để duy trì chuỗi.`],
    [/^A student has an overdue task: “(.+)”\\.$/, (m) => `Một học sinh có nhiệm vụ đã quá hạn: “${m[1]}”.`],
  ];
  for (const [pattern, render] of patterns) {
    const match = body.match(pattern);
    if (match) return render(match);
  }
  const exact: Record<string, string> = {
    'The 24-hour recovery window has passed. Your next completed task starts a new streak.': 'Thời gian gia hạn 24 giờ đã kết thúc. Nhiệm vụ tiếp theo bạn hoàn thành sẽ bắt đầu một chuỗi mới.',
    'A task remained overdue beyond the 24-hour recovery window. Your next completed task starts a new streak.': 'Một nhiệm vụ vẫn quá hạn sau thời gian gia hạn 24 giờ. Nhiệm vụ tiếp theo bạn hoàn thành sẽ bắt đầu một chuỗi mới.',
    'Your teacher reset your current task streak.': 'Giáo viên đã đặt lại chuỗi nhiệm vụ hiện tại của bạn.',
    'Your teacher decided that the streak for “' + '' + '” will not continue.': body,
  };
  return exact[body] ?? body;
}

export function statusClass(status: CompletionStatus): string {
  if (status === 'on_time') return 'bg-[#38C98B] text-white';
  if (status === 'late') return 'bg-[#FF914D] text-white';
  if (status === 'overdue') return 'bg-[#EF5B68] text-white';
  return 'bg-[#4F87FF] text-white';
}
