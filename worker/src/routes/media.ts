import { Hono } from 'hono';
import type { Env } from '../types';

/** Public, unauthenticated blob serving for profile photos (worker/company
 *  avatars + portfolio galleries) — these are meant to be seen by whoever's
 *  swiping on the other side, no session, so a plain <img src> works. IDs
 *  are opaque autoincrement integers; nothing here is more sensitive than
 *  a normal public avatar URL. */
export const mediaRoutes = new Hono<{ Bindings: Env }>();

// Gallery photos are addressed by an autoincrement row id that's unique
// per upload — the URL itself changes every time, so caching it forever
// is safe and correct.
const GALLERY_CACHE_HEADERS = { 'Cache-Control': 'public, max-age=31536000, immutable' };

// The avatar URL, unlike gallery photos, is NOT unique per upload — it's
// always /media/.../avatar for a given worker/company, re-used every time
// they replace their photo. Caching it (as this used to, for an hour)
// meant a browser or Cloudflare's own edge cache that had already fetched
// it once — including an undecodable HEIC upload from before the
// image-format fix — kept serving those same stale bytes for the next
// hour even after a good re-upload. Never cache it.
const NO_CACHE_HEADERS = { 'Cache-Control': 'no-store' };

/** TEMPORARY — diagnosing why a stored avatar won't render anywhere,
 *  including opened directly outside the app. Reports what's actually in
 *  the row instead of guessing. Remove once that's root-caused. */
function debugInfo(bytes: ArrayBuffer | null, contentType: string | null) {
  if (!bytes) return { present: false };
  const head = new Uint8Array(bytes.slice(0, 16));
  const hex = [...head].map((b) => b.toString(16).padStart(2, '0')).join(' ');
  const ascii = [...head].map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
  return { present: true, byteLength: bytes.byteLength, contentType, first16Hex: hex, first16Ascii: ascii };
}

mediaRoutes.get('/workers/:id/avatar', async (c) => {
  const row = await c.env.DB.prepare('SELECT avatar_data, avatar_content_type FROM workers WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ avatar_data: ArrayBuffer | null; avatar_content_type: string | null }>();
  if (c.req.query('debug') === '1') return c.json(debugInfo(row?.avatar_data ?? null, row?.avatar_content_type ?? null));
  if (!row?.avatar_data) return c.notFound();
  return new Response(row.avatar_data, { headers: { 'Content-Type': row.avatar_content_type ?? 'application/octet-stream', ...NO_CACHE_HEADERS } });
});

mediaRoutes.get('/workers/:id/photos/:photoId', async (c) => {
  const row = await c.env.DB.prepare('SELECT file_data, content_type FROM worker_photos WHERE id = ? AND worker_id = ?')
    .bind(c.req.param('photoId'), c.req.param('id'))
    .first<{ file_data: ArrayBuffer | null; content_type: string | null }>();
  if (!row?.file_data) return c.notFound();
  return new Response(row.file_data, { headers: { 'Content-Type': row.content_type ?? 'application/octet-stream', ...GALLERY_CACHE_HEADERS } });
});

mediaRoutes.get('/companies/:id/avatar', async (c) => {
  const row = await c.env.DB.prepare('SELECT avatar_data, avatar_content_type FROM companies WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ avatar_data: ArrayBuffer | null; avatar_content_type: string | null }>();
  if (!row?.avatar_data) return c.notFound();
  return new Response(row.avatar_data, { headers: { 'Content-Type': row.avatar_content_type ?? 'application/octet-stream', ...NO_CACHE_HEADERS } });
});

mediaRoutes.get('/companies/:id/photos/:photoId', async (c) => {
  const row = await c.env.DB.prepare('SELECT file_data, content_type FROM company_photos WHERE id = ? AND company_id = ?')
    .bind(c.req.param('photoId'), c.req.param('id'))
    .first<{ file_data: ArrayBuffer | null; content_type: string | null }>();
  if (!row?.file_data) return c.notFound();
  return new Response(row.file_data, { headers: { 'Content-Type': row.content_type ?? 'application/octet-stream', ...GALLERY_CACHE_HEADERS } });
});
