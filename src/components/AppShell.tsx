import { useEffect, useRef } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '../lib/query';
import { greeting, hcmToday, formatWeekdayDate } from '../lib/format';
import { Mascot } from './Mascot';
import { playClickSound, playNotificationSound } from '../lib/sounds';

const teacherLinks = [
  ['/teacher', 'Dashboard', '✦'],
  ['/teacher/classes', 'Classes', '▦'],
  ['/teacher/tasks', 'Tasks', '✓'],
  ['/teacher/calendar', 'Calendar', '▣'],
  ['/teacher/progress', 'Student Progress', '↗'],
  ['/teacher/notifications', 'Notifications', '♧'],
  ['/teacher/settings', 'Settings', '⚙'],
];

const studentLinks = [
  ['/student', 'Home', '⌂'],
  ['/student/tasks', 'My Tasks', '✓'],
  ['/student/calendar', 'Calendar', '▣'],
  ['/student/progress', 'My Progress', '↗'],
  ['/student/notifications', 'Notifications', '♧'],
  ['/student/profile', 'Profile', '☺'],
];

export function AppShell() {
  const { user, logout } = useAuth();
  const { data } = useQuery<{ unread: number }>('/api/notifications');
  const links = user?.role === 'teacher' ? teacherLinks : studentLinks;
  const previousUnread = useRef<number | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest('button, a, [role="button"]');
      if (!control || (control instanceof HTMLButtonElement && control.disabled)) return;
      playClickSound();
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  useEffect(() => {
    if (typeof data?.unread !== 'number') return;
    if (previousUnread.current !== null && data.unread > previousUnread.current) {
      playNotificationSound();
    }
    previousUnread.current = data.unread;
  }, [data?.unread]);
  return (
    <div className="app-shell mx-auto min-h-screen max-w-6xl px-4 py-5 sm:px-5">
      <header className="app-header flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="relative z-10 flex min-w-0 items-center gap-3">
          <div className="brand-mark shrink-0"><span className="font-display text-2xl">✦</span></div>
          <div className="min-w-0">
            <p className="font-display text-2xl leading-none text-[#FF914D] sm:text-3xl">Daily Duty</p>
            <p className="mt-1 truncate text-sm font-extrabold text-[#315fbf]">
              {greeting()}, {user?.name}!
            </p>
            <p className="mt-0.5 text-xs font-bold text-slate-500">{formatWeekdayDate(hcmToday())} · Asia/Ho_Chi_Minh</p>
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full bg-white/75 px-3 py-2 text-xs font-extrabold text-[#52705f] sm:flex">
            <span className="text-[#38C98B]">●</span>
            {user?.role === 'teacher' ? 'Teacher space' : 'Student space'}
          </div>
          <button type="button" onClick={logout} className="rounded-full border border-white bg-white/90 px-4 py-2 text-sm font-extrabold text-[#40516b] shadow-sm hover:bg-[#fff3d1]">
            Log out
          </button>
        </div>
      </header>
      <nav className="app-nav mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Main navigation">
        {links.map(([to, label, symbol]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/teacher' || to === '/student'}
            className={({ isActive }) =>
              `relative flex shrink-0 items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm font-extrabold ${isActive ? 'text-white' : 'bg-white/80 text-[#34445e]'}`
            }
          >
            <span aria-hidden="true" className="text-base">{symbol}</span>
            {label}
            {label === 'Notifications' && data && data.unread > 0 ? (
              <span className="ml-0.5 rounded-full bg-[#EF5B68] px-1.5 py-0.5 text-[11px] text-white">{data.unread}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>
      <main className="page-enter mt-5">
        <Outlet />
      </main>
      <footer className="mt-10 flex items-center justify-center gap-2 pb-4 text-xs font-bold text-slate-400">
        <span>Made for a brighter study day</span>
        <span className="text-[#FFB94D]">✦</span>
      </footer>
    </div>
  );
}
