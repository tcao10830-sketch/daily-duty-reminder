import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { hcmToday } from '../lib/format';

export function CalendarBoard({ items }: { items: { date: string; title: string; href: string; meta: string }[] }) {
  const today = hcmToday();
  const [cursor, setCursor] = useState(today.slice(0, 7));
  const [year, month] = cursor.split('-').map(Number);
  const cells = useMemo(() => {
    const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const days: { date: string | null }[] = Array.from({ length: first }, () => ({ date: null }));
    for (let day = 1; day <= count; day += 1) {
      days.push({ date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` });
    }
    return days;
  }, [year, month]);

  function shift(delta: number) {
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    setCursor(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`);
  }

  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" className="rounded-full bg-[#eef4ff] px-3 py-1 font-extrabold" onClick={() => shift(-1)}>
          Prev
        </button>
        <h2 className="font-extrabold">
          {new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
        </h2>
        <button type="button" className="rounded-full bg-[#eef4ff] px-3 py-1 font-extrabold" onClick={() => shift(1)}>
          Next
        </button>
      </div>
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-extrabold text-slate-500">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((cell, index) => {
          const notes = cell.date ? items.filter((item) => item.date === cell.date) : [];
          return (
            <div key={cell.date ?? `pad-${index}`} className={`min-h-24 rounded-2xl p-1.5 ${cell.date === today ? 'bg-[#FFF3B0]' : 'bg-[#f7fbff]'}`}>
              <div className="text-xs font-extrabold">{cell.date ? Number(cell.date.slice(8)) : ''}</div>
              <div className="mt-1 space-y-1">
                {notes.slice(0, 3).map((note) => (
                  <Link key={note.href + note.title} to={note.href} className="block truncate rounded-lg bg-white px-1 py-0.5 text-left text-[11px] font-extrabold text-[#315fbf]">
                    {note.title}
                    <span className="block font-bold text-slate-400">{note.meta}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
