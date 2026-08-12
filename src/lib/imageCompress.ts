/** The backend caps uploads at 1.5MB (D1 rows top out at 2MB) — a raw
 *  phone photo is routinely 3-10MB, so every upload would fail without
 *  this. Downscales to a sane max dimension and re-encodes as JPEG.
 *  Non-image files (PDFs) pass through untouched. */

/** Formats every browser can already render in a plain <img> — if
 *  compression fails on one of these, the original is still safe to
 *  upload as-is. Anything else (HEIC/HEIF from an iPhone camera roll,
 *  most often) that fails to decode gets rejected instead of silently
 *  uploaded, since it would just show up as a broken-image icon for
 *  whoever's on the other end. */
const WEB_SAFE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export class UnsupportedImageError extends Error {}

export async function compressImageFile(file: File, maxDim = 1440, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    if (WEB_SAFE_TYPES.has(file.type)) return file;
    throw new UnsupportedImageError(
      'Этот формат фото не открывается в приложении (часто так с HEIC на iPhone). Попробуйте другое фото или включите в настройках камеры «Наиболее совместимые» форматы.',
    );
  }

  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) return file;

  // Re-encoding sometimes comes out larger for already-tiny/simple images —
  // keep whichever is smaller.
  if (blob.size >= file.size) return file;

  const name = file.name.replace(/\.\w+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}
