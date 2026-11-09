import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, CircleAlert, RefreshCw } from 'lucide-react';
import type { PlayerColor, PlayerToken } from '@mdb/shared';
import { Token } from '../components/Token';

type Tone = 'success' | 'error' | 'incoming' | 'turn';
interface Piece {
  color: PlayerColor;
  token: PlayerToken;
}
interface Toast {
  id: number;
  tone: Tone;
  text: string;
  piece?: Piece;
}

interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
  /** Money coming in, shown in gold with the payer's piece. */
  incoming: (text: string, piece?: Piece) => void;
  /** A new round or my turn. */
  turn: (text: string, piece?: Piece) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((tone: Tone, text: string, piece?: Piece) => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-2), { id, tone, text, piece }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), tone === 'error' ? 5000 : 3200);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (t) => push('success', t),
      error: (t) => push('error', t),
      incoming: (t, p) => push('incoming', t, p),
      turn: (t, p) => push('turn', t, p),
    }),
    [push],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[calc(0.75rem+env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => {
          const gold = t.tone === 'incoming' || t.tone === 'turn';
          const Icon = t.tone === 'error' ? CircleAlert : t.tone === 'turn' ? RefreshCw : Check;
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto flex max-w-sm items-center gap-3 rounded-[1.1rem] py-2 pr-4 pl-2 text-[0.95rem] font-bold ${
                gold
                  ? 'bg-gold text-gold-ink shadow-[0_4px_0_var(--gold-deep),0_12px_28px_rgb(0_0_0/0.25)]'
                  : 'bg-ink text-paper shadow-[0_4px_0_#000,0_12px_28px_rgb(0_0_0/0.25)]'
              }`}
              style={{ animation: 'toast-in 450ms cubic-bezier(0.2, 1.4, 0.4, 1)' }}
            >
              {t.piece ? (
                <Token color={t.piece.color} token={t.piece.token} size={32} />
              ) : (
                <span
                  aria-hidden
                  className={`grid size-8 shrink-0 place-items-center rounded-full ${t.tone === 'error' ? 'bg-loss text-white' : gold ? 'bg-gold-ink text-gold' : 'bg-gain text-white'}`}
                >
                  <Icon className="size-4" strokeWidth={2.6} />
                </span>
              )}
              <span>{t.text}</span>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast outside provider');
  return v;
}
