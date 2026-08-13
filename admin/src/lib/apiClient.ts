import { useSessionStore } from '@/store/useSessionStore';

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

/** Profile photo endpoints (worker's routes/media.ts) return a relative
 *  path like `/media/workers/12/avatar` — prefix the API origin so it
 *  works as an <img src>. */
export function resolveMediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  const url = `${API_URL ?? ''}${path}`;
  return path.endsWith('/avatar') ? `${url}?v=${Date.now()}` : url;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, code?: string) {
    super(code ?? `http_${status}`);
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (!API_URL) {
    throw new Error('VITE_API_URL is not set — see .env.example. The admin app has nothing to talk to without it.');
  }

  const token = useSessionStore.getState().token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(`${API_URL}${path}`, { method: opts.method ?? 'GET', headers, body });

  if (res.status === 401) {
    useSessionStore.getState().logout();
  }
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (payload as { error?: string }).error);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
