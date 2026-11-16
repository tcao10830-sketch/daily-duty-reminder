import { Link } from 'react-router-dom';
import { StickyNote } from '../../components/StickyNote';
import { Mascot } from '../../components/Mascot';
import { Empty, Loading, StatCard, WeekBars } from '../../components/ui';
import { useQuery } from '../../lib/query';
import type { ClassSummary, TaskSummary, WeekPoint } from '../../types';

type Overview = {
  stats: { classes: number; students: number; assignedToday: number; completed: number; pending: number; overdue: number; completionRate: number };
  classes: ClassSummary[];
  tasks: TaskSummary[];
  weekly: WeekPoint[];
};

export function DashboardPage() {
  const { data, error, loading } = useQuery<Overview>('/api/teacher/overview');
  if (loading && !data) return <Loading />;
  if (error) return <p className="font-bold text-[#EF5B68]">{error}</p>;
  if (!data) return null;
  const active = data.tasks.filter((task) => task.taskStatus === 'active').slice(0, 6);
  return (
    <div className="grid gap-5">
      <section className="dashboard-hero flex items-center justify-between gap-3 px-5 py-5 sm:px-7 sm:py-6">
        <div className="relative z-10 max-w-xl">
          <span className="inline-flex rounded-full bg-white/75 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[#a66b22]">Góc lớp học của bạn</span>
          <h1 className="mt-3 font-display text-3xl leading-tight text-[#34445e] sm:text-4xl">Mỗi ngày một chút tiến bộ!</h1>
          <p className="mt-2 max-w-lg text-sm font-bold leading-relaxed text-[#5f6d7f] sm:text-base">Lớp học đã sẵn sàng! Theo dõi nhiệm vụ, ghi nhận tiến bộ và cùng nhau cố gắng mỗi ngày.</p>
          <Link to="/teacher/tasks/new" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#FF914D] px-5 py-2.5 text-sm font-extrabold text-white shadow-[0_5px_0_#dc7137] hover:-translate-y-0.5">
            <span aria-hidden="true">＋</span> Tạo nhiệm vụ
          </Link>
        </div>
        <div className="relative z-10 shrink-0">
          <Mascot size={142} />
          <span className="absolute -bottom-1 -left-5 -rotate-6 rounded-xl bg-white px-3 py-1.5 text-xs font-extrabold text-[#5a8b71] shadow-sm">Bạn làm được mà!</span>
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Lớp học" value={data.stats.classes} tint="#FFF3B0" />
        <StatCard label="Học sinh" value={data.stats.students} tint="#D6E6FF" />
        <StatCard label="Giao hôm nay" value={data.stats.assignedToday} tint="#FFE0C2" />
        <StatCard label="Đã hoàn thành" value={data.stats.completed} tint="#D8F6E4" />
        <StatCard label="Đang chờ" value={data.stats.pending} tint="#E6D9FF" />
        <StatCard label="Quá hạn" value={data.stats.overdue} tint="#FFD6E0" />
      </section>
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="font-extrabold">Nhiệm vụ hoàn thành trong tuần</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Mỗi bước nhỏ đều đáng ghi nhận ✦</p>
          <div className="mt-3">
            <WeekBars days={data.weekly} />
          </div>
        </div>
        <div className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="font-extrabold">Tiến độ lớp học</h2>
          <div className="mt-3 grid gap-3">
            {data.classes.length === 0 ? <Empty>Hãy tạo lớp học để bắt đầu.</Empty> : null}
            {data.classes.map((item) => (
              <Link key={item.id} to={`/teacher/classes/${item.id}`} className="rounded-2xl bg-[#f7fbff] p-3 hover:-translate-y-0.5">
                <div className="flex items-center justify-between font-extrabold">
                  <span>{item.name}</span>
                  <span>{item.completionRate}%</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white">
                  <div className="h-2.5 rounded-full bg-[#38C98B] transition-all duration-700" style={{ width: `${item.completionRate}%` }} />
                </div>
                <p className="mt-1 text-xs font-bold text-slate-500">{item.studentCount} học sinh · {item.completedCount}/{item.assignedCount} hoàn thành</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold">Bảng nhiệm vụ lớp học</h2>
            <p className="text-sm font-semibold text-slate-500">Góc nhỏ đầy màu sắc dành cho các nhiệm vụ.</p>
          </div>
          <Link to="/teacher/tasks/new" className="shrink-0 rounded-full bg-[#FF914D] px-4 py-2 font-extrabold text-white shadow-sm hover:-translate-y-0.5">Nhiệm vụ mới</Link>
        </div>
        {active.length === 0 ? <Empty>Chưa có nhiệm vụ nào.</Empty> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((task) => (
              <StickyNote
                key={task.id}
                id={task.id}
                href={`/teacher/tasks/${task.id}`}
                title={task.title}
                description={task.description}
                className={task.className}
                wholeClass
                assignmentDate={task.assignmentDate}
                deadlineDate={task.deadlineDate}
                deadlineTime={task.deadlineTime}
                priority={task.priority}
                penalty={task.penalty}
                color={task.color}
                footer={`${task.completedCount}/${task.assignedCount} · ${task.completionRate}%`}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
