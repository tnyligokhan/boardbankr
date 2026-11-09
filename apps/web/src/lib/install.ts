import { useEffect, useState } from 'react';
import { storage } from './storage';

/**
 * Installing BoardBankr as an app on the home screen.
 *
 * Chrome, Edge and Samsung Internet offer it themselves through `beforeinstallprompt`; that
 * event can fire on any page, so it is caught as soon as the app loads and kept until the
 * install card asks for it. Safari on iPhone never offers it: there the card explains the
 * Share → Add to Home Screen steps instead.
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export function initInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    // keep the browser's own mini bar away; the card offers it at a better moment
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    notify();
  });
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined));
  }
}

function runningAsApp(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, but has a touch screen
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export type InstallMode = 'prompt' | 'ios' | null;

/** How this browser can install the app right now, if at all, and whether the card was put away. */
export function useInstall() {
  const [, rerender] = useState(0);
  const [hidden, setHidden] = useState(() => storage.get('install') === 'dismissed');

  useEffect(() => {
    const fn = () => rerender((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  let mode: InstallMode = null;
  if (!installed && !runningAsApp()) {
    if (deferred) mode = 'prompt';
    else if (isIos()) mode = 'ios';
  }

  return {
    mode: hidden ? null : mode,
    /** Shows the browser's install dialog; true when the person said yes. */
    install: async (): Promise<boolean> => {
      const e = deferred;
      if (!e) return false;
      deferred = null;
      await e.prompt();
      const { outcome } = await e.userChoice;
      notify();
      return outcome === 'accepted';
    },
    dismiss: () => {
      storage.set('install', 'dismissed');
      setHidden(true);
    },
  };
}
