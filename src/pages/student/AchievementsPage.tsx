import { useQuery } from '../../lib/query';
import { Banner, Empty, Loading } from '../../components/ui';
import { formatStamp } from '../../lib/format';

type RewardData = {
  totalPencils: number;
  equivalentStars: number;
  currentStreak: number;
  streakStatus: string;
  graceDeadlineAt: string | null;
  threatenedTaskTitle: string | null;
  earlyRules: { hours: number; pencils: number }[];
  recent: { source: string; amount: number; note: string; created_at: string }[];
};

const sourceLabel: Record<string, string> = {
  early: 'Early submission',
  quality: 'Work quality',
  streak: 'Task streak',
  adjustment: 'Teacher adjustment',
  streak_reversal: 'Streak reward reversal',
};

export function AchievementsPage() {
  const { data, error, loading } = useQuery<RewardData>('/api/student/rewards');
  if (loading && !data) return <Loading />;
  if (!data) return <Banner tone="error">{error || 'Could not load achievements.'}</Banner>;
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-extrabold">My achievements</h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">Collect pencils as you complete tasks and improve your work.</p>
      </div>
      {data.streakStatus === 'threatened' ? (
        <section className="rounded-3xl border-2 border-red-300 bg-red-50 p-4 text-red-800 shadow-sm">
          <p className="font-extrabold">⚠ Your streak is at risk!</p>
          <p className="mt-1 text-sm font-bold">Complete “{data.threatenedTaskTitle || 'your overdue task'}” within the 24-hour recovery window to keep your streak.</p>
          {data.graceDeadlineAt ? <p className="mt-2 text-sm font-extrabold">Recovery deadline: {formatStamp(data.graceDeadlineAt)}</p> : null}
        </section>
      ) : null}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl bg-[#FFF3B0] p-5 shadow-sm">
          <p className="text-sm font-extrabold text-[#805b19]">Total pencils</p>
          <p className="mt-2 text-4xl font-black text-[#34445e]">{data.totalPencils} ✏️</p>
          <p className="mt-1 text-sm font-bold text-[#805b19]">1 pencil = 2 stars</p>
        </div>
        <div className="rounded-3xl bg-[#D6E6FF] p-5 shadow-sm">
          <p className="text-sm font-extrabold text-[#315fc4]">Star equivalent</p>
          <p className="mt-2 text-4xl font-black text-[#34445e]">{data.equivalentStars} ⭐</p>
          <p className="mt-1 text-sm font-bold text-[#315fc4]">For display only · not redeemable</p>
        </div>
      </section>
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="font-extrabold">Current task streak</h2>
        <p className="mt-2 text-3xl font-black">{data.currentStreak} tasks 🔥</p>
        <p className="mt-1 text-sm font-semibold text-slate-500">{data.streakStatus === 'threatened' ? 'At risk — use the recovery window.' : data.streakStatus === 'broken' ? 'The previous streak ended. Your next task starts a new one.' : 'Each distinct completed task adds to your streak.'}</p>
      </section>
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="font-extrabold">How to earn pencils</h2>
        <ul className="mt-2 grid gap-2 text-sm font-semibold text-slate-600">
          <li>• Submit early: earn the amount configured by your teacher.</li>
          <li>• Work quality: your teacher can award extra pencils after reviewing your work.</li>
          <li>• Task streak: tasks 1–5 earn no streak bonus; 6–20 +1; 21–35 +2; 36–45 +3; 46–50 +4; 51+ +5 pencils per task.</li>
        </ul>
        {data.earlyRules.length ? <p className="mt-2 text-xs font-bold text-slate-500">Current early-submission rules: {data.earlyRules.map((rule) => `${rule.hours}h early = +${rule.pencils}`).join(' · ')} pencils.</p> : null}
      </section>
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="font-extrabold">Pencil history</h2>
        <div className="mt-3 grid gap-2">
          {data.recent.map((item, index) => (
            <div key={`${item.created_at}-${index}`} className="flex items-start justify-between gap-3 rounded-xl bg-[#f7f9fc] p-3">
              <div><p className="font-extrabold">{sourceLabel[item.source] || item.source}</p><p className="text-xs text-slate-500">{item.note} · {formatStamp(item.created_at)}</p></div>
              <strong className={item.amount < 0 ? 'text-red-600' : 'text-green-700'}>{item.amount > 0 ? '+' : ''}{item.amount} ✏️</strong>
            </div>
          ))}
          {data.recent.length === 0 ? <Empty>No pencils earned yet. Complete your first task to get started!</Empty> : null}
        </div>
      </section>
    </div>
  );
}
