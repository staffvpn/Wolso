import { getInitData } from './telegram';

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

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
    throw new Error('VITE_API_URL is not set — see .env.example. The app has nothing to talk to without it.');
  }

  const headers: Record<string, string> = { 'X-Init-Data': getInitData() };
  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
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
