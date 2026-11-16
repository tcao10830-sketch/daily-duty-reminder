import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '../lib/query';
import { greeting, hcmToday, formatWeekdayDate } from '../lib/format';

const teacherLinks = [
  ['/teacher', 'Dashboard'],
  ['/teacher/classes', 'Classes'],
  ['/teacher/tasks', 'Tasks'],
  ['/teacher/calendar', 'Calendar'],
  ['/teacher/progress', 'Student Progress'],
  ['/teacher/notifications', 'Notifications'],
  ['/teacher/settings', 'Settings'],
];

const studentLinks = [
  ['/student', 'Home'],
  ['/student/tasks', 'My Tasks'],
  ['/student/calendar', 'Calendar'],
  ['/student/progress', 'My Progress'],
  ['/student/notifications', 'Notifications'],
  ['/student/profile', 'Profile'],
];

export function AppShell() {
  const { user, logout } = useAuth();
  const { data } = useQuery<{ unread: number }>('/api/notifications');
  const links = user?.role === 'teacher' ? teacherLinks : studentLinks;
  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-3xl text-[#FF914D]">Daily Duty</p>
          <p className="font-extrabold text-[#315fbf]">
            {greeting()}, {user?.name}
          </p>
          <p className="text-sm font-bold text-slate-500">{formatWeekdayDate(hcmToday())} · Asia/Ho_Chi_Minh</p>
        </div>
        <button type="button" onClick={logout} className="rounded-full bg-white px-4 py-2 font-extrabold shadow-sm">
          Log out
        </button>
      </header>
      <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {links.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/teacher' || to === '/student'}
            className={({ isActive }) =>
              `relative shrink-0 rounded-full px-4 py-2 text-sm font-extrabold ${isActive ? 'bg-[#4F87FF] text-white' : 'bg-white text-[#24324a] shadow-sm'}`
            }
          >
            {label}
            {label === 'Notifications' && data && data.unread > 0 ? (
              <span className="ml-2 rounded-full bg-[#EF5B68] px-1.5 text-xs text-white">{data.unread}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>
      <main className="mt-5">
        <Outlet />
      </main>
    </div>
  );
}
