import { useState } from 'react';

const apps = [
  {
    name: 'Rung Chuông Vàng',
    description: 'Sân chơi trí tuệ – Chinh phục tri thức',
    url: 'https://rung-chuong-vang-2libbx0x9-cao-the-anh.vercel.app/',
    image: '/rung-chuong-vang-poster.jpg',
  },
];

export function StudentAppsPage() {
  const [posterFailed, setPosterFailed] = useState(false);

  return (
    <div className="grid gap-5">
      <section className="rounded-[28px] bg-white/90 px-5 py-6 shadow-sm sm:px-7">
        <span className="inline-flex rounded-full bg-[#e8f1ff] px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[#315fbf]">Khám phá và trải nghiệm</span>
        <h1 className="mt-3 font-display text-3xl font-black text-[#34445e] sm:text-4xl">Ứng dụng</h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate-500 sm:text-base">Tập hợp những ứng dụng học tập và tiện ích được phát triển để đồng hành cùng bạn. Các ứng dụng mới sẽ xuất hiện tại đây.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {apps.map((app) => (
          <a
            key={app.name}
            href={app.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_12px_32px_rgba(54,75,111,.10)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(54,75,111,.16)]"
          >
            <div className="relative overflow-hidden bg-[#092e68]">
              {!posterFailed ? (
                <img
                  src={app.image}
                  alt="Poster Rung Chuông Vàng"
                  className="block h-auto w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                  onError={() => setPosterFailed(true)}
                />
              ) : (
                <div className="grid aspect-[1.28/1] place-items-center bg-gradient-to-br from-[#092e68] via-[#1455a0] to-[#092e68] p-6 text-center text-white">
                  <div>
                    <div className="text-6xl">🔔</div>
                    <p className="mt-3 font-display text-2xl font-black text-[#ffc629]">RUNG CHUÔNG VÀNG</p>
                    <p className="mt-2 text-sm font-bold text-white/85">Sân chơi trí tuệ – Chinh phục tri thức</p>
                  </div>
                </div>
              )}
              <span className="absolute left-3 top-3 rounded-full border border-white/50 bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#315fbf] shadow-sm">Ứng dụng học tập</span>
            </div>
            <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
              <div className="min-w-0">
                <h2 className="font-display text-xl font-black text-[#34445e]">{app.name}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">{app.description}</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#ffd84d] px-4 py-2 text-xs font-black text-[#24304a] shadow-sm transition group-hover:scale-105 sm:text-sm">Mở ứng dụng ↗</span>
            </div>
          </a>
        ))}
      </section>
    </div>
  );
}
