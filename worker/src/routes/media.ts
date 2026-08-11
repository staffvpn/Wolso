import { Hono } from 'hono';
import type { Env } from '../types';

/** Public, unauthenticated blob serving for profile photos (worker/company
 *  avatars + portfolio galleries). Unlike worker_documents, these are meant
 *  to be seen by whoever's swiping on the other side — no session, so a
 *  plain <img src> works. IDs are opaque autoincrement integers; nothing
 *  here is more sensitive than a normal public avatar URL. */
export const mediaRoutes = new Hono<{ Bindings: Env }>();

const CACHE_HEADERS = { 'Cache-Control': 'public, max-age=3600' };

mediaRoutes.get('/workers/:id/avatar', async (c) => {
  const row = await c.env.DB.prepare('SELECT avatar_data, avatar_content_type FROM workers WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ avatar_data: ArrayBuffer | null; avatar_content_type: string | null }>();
  if (!row?.avatar_data) return c.notFound();
  return new Response(row.avatar_data, { headers: { 'Content-Type': row.avatar_content_type ?? 'application/octet-stream', ...CACHE_HEADERS } });
});

mediaRoutes.get('/workers/:id/photos/:photoId', async (c) => {
  const row = await c.env.DB.prepare('SELECT file_data, content_type FROM worker_photos WHERE id = ? AND worker_id = ?')
    .bind(c.req.param('photoId'), c.req.param('id'))
    .first<{ file_data: ArrayBuffer | null; content_type: string | null }>();
  if (!row?.file_data) return c.notFound();
  return new Response(row.file_data, { headers: { 'Content-Type': row.content_type ?? 'application/octet-stream', ...CACHE_HEADERS } });
});

mediaRoutes.get('/companies/:id/avatar', async (c) => {
  const row = await c.env.DB.prepare('SELECT avatar_data, avatar_content_type FROM companies WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ avatar_data: ArrayBuffer | null; avatar_content_type: string | null }>();
  if (!row?.avatar_data) return c.notFound();
  return new Response(row.avatar_data, { headers: { 'Content-Type': row.avatar_content_type ?? 'application/octet-stream', ...CACHE_HEADERS } });
});

mediaRoutes.get('/companies/:id/photos/:photoId', async (c) => {
  const row = await c.env.DB.prepare('SELECT file_data, content_type FROM company_photos WHERE id = ? AND company_id = ?')
    .bind(c.req.param('photoId'), c.req.param('id'))
    .first<{ file_data: ArrayBuffer | null; content_type: string | null }>();
  if (!row?.file_data) return c.notFound();
  return new Response(row.file_data, { headers: { 'Content-Type': row.content_type ?? 'application/octet-stream', ...CACHE_HEADERS } });
});
