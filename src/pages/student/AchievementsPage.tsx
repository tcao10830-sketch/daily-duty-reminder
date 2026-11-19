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
  early: 'Nộp bài sớm',
  quality: 'Chất lượng bài làm',
  streak: 'Chuỗi nhiệm vụ',
  adjustment: 'Điều chỉnh của giáo viên',
  streak_reversal: 'Thu hồi thưởng chuỗi',
};

export function AchievementsPage() {
  const { data, error, loading } = useQuery<RewardData>('/api/student/rewards');
  if (loading && !data) return <Loading />;
  if (!data) return <Banner tone="error">{error || 'Could not load achievements.'}</Banner>;
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-extrabold">Thành tích của tôi</h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">Tích lũy bút chì khi hoàn thành nhiệm vụ và cải thiện kết quả học tập.</p>
      </div>
      {data.streakStatus === 'threatened' ? (
        <section className="rounded-3xl border-2 border-red-300 bg-red-50 p-4 text-red-800 shadow-sm">
          <p className="font-extrabold">⚠ Your streak is at risk!</p>
          <p className="mt-1 text-sm font-bold">Hãy hoàn thành “{data.threatenedTaskTitle || 'nhiệm vụ đang quá hạn'}” trong thời gian gia hạn 24 giờ để duy trì chuỗi nhé.</p>
          {data.graceDeadlineAt ? <p className="mt-2 text-sm font-extrabold">Recovery deadline: {formatStamp(data.graceDeadlineAt)}</p> : null}
        </section>
      ) : null}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl bg-[#FFF3B0] p-5 shadow-sm">
          <p className="text-sm font-extrabold text-[#805b19]">Tổng số bút chì</p>
          <p className="mt-2 text-4xl font-black text-[#34445e]">{data.totalPencils} ✏️</p>
          <p className="mt-1 text-sm font-bold text-[#805b19]">1 bút chì = 2 ngôi sao</p>
        </div>
        <div className="rounded-3xl bg-[#D6E6FF] p-5 shadow-sm">
          <p className="text-sm font-extrabold text-[#315fc4]">Quy đổi thành sao</p>
          <p className="mt-2 text-4xl font-black text-[#34445e]">{data.equivalentStars} ⭐</p>
          <p className="mt-1 text-sm font-bold text-[#315fc4]">Chỉ để hiển thị · không thể đổi thưởng</p>
        </div>
      </section>
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="font-extrabold">Chuỗi nhiệm vụ liên tiếp hiện tại</h2>
        <p className="mt-2 text-3xl font-black">{data.currentStreak} tasks 🔥</p>
        <p className="mt-1 text-sm font-semibold text-slate-500">{data.streakStatus === 'threatened' ? 'Có nguy cơ gián đoạn — hãy hoàn thành trong thời gian gia hạn.' : data.streakStatus === 'broken' ? 'Chuỗi trước đã kết thúc. Nhiệm vụ tiếp theo sẽ bắt đầu chuỗi mới.' : 'Mỗi nhiệm vụ hoàn thành sẽ được tính vào chuỗi.'}</p>
      </section>
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="font-extrabold">Cách nhận bút chì</h2>
        <ul className="mt-2 grid gap-2 text-sm font-semibold text-slate-600">
          <li>• Nộp bài sớm: nhận số bút chì do giáo viên thiết lập.</li>
          <li>• Chất lượng bài làm: giáo viên có thể thưởng thêm bút chì sau khi xem bài.</li>
          <li>• Task streak: tasks 1–5 earn no streak bonus; 6–20 +1; 21–35 +2; 36–45 +3; 46–50 +4; 51+ +5 pencils per task.</li>
        </ul>
        {data.earlyRules.length ? <p className="mt-2 text-xs font-bold text-slate-500">Current early-submission rules: {data.earlyRules.map((rule) => `sớm ${rule.hours} giờ = +${rule.pencils}`).join(' · ')} pencils.</p> : null}
      </section>
      <details className="rounded-3xl bg-white p-4 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-extrabold">
          <span>Lịch sử bút chì <span className="ml-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{data.recent.length}</span></span>
          <span className="text-sm font-bold text-slate-500">Hiện / ẩn⌄</span>
        </summary>
        <p className="mt-2 text-xs font-semibold text-slate-500">Lịch sử sẽ tự động xóa sau 30 ngày. Tổng số bút chì tích lũy vẫn được giữ nguyên.</p>
        <div className="mt-3 max-h-80 overflow-y-auto pr-1">
          <div className="grid gap-2">
            {data.recent.map((item, index) => (
              <div key={`${item.created_at}-${index}`} className="flex items-start justify-between gap-3 rounded-xl bg-[#f7f9fc] p-3">
                <div><p className="font-extrabold">{sourceLabel[item.source] || item.source}</p><p className="text-xs text-slate-500">{item.note} · {formatStamp(item.created_at)}</p></div>
                <strong className={item.amount < 0 ? 'text-red-600' : 'text-green-700'}>{item.amount > 0 ? '+' : ''}{item.amount} ✏️</strong>
              </div>
            ))}
            {data.recent.length === 0 ? <Empty>Chưa có lịch sử bút chì gần đây. Tổng số bút chì đã nhận vẫn được giữ nguyên.</Empty> : null}
          </div>
        </div>
      </details>
    </div>
  );
}
