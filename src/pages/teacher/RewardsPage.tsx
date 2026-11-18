import { useEffect, useState } from 'react';
import { Banner, Button, Empty, Loading } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { useQuery } from '../../lib/query';

type Rule = { hours: number; pencils: number };
type RewardData = {
  students: { id: string; name: string; class_name: string; total_pencils: number; current_streak: number; streak_status: string }[];
  pendingReviews: { assignment_id: string; streak_number: number; student_name: string; title: string; class_name: string }[];
  earlyRules: Rule[];
};

export function RewardsPage() {
  const { data, error, loading } = useQuery<RewardData>('/api/teacher/rewards');
  const { bump } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [hours, setHours] = useState('24');
  const [pencils, setPencils] = useState('1');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data) setRules(data.earlyRules ?? []);
  }, [data?.earlyRules]);

  async function saveRules() {
    setBusy(true); setMessage('');
    try {
      await api('/api/teacher/rewards/early-rules', { method: 'PUT', body: JSON.stringify({ rules }) });
      setMessage('Early-submission reward rules saved.');
      bump();
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Could not save rules.'); }
    finally { setBusy(false); }
  }

  async function decide(assignmentId: string, decision: 'keep' | 'break') {
    setBusy(true); setMessage('');
    try {
      await api(`/api/teacher/rewards/streaks/${assignmentId}/decision`, { method: 'POST', body: JSON.stringify({ decision }) });
      setMessage(decision === 'keep' ? 'Streak allowed to continue.' : 'Streak reset.');
      bump();
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Could not save decision.'); }
    finally { setBusy(false); }
  }

  async function adjust(studentId: string) {
    setBusy(true); setMessage('');
    try {
      await api(`/api/teacher/rewards/students/${studentId}/adjust`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amounts[studentId]), note: notes[studentId] }),
      });
      setAmounts((current) => ({ ...current, [studentId]: '' }));
      setNotes((current) => ({ ...current, [studentId]: '' }));
      setMessage('Pencil balance adjusted.');
      bump();
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Could not adjust balance.'); }
    finally { setBusy(false); }
  }

  async function resetStreak(studentId: string, name: string) {
    if (!window.confirm(`Reset the current streak for ${name}?`)) return;
    setBusy(true); setMessage('');
    try {
      await api(`/api/teacher/rewards/students/${studentId}/streak-reset`, { method: 'POST' });
      setMessage(`${name}'s streak has been reset.`);
      bump();
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Could not reset streak.'); }
    finally { setBusy(false); }
  }

  if (loading && !data) return <Loading />;
  if (!data) return <Banner tone="error">{error || 'Could not load rewards.'}</Banner>;

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-extrabold">Pencil rewards & streaks</h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">Manage early-submission rewards, student balances and streak decisions.</p>
      </div>
      {message ? <Banner tone="ok">{message}</Banner> : null}

      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-extrabold">Early-submission reward rules</h2>
        <p className="mt-1 text-sm text-slate-500">Set how many pencils students earn when they submit this many hours before the deadline. The highest matching threshold applies. Leave empty to disable this reward.</p>
        <div className="mt-3 grid gap-2">
          {rules.map((rule, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2 rounded-xl bg-[#f7f9fc] p-2">
              <span className="font-bold">At least</span>
              <strong>{rule.hours} hours early</strong>
              <span className="font-bold">= +{rule.pencils} ✏️</span>
              <button type="button" className="ml-auto rounded-lg px-3 py-1 font-bold text-red-600" onClick={() => setRules((current) => current.filter((_, i) => i !== index))}>Remove</button>
            </div>
          ))}
          {rules.length === 0 ? <p className="text-sm text-slate-400">No early-submission rewards configured.</p> : null}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm font-bold">Hours early
            <input className="w-28 rounded-xl border p-2" type="number" min="1" max="720" value={hours} onChange={(event) => setHours(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-bold">Pencils
            <input className="w-24 rounded-xl border p-2" type="number" min="1" max="100" value={pencils} onChange={(event) => setPencils(event.target.value)} />
          </label>
          <Button tone="blue" onClick={() => {
            const h = Number(hours), p = Number(pencils);
            if (!Number.isInteger(h) || h < 1 || h > 720 || !Number.isInteger(p) || p < 1 || p > 100 || rules.some((item) => item.hours === h)) {
              setMessage('Enter a valid threshold and a unique number of hours.');
              return;
            }
            setRules((current) => [...current, { hours: h, pencils: p }].sort((a, b) => b.hours - a.hours));
            setMessage('');
          }}>Add rule</Button>
          <Button disabled={busy} onClick={() => void saveRules()}>Save rules</Button>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-extrabold">Needs revision · streak decision</h2>
        <p className="mt-1 text-sm text-slate-500">The student has already submitted and counted toward the streak. Decide whether the streak is allowed to continue after the revision request.</p>
        <div className="mt-3 grid gap-3">
          {data.pendingReviews.map((item) => (
            <div key={item.assignment_id} className="rounded-2xl border border-orange-200 bg-orange-50 p-3">
              <p className="font-extrabold">{item.student_name} · {item.class_name}</p>
              <p className="text-sm font-semibold">{item.title} · streak task #{item.streak_number}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button tone="green" disabled={busy} onClick={() => void decide(item.assignment_id, 'keep')}>Allow streak to continue</Button>
                <Button tone="red" disabled={busy} onClick={() => void decide(item.assignment_id, 'break')}>Reset streak</Button>
              </div>
            </div>
          ))}
          {data.pendingReviews.length === 0 ? <Empty>No streak decisions waiting for you.</Empty> : null}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-extrabold">Student reward management</h2>
        <div className="mt-3 grid gap-3">
          {data.students.map((student) => (
            <div key={student.id} className="rounded-2xl border border-slate-100 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-extrabold">{student.name}</p>
                  <p className="text-xs font-semibold text-slate-500">{student.class_name}</p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold">{student.total_pencils} ✏️</p>
                  <p className="text-xs font-bold text-slate-500">{student.current_streak} task streak · {student.streak_status}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[110px_1fr_auto]">
                <input className="rounded-xl border p-2" type="number" placeholder="+ / -" value={amounts[student.id] ?? ''} onChange={(event) => setAmounts((current) => ({ ...current, [student.id]: event.target.value }))} />
                <input className="rounded-xl border p-2" placeholder="Reason for adjustment" value={notes[student.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [student.id]: event.target.value }))} />
                <Button tone="blue" disabled={busy || !amounts[student.id] || !notes[student.id]} onClick={() => void adjust(student.id)}>Adjust pencils</Button>
              </div>
              <button type="button" disabled={busy || student.current_streak === 0} className="mt-2 text-sm font-extrabold text-red-600 disabled:opacity-40" onClick={() => void resetStreak(student.id, student.name)}>Reset current streak</button>
            </div>
          ))}
          {data.students.length === 0 ? <Empty>No students yet.</Empty> : null}
        </div>
      </section>
    </div>
  );
}
