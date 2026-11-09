import { useEffect, useState } from 'react';
import { storage } from './storage';

export const wakeLockSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

/** Keeps the screen on while `active`, re-acquiring after the tab comes back. */
export function useWakeLock(active: boolean) {
  const [enabled, setEnabledState] = useState(() => storage.get('wakeLock') !== 'off');

  const setEnabled = (on: boolean) => {
    storage.set('wakeLock', on ? 'on' : 'off');
    setEnabledState(on);
  };

  useEffect(() => {
    if (!wakeLockSupported || !active || !enabled) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
      try {
        const s = await navigator.wakeLock.request('screen');
        if (cancelled) void s.release();
        else sentinel = s;
      } catch {
        /* battery saver or not allowed */
      }
    };

    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      void sentinel?.release();
    };
  }, [active, enabled]);

  return { supported: wakeLockSupported, enabled, setEnabled };
}
