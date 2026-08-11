import { Hono } from 'hono';
import type { Env } from '../types';
import { attachSession, requireWorker } from '../middleware/auth';

export const profileRoutes = new Hono<{ Bindings: Env; Variables: { session: unknown } }>();
profileRoutes.use('*', attachSession);

profileRoutes.get('/', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  const worker = await c.env.DB.prepare('SELECT * FROM workers WHERE id = ?').bind(session.workerId).first();
  if (!worker) return c.json({ error: 'not_found' }, 404);

  const { results: positions } = await c.env.DB.prepare('SELECT position, position_label, years FROM worker_positions WHERE worker_id = ?')
    .bind(session.workerId)
    .all();
  const { results: documents } = await c.env.DB.prepare('SELECT * FROM worker_documents WHERE worker_id = ?')
    .bind(session.workerId)
    .all();

  const completionFields = [worker.city, positions.length > 0, documents.some((d) => d.status === 'verified')];
  const profileCompletion = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100);

  return c.json({ worker: { ...worker, profileCompletion }, positions, documents });
});

profileRoutes.patch('/', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const body = await c.req.json<{ city?: string; name?: string }>();

  const fields: string[] = [];
  const binds: unknown[] = [];
  if (body.city) {
    fields.push('city = ?');
    binds.push(body.city);
  }
  if (body.name) {
    fields.push('name = ?');
    binds.push(body.name);
  }
  if (fields.length) {
    binds.push(session.workerId);
    await c.env.DB.prepare(`UPDATE workers SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run();
  }
  return c.json({ ok: true });
});

profileRoutes.post('/positions', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const { position, positionLabel, years } = await c.req.json<{ position: string; positionLabel: string; years: number }>();

  await c.env.DB.prepare('INSERT INTO worker_positions (worker_id, position, position_label, years) VALUES (?, ?, ?, ?)')
    .bind(session.workerId, position, positionLabel, years ?? 0)
    .run();
  return c.json({ ok: true });
});

/** Document upload — raw file bytes in the body, doc type in the URL.
 *  Stored directly in D1 (no R2 — that needs a billing subscription even
 *  on the free tier, which not every operator can add), status flips to
 *  'pending' for a human moderator to review. */
profileRoutes.post('/documents/:docType/upload', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const docType = c.req.param('docType');

  const doc = await c.env.DB.prepare('SELECT id FROM worker_documents WHERE worker_id = ? AND doc_type = ?')
    .bind(session.workerId, docType)
    .first<{ id: number }>();
  if (!doc) return c.json({ error: 'unknown_document_type' }, 404);

  const contentType = c.req.header('Content-Type') ?? 'application/octet-stream';
  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength === 0) return c.json({ error: 'empty_upload' }, 400);
  // D1 caps a row at 2MB total — leave headroom for the rest of the row.
  if (bytes.byteLength > 1.5 * 1024 * 1024) return c.json({ error: 'file_too_large' }, 413);

  await c.env.DB.prepare(
    "UPDATE worker_documents SET status = 'pending', file_data = ?, content_type = ?, note = 'На проверке', updated_at = datetime('now') WHERE id = ?",
  )
    .bind(bytes, contentType, doc.id)
    .run();

  return c.json({ ok: true });
});
