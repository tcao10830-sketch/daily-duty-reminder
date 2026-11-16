import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { useAuth } from './context/AuthContext';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { ClassPage, ClassesPage } from './pages/teacher/ClassesPage';
import { DashboardPage } from './pages/teacher/DashboardPage';
import { NotificationsPage, ProgressPage, SettingsPage, StudentProgressPage, TeacherCalendarPage } from './pages/teacher/MorePages';
import { NewTaskPage, TaskDetailPage, TaskEditPage, TasksPage } from './pages/teacher/TasksPage';
import { MyTasksPage, ProfilePage, StudentCalendarPage, StudentHomePage, StudentNotificationsPage, StudentProgressPage as MyProgressPage, StudentTaskPage } from './pages/student/StudentPages';
import type { Role } from './types';

function Guard({ role }: { role: Role }) {
  const { user, ready } = useAuth();
  if (!ready) return <p className="grid min-h-screen place-items-center font-extrabold text-[#4F87FF]">Đang tải…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={user.role === 'teacher' ? '/teacher' : '/student'} replace />;
  return <AppShell />;
}

function HomeRedirect() {
  const { user, ready } = useAuth();
  if (!ready) return <p className="grid min-h-screen place-items-center font-extrabold text-[#4F87FF]">Đang tải…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'teacher' ? '/teacher' : '/student'} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<HomeRedirect />} />
      <Route element={<Guard role="teacher" />}>
        <Route path="/teacher" element={<DashboardPage />} />
        <Route path="/teacher/classes" element={<ClassesPage />} />
        <Route path="/teacher/classes/:id" element={<ClassPage />} />
        <Route path="/teacher/tasks" element={<TasksPage />} />
        <Route path="/teacher/tasks/new" element={<NewTaskPage />} />
        <Route path="/teacher/tasks/:id" element={<TaskDetailPage />} />
        <Route path="/teacher/tasks/:id/edit" element={<TaskEditPage />} />
        <Route path="/teacher/calendar" element={<TeacherCalendarPage />} />
        <Route path="/teacher/progress" element={<ProgressPage />} />
        <Route path="/teacher/progress/:id" element={<StudentProgressPage />} />
        <Route path="/teacher/notifications" element={<NotificationsPage />} />
        <Route path="/teacher/settings" element={<SettingsPage />} />
      </Route>
      <Route element={<Guard role="student" />}>
        <Route path="/student" element={<StudentHomePage />} />
        <Route path="/student/tasks" element={<MyTasksPage />} />
        <Route path="/student/tasks/:id" element={<StudentTaskPage />} />
        <Route path="/student/calendar" element={<StudentCalendarPage />} />
        <Route path="/student/progress" element={<MyProgressPage />} />
        <Route path="/student/notifications" element={<StudentNotificationsPage />} />
        <Route path="/student/profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
