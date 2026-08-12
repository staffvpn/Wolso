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
// they replace their photo. Never cache it, so a stale response can never
// mask a fresh re-upload.
const NO_CACHE_HEADERS = { 'Cache-Control': 'no-store' };

/** D1 hands a BLOB column back as a plain `number[]` over the binding it
 *  uses here, not an ArrayBuffer/Uint8Array — feeding that array straight
 *  into `new Response()` silently stringifies it ("255,216,255,...")
 *  instead of sending the actual bytes, which is why every stored photo
 *  came back undecodable no matter what was uploaded. Always convert. */
function toBytes(raw: unknown): Uint8Array | null {
  if (raw == null) return null;
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (Array.isArray(raw)) return new Uint8Array(raw);
  return null;
}

mediaRoutes.get('/workers/:id/avatar', async (c) => {
  const row = await c.env.DB.prepare('SELECT avatar_data, avatar_content_type FROM workers WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ avatar_data: unknown; avatar_content_type: string | null }>();
  const bytes = toBytes(row?.avatar_data);
  if (!bytes) return c.notFound();
  return new Response(bytes, { headers: { 'Content-Type': row!.avatar_content_type ?? 'application/octet-stream', ...NO_CACHE_HEADERS } });
});

mediaRoutes.get('/workers/:id/photos/:photoId', async (c) => {
  const row = await c.env.DB.prepare('SELECT file_data, content_type FROM worker_photos WHERE id = ? AND worker_id = ?')
    .bind(c.req.param('photoId'), c.req.param('id'))
    .first<{ file_data: unknown; content_type: string | null }>();
  const bytes = toBytes(row?.file_data);
  if (!bytes) return c.notFound();
  return new Response(bytes, { headers: { 'Content-Type': row!.content_type ?? 'application/octet-stream', ...GALLERY_CACHE_HEADERS } });
});

mediaRoutes.get('/companies/:id/avatar', async (c) => {
  const row = await c.env.DB.prepare('SELECT avatar_data, avatar_content_type FROM companies WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ avatar_data: unknown; avatar_content_type: string | null }>();
  const bytes = toBytes(row?.avatar_data);
  if (!bytes) return c.notFound();
  return new Response(bytes, { headers: { 'Content-Type': row!.avatar_content_type ?? 'application/octet-stream', ...NO_CACHE_HEADERS } });
});

mediaRoutes.get('/companies/:id/photos/:photoId', async (c) => {
  const row = await c.env.DB.prepare('SELECT file_data, content_type FROM company_photos WHERE id = ? AND company_id = ?')
    .bind(c.req.param('photoId'), c.req.param('id'))
    .first<{ file_data: unknown; content_type: string | null }>();
  const bytes = toBytes(row?.file_data);
  if (!bytes) return c.notFound();
  return new Response(bytes, { headers: { 'Content-Type': row!.content_type ?? 'application/octet-stream', ...GALLERY_CACHE_HEADERS } });
});
