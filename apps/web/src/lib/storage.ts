/** localStorage that never throws (private mode, blocked storage). Per-device conveniences only. */
const PREFIX = 'mdb:';

export const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(PREFIX + key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(PREFIX + key, value);
    } catch {
      /* ignore */
    }
  },
};
