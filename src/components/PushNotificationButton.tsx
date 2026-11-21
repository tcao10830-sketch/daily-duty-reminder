import { useEffect, useState } from 'react';
import { api } from '../lib/api';

function decodeKey(value: string): Uint8Array {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function PushNotificationButton() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const available = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(available);
    if (!available) return;
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setEnabled(Boolean(subscription)))
      .catch(() => setEnabled(false));
  }, []);

  async function toggle() {
    if (!supported || busy) return;
    const isAppleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isAppleMobile && !standalone) {
      window.alert('Trên iPhone/iPad, hãy thêm Daily Duty Reminder vào Màn hình chính bằng Safari, mở ứng dụng từ biểu tượng đó rồi bật thông báo nhé.');
      return;
    }
    setBusy(true);
    try {
      if (enabled) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await api('/api/push/unsubscribe', {
            method: 'POST',
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
          await subscription.unsubscribe();
        }
        setEnabled(false);
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        window.alert('Bạn chưa cấp quyền thông báo. Có thể bật lại trong cài đặt trình duyệt hoặc thiết bị.');
        return;
      }
      const config = await api<{ enabled: boolean; publicKey: string }>('/api/push/public-key');
      if (!config.enabled || !config.publicKey) {
        window.alert('Tính năng thông báo đẩy chưa được cấu hình trên máy chủ. Vui lòng thử lại sau.');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeKey(config.publicKey) as BufferSource,
        });
      }
      await api('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      setEnabled(true);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Không thể bật thông báo lúc này. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-extrabold shadow-sm disabled:opacity-60 ${enabled ? 'bg-[#DDF8E9] text-[#24764B]' : 'bg-white/90 text-[#40516b]'}`}
      aria-label={enabled ? 'Tắt thông báo trên thiết bị này' : 'Bật thông báo trên thiết bị này'}
    >
      <span aria-hidden="true">{enabled ? '🔔' : '♧'}</span>
      <span>{busy ? 'Đang xử lý…' : enabled ? 'Đã bật thông báo' : 'Bật thông báo'}</span>
    </button>
  );
}
