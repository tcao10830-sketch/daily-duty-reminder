import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { StickyNote } from '../../components/StickyNote';
import { TaskForm, emptyTaskForm, type TaskFormValues } from '../../components/TaskForm';
import { Banner, Button, Empty, Loading, StatusPill } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { formatStamp } from '../../lib/format';
import { useQuery } from '../../lib/query';
import type { AssignmentCard, ClassSummary, CompletionStatus, TaskSummary } from '../../types';

export function TasksPage() {
  const { data, error, loading } = useQuery<{ tasks: TaskSummary[] }>('/api/teacher/tasks');
  const [showCancelled, setShowCancelled] = useState(false);
  const tasks = (data?.tasks ?? []).filter((task) => showCancelled || task.taskStatus === 'active');
  if (loading && !data) return <Loading />;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Task board</h1>
        <div className="flex gap-2">
          <Button tone="ghost" onClick={() => setShowCancelled((value) => !value)}>{showCancelled ? 'Hide cancelled' : 'Show cancelled'}</Button>
          <Link to="/teacher/tasks/new" className="rounded-2xl bg-[#FF914D] px-4 py-2.5 font-extrabold text-white">New task</Link>
        </div>
      </div>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {tasks.length === 0 ? <Empty>No tasks on the board.</Empty> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <StickyNote
              key={task.id}
              id={task.id}
              href={`/teacher/tasks/${task.id}`}
              title={task.title}
              description={task.description}
              className={task.className}
              wholeClass={task.assignedCount !== 1}
              studentName={task.assignedCount === 1 ? '1 student' : undefined}
              assignmentDate={task.assignmentDate}
              deadlineDate={task.deadlineDate}
              deadlineTime={task.deadlineTime}
              priority={task.priority}
              penalty={task.penalty}
              color={task.color}
              footer={task.taskStatus === 'cancelled' ? 'Cancelled' : `${task.completionRate}% · ${task.completedCount}/${task.assignedCount}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function NewTaskPage() {
  const { data, loading } = useQuery<{ classes: ClassSummary[] }>('/api/teacher/classes');
  const { bump } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (loading && !data) return <Loading />;
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-3 text-2xl font-extrabold">Assign a task</h1>
      {error ? <div className="mb-3"><Banner tone="error">{error}</Banner></div> : null}
      <TaskForm
        mode="create"
        classes={data?.classes ?? []}
        initial={emptyTaskForm(data?.classes[0]?.id ?? '')}
        busy={busy}
        onSubmit={async (values) => {
          setBusy(true);
          setError('');
          try {
            const result = await api<{ tasks: TaskSummary[] }>('/api/teacher/tasks', { method: 'POST', body: JSON.stringify(values) });
            bump();
            navigate(`/teacher/tasks/${result.tasks[0]?.id ?? ''}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not assign the task.');
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

export function TaskEditPage() {
  const { id = '' } = useParams();
  const detail = useQuery<{ task: TaskSummary; assignments: AssignmentCard[] }>(`/api/teacher/tasks/${id}`);
  const classes = useQuery<{ classes: ClassSummary[] }>('/api/teacher/classes');
  const { bump } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if ((detail.loading && !detail.data) || (classes.loading && !classes.data)) return <Loading />;
  if (!detail.data) return <Banner tone="error">{detail.error || 'Task not found.'}</Banner>;
  const task = detail.data.task;
  const initial: TaskFormValues = {
    ...emptyTaskForm(task.classId),
    title: task.title,
    description: task.description,
    instructions: task.instructions,
    classId: task.classId,
    assignmentDate: task.assignmentDate,
    deadlineDate: task.deadlineDate,
    deadlineTime: task.deadlineTime,
    priority: task.priority,
    penalty: task.penalty,
    color: task.color,
    recurrence: task.recurrence,
    studentId: detail.data.assignments.length === 1 ? detail.data.assignments[0].studentId : '',
  };
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-3 text-2xl font-extrabold">Edit task</h1>
      {error ? <div className="mb-3"><Banner tone="error">{error}</Banner></div> : null}
      <TaskForm
        mode="edit"
        classes={classes.data?.classes ?? []}
        initial={initial}
        busy={busy}
        onSubmit={async (values) => {
          setBusy(true);
          setError('');
          try {
            await api(`/api/teacher/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(values) });
            bump();
            navigate(`/teacher/tasks/${id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save.');
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

export function TaskDetailPage() {
  const { id = '' } = useParams();
  const { data, error, loading } = useQuery<{ task: TaskSummary; assignments: AssignmentCard[] }>(`/api/teacher/tasks/${id}`);
  const { bump } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | CompletionStatus>('all');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  if (loading && !data) return <Loading />;
  if (!data) return <Banner tone="error">{error || 'Task not found.'}</Banner>;
  const rows = data.assignments.filter((row) => filter === 'all' || row.status === filter);

  async function act(path: string, method: string, after?: () => void) {
    setFormError('');
    try {
      await api(path, { method });
      bump();
      after?.();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Request failed.');
    }
  }

  return (
    <div className="grid gap-4">
      <StickyNote
        id={data.task.id}
        title={data.task.title}
        description={data.task.description}
        className={data.task.className}
        wholeClass={data.assignments.length !== 1}
        studentName={data.assignments.length === 1 ? data.assignments[0].studentName : undefined}
        assignmentDate={data.task.assignmentDate}
        deadlineDate={data.task.deadlineDate}
        deadlineTime={data.task.deadlineTime}
        deadlineAt={data.task.deadlineAt}
        priority={data.task.priority}
        penalty={data.task.penalty}
        color={data.task.color}
        footer={`${data.task.completionRate}% complete`}
      />
      {data.task.instructions ? <p className="rounded-3xl bg-white p-4 font-bold shadow-sm">Instructions: {data.task.instructions}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Link to={`/teacher/tasks/${id}/edit`} className="rounded-2xl bg-white px-4 py-2.5 font-extrabold shadow-sm">Edit</Link>
        <Button onClick={() => void act(`/api/teacher/tasks/${id}/duplicate`, 'POST', () => setMessage('Copy created.'))}>Duplicate</Button>
        <Button tone="orange" onClick={() => void act(`/api/teacher/tasks/${id}/cancel`, 'POST', () => setMessage('Task cancelled.'))}>Cancel</Button>
        <Button tone="red" onClick={() => {
          if (!confirm('Delete this task?')) return;
          void act(`/api/teacher/tasks/${id}`, 'DELETE', () => navigate('/teacher/tasks'));
        }}>Delete</Button>
      </div>
      {message ? <Banner tone="ok">{message}</Banner> : null}
      {formError ? <Banner tone="error">{formError}</Banner> : null}
      <div className="rounded-3xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-extrabold">{data.task.completedCount}/{data.task.assignedCount} students completed · {data.task.completionRate}%</h2>
          <select className="rounded-2xl border px-3 py-2 font-bold" value={filter} onChange={(event) => setFilter(event.target.value as 'all' | CompletionStatus)}>
            <option value="all">All</option>
            <option value="pending">Chưa hoàn thành</option>
            <option value="on_time">Đã hoàn thành đúng hạn</option>
            <option value="late">Đã hoàn thành muộn</option>
            <option value="overdue">Quá hạn</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="font-extrabold text-slate-500">
              <tr><th className="p-2">Student</th><th className="p-2">Status</th><th className="p-2">Completion time</th><th className="p-2"></th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.assignmentId} className="border-t border-[#eef3f8]">
                  <td className="p-2 font-extrabold"><Link to={`/teacher/progress/${row.studentId}`}>{row.studentName}</Link></td>
                  <td className="p-2"><StatusPill status={row.status} /></td>
                  <td className="p-2 font-bold">{row.completedAt ? formatStamp(row.completedAt) : '—'}</td>
                  <td className="p-2">
                    {row.completedAt ? <Button tone="ghost" onClick={() => void act(`/api/teacher/assignments/${row.assignmentId}/reopen`, 'POST', () => setMessage('Task reopened.'))}>Reopen</Button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <Empty>No students in this filter.</Empty> : null}
        </div>
      </div>
    </div>
  );
}
