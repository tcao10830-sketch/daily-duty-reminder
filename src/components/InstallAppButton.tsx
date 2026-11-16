import { useEffect, useState } from 'react';

type InstallChoice = { outcome: 'accepted' | 'dismissed'; platform: string };
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (installed) return;
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
      setInstallPrompt(null);
      return;
    }
    const isAppleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const message = isAppleMobile
      ? 'Để cài ứng dụng: nhấn nút Chia sẻ trên Safari, chọn “Thêm vào màn hình chính”, sau đó nhấn “Thêm”.'
      : 'Để cài ứng dụng: mở menu ⋮ của trình duyệt và chọn “Cài đặt ứng dụng” hoặc “Tạo lối tắt”.';
    window.alert(message);
  }

  return (
    <button
      type="button"
      onClick={() => void install()}
      disabled={installed}
      className="inline-flex items-center gap-2 rounded-full bg-[#FFF3B0] px-3 py-2 text-xs font-extrabold text-[#80551d] shadow-sm hover:-translate-y-0.5 disabled:cursor-default disabled:opacity-75"
      aria-label={installed ? 'Ứng dụng đã được cài đặt' : 'Cài ứng dụng lên thiết bị'}
    >
      <span aria-hidden="true">⇩</span>
      <span>{installed ? 'Đã cài ứng dụng' : 'Cài ứng dụng'}</span>
    </button>
  );
}
