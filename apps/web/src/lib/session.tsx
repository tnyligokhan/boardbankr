import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Me } from '@mdb/shared';
import { api } from './api';

interface Session {
  user: Me | null;
  loading: boolean;
  googleEnabled: boolean;
  setUser: (user: Me | null) => void;
  signInAsGuest: (name: string) => Promise<void>;
  rename: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
  googleUrl: (next?: string) => string;
}

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([api<{ user: Me | null }>('/api/me'), api<{ google: boolean }>('/api/config')]).then(
      ([me, cfg]) => {
        if (cancelled) return;
        if (me.status === 'fulfilled') setUser(me.value.user);
        if (cfg.status === 'fulfilled') setGoogleEnabled(cfg.value.google);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const signInAsGuest = useCallback(async (name: string) => {
    const res = await api<{ user: Me }>('/api/auth/guest', { method: 'POST', body: { name } });
    setUser(res.user);
  }, []);

  const rename = useCallback(async (name: string) => {
    const res = await api<{ user: Me }>('/api/me', { method: 'PATCH', body: { name } });
    setUser(res.user);
  }, []);

  const signOut = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST', body: {} });
    setUser(null);
  }, []);

  const value = useMemo<Session>(
    () => ({
      user,
      loading,
      googleEnabled,
      setUser,
      signInAsGuest,
      rename,
      signOut,
      googleUrl: (next = '/app') => `/api/auth/google?next=${encodeURIComponent(next)}`,
    }),
    [user, loading, googleEnabled, signInAsGuest, rename, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside provider');
  return v;
}
