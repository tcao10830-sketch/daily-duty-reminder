import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { useAuth } from './context/AuthContext';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { Phần thưởngPage } from './pages/teacher/Phần thưởngPage';
import { Thành tíchPage } from './pages/student/Thành tíchPage';
import { LớpPage, Lớp họcPage } from './pages/teacher/Lớp họcPage';
import { Tổng quanPage } from './pages/teacher/Tổng quanPage';
import { Thông báoPage, ProgressPage, Cài đặtPage, Học sinhProgressPage, TeacherLịchPage } from './pages/teacher/MorePages';
import { NewNhiệm vụPage, Nhiệm vụDetailPage, Nhiệm vụChỉnh sửaPage, Nhiệm vụPage } from './pages/teacher/Nhiệm vụPage';
import { MyNhiệm vụPage, Hồ sơPage, Học sinhLịchPage, Học sinhTrang chủPage, Học sinhThông báoPage, Học sinhProgressPage as MyProgressPage, Học sinhNhiệm vụPage } from './pages/student/Học sinhPages';
import type { Role } from './types';

function Guard({ role }: { role: Role }) {
  const { user, ready } = useAuth();
  if (!ready) return <p classHọ và tên="grid min-h-screen place-items-center font-extrabold text-[#4F87FF]">Đang tải…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={user.role === 'teacher' ? '/teacher' : '/student'} replace />;
  return <AppShell />;
}

function Trang chủRedirect() {
  const { user, ready } = useAuth();
  if (!ready) return <p classHọ và tên="grid min-h-screen place-items-center font-extrabold text-[#4F87FF]">Đang tải…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'teacher' ? '/teacher' : '/student'} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<Trang chủRedirect />} />
      <Route element={<Guard role="teacher" />}>
        <Route path="/teacher" element={<Tổng quanPage />} />
        <Route path="/teacher/classes" element={<Lớp họcPage />} />
        <Route path="/teacher/classes/:id" element={<LớpPage />} />
        <Route path="/teacher/tasks" element={<Nhiệm vụPage />} />
        <Route path="/teacher/tasks/new" element={<NewNhiệm vụPage />} />
        <Route path="/teacher/tasks/:id" element={<Nhiệm vụDetailPage />} />
        <Route path="/teacher/tasks/:id/edit" element={<Nhiệm vụChỉnh sửaPage />} />
        <Route path="/teacher/calendar" element={<TeacherLịchPage />} />
        <Route path="/teacher/progress" element={<ProgressPage />} />
        <Route path="/teacher/rewards" element={<Phần thưởngPage />} />
        <Route path="/teacher/progress/:id" element={<Học sinhProgressPage />} />
        <Route path="/teacher/notifications" element={<Thông báoPage />} />
        <Route path="/teacher/settings" element={<Cài đặtPage />} />
      </Route>
      <Route element={<Guard role="student" />}>
        <Route path="/student" element={<Học sinhTrang chủPage />} />
        <Route path="/student/tasks" element={<MyNhiệm vụPage />} />
        <Route path="/student/tasks/:id" element={<Học sinhNhiệm vụPage />} />
        <Route path="/student/calendar" element={<Học sinhLịchPage />} />
        <Route path="/student/progress" element={<MyProgressPage />} />
        <Route path="/student/achievements" element={<Thành tíchPage />} />
        <Route path="/student/notifications" element={<Học sinhThông báoPage />} />
        <Route path="/student/profile" element={<Hồ sơPage />} />
      </Route>
      <Route path="*" element={<Trang chủRedirect />} />
    </Routes>
  );
}
