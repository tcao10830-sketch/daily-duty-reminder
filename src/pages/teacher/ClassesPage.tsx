import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { useQuery } from '../../lib/query';
import type { ClassSummary } from '../../types';
import { Banner, Button, Empty, Field, Loading, controlClass } from '../../components/ui';

export function ClassesPage() {
  const { data, error, loading } = useQuery<{ classes: ClassSummary[] }>('/api/teacher/classes');
  const { bump } = useAuth();
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');

  async function createClass() {
    setFormError('');
    try {
      await api('/api/teacher/classes', { method: 'POST', body: JSON.stringify({ name }) });
      setName('');
      setMessage('Class created.');
      bump();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create the class.');
    }
  }

  if (loading && !data) return <Loading />;
  return (
    <div className="grid gap-4">
      <form
        className="flex flex-wrap items-end gap-3 rounded-3xl bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void createClass();
        }}
      >
        <div className="min-w-56 flex-1">
          <Field label="New class">
            <input className={controlClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="10A1" required />
          </Field>
        </div>
        <Button type="submit">Create class</Button>
      </form>
      {message ? <Banner tone="ok">{message}</Banner> : null}
      {formError || error ? <Banner tone="error">{formError || error}</Banner> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {data?.classes.length === 0 ? <Empty>No classes yet.</Empty> : null}
        {data?.classes.map((item) => (
          <Link key={item.id} to={`/teacher/classes/${item.id}`} className="rounded-3xl bg-white p-4 shadow-sm">
            <h2 className="text-2xl font-extrabold">{item.name}</h2>
            <p className="font-bold text-slate-500">{item.studentCount} students</p>
            <p className="mt-2 font-extrabold text-[#067a4b]">{item.completionRate}% complete</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

type StudentRow = {
  id: string;
  name: string;
  email: string;
  assigned: number;
  completed: number;
  pending: number;
  overdue: number;
  completionRate: number;
};

export function ClassPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { bump } = useAuth();
  const { data, error, loading } = useQuery<{ class: ClassSummary; students: StudentRow[] }>(`/api/teacher/classes/${id}`);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('demo1234');
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [className, setClassName] = useState('');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');

  async function run(action: () => Promise<void>) {
    setFormError('');
    try {
      await action();
      bump();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  if (loading && !data) return <Loading />;
  if (error) return <Banner tone="error">{error}</Banner>;
  if (!data) return null;
  const shownName = className || data.class.name;

  return (
    <div className="grid gap-4">
      <div className="rounded-3xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Field label="Class name">
              <input className={controlClass} value={shownName} onChange={(event) => setClassName(event.target.value)} />
            </Field>
          </div>
          <Button onClick={() => void run(async () => { await api(`/api/teacher/classes/${id}`, { method: 'PATCH', body: JSON.stringify({ name: shownName }) }); setMessage('Class renamed.'); })}>Rename</Button>
          <Button
            tone="red"
            onClick={() => {
              if (!confirm(`Delete ${data.class.name}? Students in this class will lose access.`)) return;
              void run(async () => {
                await api(`/api/teacher/classes/${id}`, { method: 'DELETE' });
                navigate('/teacher/classes');
              });
            }}
          >
            Delete class
          </Button>
        </div>
        <p className="mt-3 font-bold text-slate-500">{data.class.completedCount}/{data.class.assignedCount} assignments complete · {data.class.completionRate}%</p>
      </div>
      {message ? <Banner tone="ok">{message}</Banner> : null}
      {formError ? <Banner tone="error">{formError}</Banner> : null}
      <form
        className="grid gap-3 rounded-3xl bg-white p-4 shadow-sm sm:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await api(`/api/teacher/classes/${id}/students`, { method: 'POST', body: JSON.stringify({ name, email, password }) });
            setName('');
            setEmail('');
            setMessage('Student added. They can log in with that email.');
          });
        }}
      >
        <Field label="Student name"><input className={controlClass} value={name} onChange={(event) => setName(event.target.value)} required /></Field>
        <Field label="Email"><input className={controlClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field>
        <Field label="Password"><input className={controlClass} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} /></Field>
        <div className="self-end"><Button type="submit">Add student</Button></div>
      </form>
      <div className="overflow-x-auto rounded-3xl bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-[#f7fbff] font-extrabold">
            <tr>
              <th className="p-3">Student</th>
              <th className="p-3">Status mix</th>
              <th className="p-3">Rate</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((student) => (
              <tr key={student.id} className="border-t border-[#eef3f8]">
                <td className="p-3">
                  <Link className="font-extrabold text-[#315fbf]" to={`/teacher/progress/${student.id}`}>{student.name}</Link>
                  <div className="text-slate-500">{student.email}</div>
                </td>
                <td className="p-3 font-bold">{student.completed} done · {student.pending} pending · {student.overdue} overdue</td>
                <td className="p-3 font-extrabold">{student.completionRate}%</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <Button tone="ghost" onClick={() => setEditing(student)}>Edit</Button>
                    <Button tone="red" onClick={() => {
                      if (!confirm(`Remove ${student.name}?`)) return;
                      void run(async () => { await api(`/api/teacher/students/${student.id}`, { method: 'DELETE' }); setMessage('Student removed.'); });
                    }}>Remove</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.students.length === 0 ? <Empty>Add a student to this class.</Empty> : null}
      </div>
      {editing ? (
        <form
          className="grid gap-3 rounded-3xl bg-[#FFF8E8] p-4 sm:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void run(async () => {
              await api(`/api/teacher/students/${editing.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ name: form.get('name'), email: form.get('email'), password: form.get('password') }),
              });
              setEditing(null);
              setMessage('Student updated.');
            });
          }}
        >
          <Field label="Name"><input name="name" className={controlClass} defaultValue={editing.name} required /></Field>
          <Field label="Email"><input name="email" className={controlClass} defaultValue={editing.email} required /></Field>
          <Field label="New password (optional)"><input name="password" className={controlClass} placeholder="Leave blank to keep" /></Field>
          <div className="flex items-end gap-2">
            <Button type="submit">Save</Button>
            <Button tone="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
