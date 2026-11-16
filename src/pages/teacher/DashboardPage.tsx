import { Link } from 'react-router-dom';
import { StickyNote } from '../../components/StickyNote';
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
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Classes" value={data.stats.classes} tint="#FFF3B0" />
        <StatCard label="Students" value={data.stats.students} tint="#D6E6FF" />
        <StatCard label="Assigned today" value={data.stats.assignedToday} tint="#FFE0C2" />
        <StatCard label="Completed" value={data.stats.completed} tint="#D8F6E4" />
        <StatCard label="Pending" value={data.stats.pending} tint="#E6D9FF" />
        <StatCard label="Overdue" value={data.stats.overdue} tint="#FFD6E0" />
      </section>
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="font-extrabold">Completions this week</h2>
          <div className="mt-3">
            <WeekBars days={data.weekly} />
          </div>
        </div>
        <div className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="font-extrabold">Class progress</h2>
          <div className="mt-3 grid gap-3">
            {data.classes.length === 0 ? <Empty>Create a class to get started.</Empty> : null}
            {data.classes.map((item) => (
              <Link key={item.id} to={`/teacher/classes/${item.id}`} className="rounded-2xl bg-[#f7fbff] p-3">
                <div className="flex items-center justify-between font-extrabold">
                  <span>{item.name}</span>
                  <span>{item.completionRate}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white">
                  <div className="h-2 rounded-full bg-[#38C98B]" style={{ width: `${item.completionRate}%` }} />
                </div>
                <p className="mt-1 text-xs font-bold text-slate-500">{item.studentCount} students · {item.completedCount}/{item.assignedCount} done</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Classroom board</h2>
          <Link to="/teacher/tasks/new" className="rounded-full bg-[#FF914D] px-4 py-2 font-extrabold text-white">New task</Link>
        </div>
        {active.length === 0 ? <Empty>No tasks yet.</Empty> : (
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
