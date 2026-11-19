import { useEffect, useRef } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '../lib/query';
import { greeting, hcmHôm nay, formatWeekdayDate } from '../lib/format';
import { InstallAppButton } from './InstallAppButton';
import { playNotificationSound } from '../lib/sounds';
import type { NotificationItem } from '../types';

const teacherLinks = [
  ['/teacher', 'Tổng quan', '✦'],
  ['/teacher/classes', 'Lớp học', '▦'],
  ['/teacher/tasks', 'Nhiệm vụ', '✓'],
  ['/teacher/calendar', 'Lịch', '▣'],
  ['/teacher/progress', 'Tiến độ học sinh', '↗'],
  ['/teacher/rewards', 'Phần thưởng', '✏️'],
  ['/teacher/notifications', 'Thông báo', '♧'],
  ['/teacher/settings', 'Cài đặt', '⚙'],
];

const studentLinks = [
  ['/student', 'Trang chủ', '⌂'],
  ['/student/tasks', 'My Nhiệm vụ', '✓'],
  ['/student/calendar', 'Lịch', '▣'],
  ['/student/progress', 'Tiến độ của tôi', '↗'],
  ['/student/achievements', 'Thành tích', '✏️'],
  ['/student/notifications', 'Thông báo', '♧'],
  ['/student/profile', 'Hồ sơ', '☺'],
];

export function AppShell() {
  const { user, logout } = useAuth();
  const { data } = useQuery<{ unread: number; notifications: NotificationItem[] }>('/api/notifications');
  const previousUnreadIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    const notifications = data?.notifications;
    if (!notifications) return;
    const unreadIds = new Set(notifications.filter((item) => !item.read).map((item) => item.id));
    if (previousUnreadIds.current) {
      const hasNewNotification = [...unreadIds].some((id) => !previousUnreadIds.current?.has(id));
      if (hasNewNotification) playNotificationSound();
    }
    previousUnreadIds.current = unreadIds;
  }, [data?.notifications]);
  const links = user?.role === 'teacher' ? teacherLinks : studentLinks;
  return (
    <div classHọ và tên="app-shell mx-auto min-h-screen max-w-6xl px-4 py-5 sm:px-5">
      <header classHọ và tên="app-header flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div classHọ và tên="relative z-10 flex min-w-0 items-center gap-3">
          <div classHọ và tên="brand-mark shrink-0"><img src="/icon.svg" alt="Hằng ngày Duty calendar" classHọ và tên="h-11 w-11 rounded-2xl" /></div>
          <div classHọ và tên="min-w-0">
            <p classHọ và tên="font-display text-2xl leading-none text-[#FF914D] sm:text-3xl">Hằng ngày Duty</p>
            <p classHọ và tên="mt-1 truncate text-sm font-extrabold text-[#315fbf]">
              {greeting()}, {user?.name}!
            </p>
            <p classHọ và tên="mt-0.5 text-xs font-bold text-slate-500">{formatWeekdayDate(hcmHôm nay())} · Asia/Ho_Chi_Minh</p>
          </div>
        </div>
        <div classHọ và tên="relative z-10 flex flex-wrap items-center justify-end gap-2">
          <InstallAppButton />
          <div classHọ và tên="hidden items-center gap-2 rounded-full bg-white/75 px-3 py-2 text-xs font-extrabold text-[#52705f] sm:flex">
            <span classHọ và tên="text-[#38C98B]">●</span>
            {user?.role === 'teacher' ? 'Khu vực giáo viên' : 'Khu vực học sinh'}
          </div>
          <button type="button" onClick={logout} classHọ và tên="rounded-full border border-white bg-white/90 px-4 py-2 text-sm font-extrabold text-[#40516b] shadow-sm hover:bg-[#fff3d1]">
            Đăng xuất
          </button>
        </div>
      </header>
      <nav classHọ và tên="app-nav mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Main navigation">
        {links.map(([to, label, symbol]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/teacher' || to === '/student'}
            classHọ và tên={({ isActive }) =>
              `relative flex shrink-0 items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm font-extrabold ${isActive ? 'text-white' : 'bg-white/80 text-[#34445e]'}`
            }
          >
            <span aria-hidden="true" classHọ và tên="text-base">{symbol}</span>
            {label}
            {label === 'Thông báo' && data && data.unread > 0 ? (
              <span classHọ và tên="ml-0.5 rounded-full bg-[#EF5B68] px-1.5 py-0.5 text-[11px] text-white">{data.unread}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>
      <main classHọ và tên="page-enter mt-5">
        <Outlet />
      </main>
      <footer classHọ và tên="mt-10 flex items-center justify-center gap-2 pb-4 text-xs font-bold text-slate-400">
        <span>Cùng bạn tạo nên ngày học tập tích cực hơn</span>
        <span classHọ và tên="text-[#FFB94D]">✦</span>
      </footer>
    </div>
  );
}
