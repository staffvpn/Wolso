import type { Env } from '../types';

export const MAX_UPLOAD_BYTES = 1.5 * 1024 * 1024; // D1 rows cap at 2MB — leave headroom.
export const MAX_GALLERY_PHOTOS = 6;

export function readUpload(bytes: ArrayBuffer): { ok: true } | { ok: false; error: string; status: 400 | 413 } {
  if (bytes.byteLength === 0) return { ok: false, error: 'empty_upload', status: 400 };
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return { ok: false, error: 'file_too_large', status: 413 };
  return { ok: true };
}

/** Shared body for the worker-avatar / company-avatar upload routes —
 *  both are single BLOB columns on the owner's own row. */
export async function setAvatar(env: Env, table: 'workers' | 'companies', id: number, bytes: ArrayBuffer, contentType: string) {
  await env.DB.prepare(`UPDATE ${table} SET avatar_data = ?, avatar_content_type = ? WHERE id = ?`).bind(bytes, contentType, id).run();
}

/** Shared body for the worker_photos / company_photos gallery routes. */
export async function addGalleryPhoto(
  env: Env,
  table: 'worker_photos' | 'company_photos',
  ownerCol: 'worker_id' | 'company_id',
  ownerId: number,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const count = await env.DB.prepare(`SELECT COUNT(*) as n FROM ${table} WHERE ${ownerCol} = ?`).bind(ownerId).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_GALLERY_PHOTOS) return { ok: false, error: 'too_many_photos' };

  const inserted = await env.DB.prepare(
    `INSERT INTO ${table} (${ownerCol}, file_data, content_type, position) VALUES (?, ?, ?, ?) RETURNING id`,
  )
    .bind(ownerId, bytes, contentType, count?.n ?? 0)
    .first<{ id: number }>();
  return { ok: true, id: inserted!.id };
}

export async function deleteGalleryPhoto(
  env: Env,
  table: 'worker_photos' | 'company_photos',
  ownerCol: 'worker_id' | 'company_id',
  ownerId: number,
  photoId: string,
) {
  await env.DB.prepare(`DELETE FROM ${table} WHERE id = ? AND ${ownerCol} = ?`).bind(photoId, ownerId).run();
}
