import { api } from './api';

export type UploadScope =
  | { purpose: 'material'; taskId: string }
  | { purpose: 'submission'; assignmentId: string };

export type UploadedFile = {
  path: string;
  name: string;
  mime: string;
  size: number;
};

/** Ask the authenticated API for a one-file ticket, then send bytes directly to private Supabase Storage. */
export async function uploadFileDirect(file: File, scope: UploadScope): Promise<UploadedFile> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Each file must be 10 MB or smaller.');
  const ticket = await api<{ path: string; uploadUrl: string }>('/api/storage/sign-upload', {
    method: 'POST',
    body: JSON.stringify({
      ...scope,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
    }),
  });

  const response = await fetch(ticket.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
      'x-upsert': 'false',
    },
    body: file,
  });
  if (!response.ok) {
    throw new Error(response.status === 413
      ? 'The storage service rejected this file because it is too large.'
      : 'Could not upload this file to cloud storage.');
  }
  return { path: ticket.path, name: file.name, mime: file.type, size: file.size };
}

/** Legacy helper kept for non-Vercel development workflows. */
export async function fileUploadPayload(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error('Each file must be 10 MB or smaller.');
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      const comma = value.indexOf(',');
      if (comma < 0) reject(new Error('Could not read this file.'));
      else resolve(value.slice(comma + 1));
    };
    reader.onerror = () => reject(new Error('Could not read this file.'));
    reader.readAsDataURL(file);
  });
  return { fileName: file.name, mimeType: file.type, base64 };
}
