import type { CSSProperties } from 'react';

/** For file inputs triggered via a proxy `.click()` on a styled button.
 *  `display: none` (Tailwind's `hidden`) makes some embedded WebViews —
 *  Telegram's included — silently refuse to open the native file picker
 *  on a programmatic click. Keeping the input in the layout (just
 *  invisible and 1px) is the standard fix. */
export const VISUALLY_HIDDEN_FILE_INPUT: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};
