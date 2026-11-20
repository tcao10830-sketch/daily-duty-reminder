import webpush from 'web-push';
import { randomUUID } from 'node:crypto';
import { db, withDb } from './db.ts';

type Subscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

const publicKey = process.env.PUSH_VAPID_PUBLIC_KEY?.trim() || '';
const privateKey = process.env.PUSH_VAPID_PRIVATE_KEY?.trim() || '';
const subject = process.env.PUSH_VAPID_SUBJECT?.trim() || 'mailto:admin@daily-duty-reminder.app';
const pushReady = Boolean(publicKey && privateKey);

if (pushReady) webpush.setVapidDetails(subject, publicKey, privateKey);

export function getPushPublicKey() {
  return { enabled: pushReady, publicKey: pushReady ? publicKey : '' };
}

export async function savePushSubscription(userId: string, raw: unknown) {
  const sub = raw as Subscription;
  if (!sub || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://')
    || !sub.keys || typeof sub.keys.p256dh !== 'string' || typeof sub.keys.auth !== 'string') {
    throw new Error('Thông tin đăng ký thông báo không hợp lệ.');
  }
  return withDb(() => {
    db.prepare(`INSERT INTO push_subscriptions (id, user_id, endpoint, subscription_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id,
        subscription_json = excluded.subscription_json, updated_at = excluded.updated_at`)
      .run(randomUUID(), userId, sub.endpoint, JSON.stringify(sub), new Date().toISOString(), new Date().toISOString());
    return { ok: true };
  });
}

export async function removePushSubscription(userId: string, endpointRaw: unknown) {
  const endpoint = typeof endpointRaw === 'string' ? endpointRaw : '';
  if (!endpoint.startsWith('https://')) return { ok: true };
  return withDb(() => {
    db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').run(userId, endpoint);
    return { ok: true };
  });
}

function studentCopy(type: string, title: string, body: string) {
  switch (type) {
    case 'task_assigned':
      return {
        title: 'Có nhiệm vụ mới!!!',
        body: 'Alo alo, nhà vua Thế Anh vừa ban chiếu chỉ giao nhiệm vụ cho thường dân. Yêu cầu tiếp nhận và hoàn thành ngay và luôn!',
      };
    case 'deadline_24h':
      return {
        title: 'Đã mất dần kiên nhẫn!!!',
        body: 'Tin xấu! Nhà vua Thế Anh đang dần mất kiên nhẫn. Yêu cầu thường dân khẩn trương hoàn thiện nhiệm vụ trước khi quá muộn!',
      };
    case 'deadline_1h':
      return {
        title: 'Nóng rồi đó 🔥',
        body: 'Nhà vua Thế Anh sắp điều quân xuống để truy tìm những kẻ chưa hoàn thành nhiệm vụ. Liệu hồn đấy!',
      };
    case 'task_overdue':
      return {
        title: 'Ôi? Toang thật rồi!',
        body: 'Nhà vua Thế Anh đã tóm được kẻ chưa hoàn thành nhiệm vụ. Hiện đang tiến hành xét xử, chuẩn bị cho buổi gặp mặt kế tiếp!',
      };
    case 'task_approved':
      return {
        title: 'Phản hồi tốt từ nhà vua',
        body: 'Nhà vua đã xem xét bài làm và ban thưởng cho thường dân! Phần thưởng là một tràng pháo tay khích lệ. Còn thuế thì vẫn cứ nộp như thường ><',
      };
    case 'task_revision_requested':
      return {
        title: 'Phản hồi xấu từ nhà vua',
        body: 'Nhà vua nổi giận trước sự tắc trách của thường dân. Yêu cầu nộp gấp đôi thuế và khẩn trương chỉnh sửa, làm lại bài theo chỉ thị!',
      };
    default:
      return { title, body };
  }
}

export async function sendPushNotification(userId: string, type: string, title: string, body: string, entityId: string) {
  if (!pushReady) return;
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as { role: string } | undefined;
  if (!user) return;
  const copy = user.role === 'student' ? studentCopy(type, title, body) : { title, body };
  const subscriptions = db.prepare('SELECT id, endpoint, subscription_json FROM push_subscriptions WHERE user_id = ?').all(userId) as {
    id: string; endpoint: string; subscription_json: string;
  }[];
  await Promise.all(subscriptions.map(async (row) => {
    try {
      await webpush.sendNotification(JSON.parse(row.subscription_json), JSON.stringify({
        title: copy.title,
        body: copy.body,
        url: user.role === 'teacher' ? '/teacher/notifications' : '/student/notifications',
        tag: `ddr-${type}-${entityId}`,
      }));
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(row.id);
      } else {
        console.error('Push delivery failed:', status || error);
      }
    }
  }));
}
