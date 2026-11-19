import { useState } from 'react';
import { Banner, Button, Empty, Loading } from './ui';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useQuery } from '../lib/query';

type Submission = {
  id: string;
  file_name: string;
  files?: { file_name: string; signedUrl: string | null }[];
  signedUrl: string | null;
  link_url: string | null;
  comment: string;
  created_at: string;
  review: { status: 'approved' | 'revision_requested'; feedback: string; created_at: string } | null;
};

export function SubmissionReview({ assignmentId }: { assignmentId: string }) {
  const { data, error, loading } = useQuery<{ submissions: Submission[] }>(`/api/teacher/assignments/${assignmentId}/submissions`);
  const { bump } = useAuth();
  const [feedback, setFeedback] = useState('');
  const [qualityPencils, setQualityPencils] = useState('0');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (loading && !data) return <Loading />;
  if (error) return <Banner tone="error">{error}</Banner>;
  const items = data?.submissions ?? [];

  async function review(submissionId: string, status: 'approved' | 'revision_requested') {
    setBusy(true);
    setMessage('');
    try {
      await api(`/api/teacher/submissions/${submissionId}/review`, {
        method: 'POST',
        body: JSON.stringify({ status, feedback, qualityPencils: status === 'approved' ? Number(qualityPencils) : 0 }),
      });
      setFeedback('');
      setQualityPencils('0');
      setMessage(status === 'approved' ? 'Đã duyệt bài nộp.' : 'Đã yêu cầu chỉnh sửa bài.');
      bump();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể lưu đánh giá.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-[220px] space-y-2">
      {items.length === 0 ? <span className="text-xs font-semibold text-slate-400">Chưa có bài nộp</span> : items.map((item) => (
        <div key={item.id} className="rounded-xl bg-[#f7f9fc] p-2">
          <div className="grid gap-1">
            {(item.files?.length ? item.files : [{ file_name: item.file_name, signedUrl: item.signedUrl }]).map((file, index) => (
              <a key={`${file.file_name}-${index}`} className="break-all text-sm font-extrabold text-[#315fc4] underline" href={file.signedUrl || item.link_url || '#'} target="_blank" rel="noreferrer">
                {file.file_name}
              </a>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</p>
          {item.comment ? <p className="mt-1 text-xs">{item.comment}</p> : null}
          {item.review ? (
            <p className={`mt-1 text-xs font-extrabold ${item.review.status === 'approved' ? 'text-green-700' : 'text-orange-700'}`}>
              {item.review.status === 'approved' ? 'Approved' : 'Revision requested'}{item.review.feedback ? `: ${item.review.feedback}` : ''}
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              <textarea className="w-full rounded-lg border p-2 text-xs" rows={2} placeholder="Nhận xét (không bắt buộc)" value={feedback} onChange={(event) => setFeedback(event.target.value)} />
              <label className="grid gap-1 text-xs font-extrabold text-slate-600">Quality reward (pencils, optional)
                <input className="w-24 rounded-lg border p-2" type="number" min="0" max="100" value={qualityPencils} onChange={(event) => setQualityPencils(event.target.value)} />
              </label>
              <div className="flex flex-wrap gap-1">
                <Button tone="green" disabled={busy} onClick={() => void review(item.id, 'approved')}>Duyệt bài</Button>
                <Button tone="orange" disabled={busy} onClick={() => void review(item.id, 'revision_requested')}>Yêu cầu chỉnh sửa</Button>
              </div>
            </div>
          )}
        </div>
      ))}
      {message ? <p className="text-xs font-bold text-slate-600">{message}</p> : null}
      {items.length > 0 && items.every((item) => item.review?.status === 'approved') ? <Empty>Tất cả bài đã nộp đều được duyệt.</Empty> : null}
    </div>
  );
}
