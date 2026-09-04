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

/** Скачивает файл, который отдаёт API. Через fetch, а не через ссылку:
 *  выгрузка требует токен в заголовке, а обычный <a href> его не пошлёт —
 *  сервер ответит 401, и браузер молча скачает файл с ошибкой внутри. */
export async function apiDownload(path: string, fallbackName: string): Promise<void> {
  if (!API_URL) throw new Error('VITE_API_URL is not set');

  const token = useSessionStore.getState().token;
  const res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

  if (res.status === 401) useSessionStore.getState().logout();
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (payload as { error?: string }).error);
  }

  // Имя берём из Content-Disposition — сервер уже проставил туда дату.
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const named = /filename="([^"]+)"/.exec(disposition)?.[1];

  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = named ?? fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
