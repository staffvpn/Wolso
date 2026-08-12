import { Hono } from 'hono';
import type { Env } from '../types';
import { attachSession, requireWorker } from '../middleware/auth';
import { readUpload, setAvatar, addGalleryPhoto, deleteGalleryPhoto } from '../lib/media';

export const profileRoutes = new Hono<{ Bindings: Env; Variables: { session: unknown } }>();
profileRoutes.use('*', attachSession);

interface WorkerRow {
  id: number;
  name: string;
  city: string;
  bio: string;
  birthdate: string | null;
  skills: string;
  photo_url: string | null;
  avatar_data: ArrayBuffer | null;
}

function ageFrom(birthdate: string | null): number | null {
  if (!birthdate) return null;
  const dob = new Date(birthdate);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

/** Every field on this list must be present for a worker to be able to
 *  browse the feed / apply to shifts — see ProfileGate on the client. */
function isComplete(worker: WorkerRow, hasExperience: boolean) {
  const fields = [
    !!worker.name,
    !!worker.city,
    !!worker.bio,
    !!worker.skills,
    !!worker.birthdate,
    !!(worker.avatar_data || worker.photo_url),
    hasExperience,
  ];
  return { complete: fields.every(Boolean), percent: Math.round((fields.filter(Boolean).length / fields.length) * 100) };
}

async function loadProfile(env: Env, workerId: number) {
  const worker = await env.DB.prepare('SELECT * FROM workers WHERE id = ?').bind(workerId).first<WorkerRow>();
  if (!worker) return null;

  const { results: positions } = await env.DB.prepare('SELECT position, position_label, years FROM worker_positions WHERE worker_id = ?')
    .bind(workerId)
    .all();
  const { results: documents } = await env.DB.prepare('SELECT * FROM worker_documents WHERE worker_id = ?').bind(workerId).all();
  const { results: photoRows } = await env.DB.prepare('SELECT id FROM worker_photos WHERE worker_id = ? ORDER BY position ASC')
    .bind(workerId)
    .all<{ id: number }>();

  const { complete, percent } = isComplete(worker, positions.length > 0);
  const avatarUrl = worker.avatar_data ? `/media/workers/${worker.id}/avatar` : worker.photo_url;

  return {
    worker: {
      ...worker,
      avatar_data: undefined,
      avatarUrl,
      age: ageFrom(worker.birthdate),
      profileComplete: complete,
      profileCompletion: percent,
    },
    positions,
    documents,
    photos: photoRows.map((p) => ({ id: p.id, url: `/media/workers/${workerId}/photos/${p.id}` })),
  };
}

profileRoutes.get('/', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  const profile = await loadProfile(c.env, session.workerId);
  if (!profile) return c.json({ error: 'not_found' }, 404);
  return c.json(profile);
});

profileRoutes.patch('/', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const body = await c.req.json<{
    city?: string;
    name?: string;
    bio?: string;
    birthdate?: string;
    skills?: string;
  }>();

  const fields: string[] = [];
  const binds: unknown[] = [];
  for (const key of ['city', 'name', 'bio', 'birthdate', 'skills'] as const) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      binds.push(body[key]);
    }
  }
  if (fields.length) {
    binds.push(session.workerId);
    await c.env.DB.prepare(`UPDATE workers SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run();
  }

  const profile = await loadProfile(c.env, session.workerId);
  return c.json({ ok: true, ...profile });
});

profileRoutes.post('/positions', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);
  const { position, positionLabel, years } = await c.req.json<{ position: string; positionLabel: string; years: number }>();

  await c.env.DB.prepare('INSERT INTO worker_positions (worker_id, position, position_label, years) VALUES (?, ?, ?, ?)')
    .bind(session.workerId, position, positionLabel, years ?? 0)
    .run();

  const profile = await loadProfile(c.env, session.workerId);
  return c.json({ ok: true, ...profile });
});

/** Avatar upload — same D1-BLOB pattern as documents, but served publicly
 *  (see routes/media.ts) since it needs to show up in an <img> the other
 *  side is swiping through. */
profileRoutes.post('/avatar', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  const contentType = c.req.header('Content-Type') ?? 'application/octet-stream';
  const bytes = await c.req.arrayBuffer();
  const check = readUpload(bytes);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  await setAvatar(c.env, 'workers', session.workerId, bytes, contentType);
  const profile = await loadProfile(c.env, session.workerId);
  return c.json({ ok: true, ...profile });
});

/** Portfolio gallery — up to 6 photos, tap-through on the card the way a
 *  Tinder profile's extra photos work. Optional, not part of the mandatory
 *  profile-completion checklist. */
profileRoutes.post('/photos', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  const contentType = c.req.header('Content-Type') ?? 'application/octet-stream';
  const bytes = await c.req.arrayBuffer();
  const check = readUpload(bytes);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const result = await addGalleryPhoto(c.env, 'worker_photos', 'worker_id', session.workerId, bytes, contentType);
  if (!result.ok) return c.json({ error: result.error }, 400);

  const profile = await loadProfile(c.env, session.workerId);
  return c.json({ ok: true, ...profile });
});

profileRoutes.delete('/photos/:id', async (c) => {
  const session = requireWorker(c as never);
  if (!session) return c.json({ error: 'auth_required' }, 401);

  await deleteGalleryPhoto(c.env, 'worker_photos', 'worker_id', session.workerId, c.req.param('id'));
  const profile = await loadProfile(c.env, session.workerId);
  return c.json({ ok: true, ...profile });
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
  const check = readUpload(bytes);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  await c.env.DB.prepare(
    "UPDATE worker_documents SET status = 'pending', file_data = ?, content_type = ?, note = 'На проверке', updated_at = datetime('now') WHERE id = ?",
  )
    .bind(bytes, contentType, doc.id)
    .run();

  return c.json({ ok: true });
});
