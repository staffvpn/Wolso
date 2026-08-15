/**
 * Verifies Mini App `initData` — this is how we know a request genuinely
 * comes from that Telegram user and not someone spoofing a `user` object.
 * secret = HMAC-SHA256("WebAppData", bot_token)
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

function toHex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(keyBytes: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', keyBytes as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
}

const MAX_AGE_SEC = 24 * 60 * 60;

export async function verifyInitData(initData: string, botToken: string): Promise<TelegramUser | null> {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKeyBuf = await hmacSha256(new TextEncoder().encode('WebAppData'), botToken);
  const sigBuf = await hmacSha256(secretKeyBuf, dataCheckString);
  if (toHex(sigBuf) !== hash) return null;

  const authDate = Number(params.get('auth_date') ?? '0');
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SEC) return null;

  const userJson = params.get('user');
  if (!userJson) return null;
  try {
    return JSON.parse(userJson) as TelegramUser;
  } catch {
    return null;
  }
}
