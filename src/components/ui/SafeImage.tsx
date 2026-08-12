import { useEffect, useState, type ImgHTMLAttributes } from 'react';

/** Like a plain <img>, but hides itself instead of showing the browser's
 *  broken-image icon when the src 404s or fails to decode (HEIC uploads
 *  from before the upload-time format check existed are the main source
 *  of these). Use anywhere user-uploaded photos are rendered outside the
 *  Avatar component. */
export function SafeImage({ src, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (failed) return null;
  return <img src={src} onError={() => setFailed(true)} {...props} />;
}
