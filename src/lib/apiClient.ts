import { useAuthStore } from '@/store/useAuthStore';

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

/** Profile photo endpoints (routes/media.ts) are public and return a
 *  relative path like `/media/workers/12/avatar` — an already-absolute
 *  Telegram CDN URL passes through unchanged. */
export function resolveMediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  return `${API_URL ?? ''}${path}`;
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
  /** 'worker' | 'company' — which session token to send. Defaults to 'worker'. */
  as?: 'worker' | 'company';
  /** Send `body` as raw bytes with this content type instead of JSON (file uploads). */
  raw?: { contentType: string };
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (!API_URL) {
    throw new Error('VITE_API_URL is not set — see .env.example. The app has nothing to talk to without it.');
  }

  const token = opts.as === 'company' ? useAuthStore.getState().companyToken : useAuthStore.getState().workerToken;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (opts.raw && opts.body instanceof ArrayBuffer) {
    headers['Content-Type'] = opts.raw.contentType;
    body = opts.body;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(`${API_URL}${path}`, { method: opts.method ?? 'GET', headers, body });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (payload as { error?: string }).error);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
