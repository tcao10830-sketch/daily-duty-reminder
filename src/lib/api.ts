const TOKEN_KEY = 'ddr-token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (response.status === 401 && !path.startsWith('/api/auth/')) {
    setToken(null);
    if (!location.pathname.startsWith('/login')) location.assign('/login');
  }
  if (!response.ok) throw new ApiError(response.status, data.error || 'Yêu cầu không thành công.');
  return data as T;
}
