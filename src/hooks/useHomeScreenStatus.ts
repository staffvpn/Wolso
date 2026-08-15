import { useEffect, useState } from 'react';
import { getTelegram, checkHomeScreenStatus, type HomeScreenStatus } from '@/lib/telegram';

/** Live "is Wolso pinned to the home screen" status, kept in sync with
 *  Telegram's own state — starts with an async check on mount, then
 *  flips to 'added' the moment the user confirms the native prompt, so
 *  the profile screen's install row disappears without a reload. */
export function useHomeScreenStatus(): HomeScreenStatus {
  const [status, setStatus] = useState<HomeScreenStatus>('unsupported');

  useEffect(() => {
    checkHomeScreenStatus(setStatus);

    const tg = getTelegram();
    if (!tg) return;

    const onAdded = () => setStatus('added');
    tg.onEvent('homeScreenAdded', onAdded);
    return () => tg.offEvent('homeScreenAdded', onAdded);
  }, []);

  return status;
}
