/** The backend caps uploads at 1.5MB (D1 rows top out at 2MB) — a raw
 *  phone photo is routinely 3-10MB, so every upload would fail without
 *  this. Downscales to a sane max dimension and re-encodes as JPEG.
 *  Non-image files (PDFs) pass through untouched. */
export async function compressImageFile(file: File, maxDim = 1440, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

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
