import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from 'react';
import { Crown } from 'lucide-react';
import type { PlayerColor, PlayerToken } from '@mdb/shared';
import { buzz } from '../lib/fx';
import { Token } from './Token';

export interface TableSeat {
  id: string;
  name: string;
  color: PlayerColor;
  token: PlayerToken;
  /** Already formatted; left out in the lobby. */
  balance?: string | null;
  out?: boolean;
  /** Plays the drop-in animation (someone just sat down). */
  arrived?: boolean;
  /** Accessible label when the seat is a button. */
  label?: string;
}

export interface RoundTableHandle {
  /** The piece of a seat, or the bank / pot chip. */
  node: (id: string) => Element | null;
  /** A "+₺200" that rises above a seat. */
  float: (id: string, text: string, negative?: boolean) => void;
}

/** Seat i of n, clockwise from the bottom. */
const angleOf = (i: number, n: number) => 90 + (i * 360) / n;
/**
 * The card table. Seats sit around a wood-rimmed felt top; the centre holds the bank or the game code.
 * The player at the bottom (`meId`) can drag their piece onto another seat, the bank or the pot;
 * any element inside the table marked `data-drop` is a target. With `onTake`, the bank chip can be
 * dragged onto my piece the other way.
 */
export const RoundTable = forwardRef<
  RoundTableHandle,
  {
    seats: (TableSeat | null)[];
    center: ReactNode;
    meId?: string;
    turnId?: string | null;
    crownId?: string | null;
    /** Seats other than mine are buttons. */
    onSeat?: (id: string) => void;
    /** Dragging my piece: id of a seat, or 'bank' / 'parking'. Without it, my piece can't be dragged. */
    onDrop?: (target: string) => void;
    /** Dragging the bank chip onto my piece: take money from the bank. */
    onTake?: () => void;
    /** Tapping my piece without dragging. */
    onTapMe?: () => void;
    className?: string;
    label?: string;
    /** Shown on the coin while dragging. */
    coin?: string;
  }
>(function RoundTable({ seats, center, meId, turnId, crownId, onSeat, onDrop, onTake, onTapMe, className = '', label, coin = '₺' }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const n = seats.length;
  const meSeated = seats.some((s) => s !== null && s.id === meId && !s.out);

  useImperativeHandle(ref, () => ({
    node: (id) => {
      const el = box.current;
      if (!el) return null;
      if (id === 'bank' || id === 'parking') return el.querySelector(`[data-drop="${id}"]`);
      return el.querySelector(`[data-seat="${CSS.escape(id)}"] > .tok`);
    },
    float: (id, text, negative) => {
      const seat = box.current?.querySelector(`[data-seat="${CSS.escape(id)}"]`);
      if (!seat) return;
      const b = document.createElement('span');
      b.className = 'seat-float';
      if (negative) b.dataset.neg = '';
      b.textContent = text;
      b.setAttribute('aria-hidden', 'true');
      seat.append(b);
      setTimeout(() => b.remove(), 1450);
    },
  }));

  // Dragging a coin across the table: my piece onto a seat / the bank / the pot pays,
  // the bank chip onto my piece takes money from the bank.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const mine = meId ? el.querySelector<HTMLElement>(`[data-seat="${CSS.escape(meId)}"] > .tok`) : null;
    const mySeat = mine?.parentElement ?? null;
    const bank = onTake ? el.querySelector<HTMLElement>('[data-drop="bank"]') : null;

    const drag = (
      source: HTMLElement,
      kind: 'pay' | 'take',
      targetAt: (x: number, y: number) => HTMLElement | null,
      onTap: (() => void) | undefined,
      onHit: (target: HTMLElement) => void,
    ) => {
      const down = (e: PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const start = { x: e.clientX, y: e.clientY };
        let moved = false;
        let ghost: HTMLDivElement | null = null;
        let over: HTMLElement | null = null;
        source.setPointerCapture(e.pointerId);
        const move = (ev: PointerEvent) => {
          if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) {
            moved = true;
            ghost = document.createElement('div');
            ghost.className = 'coin';
            ghost.textContent = coin;
            document.body.append(ghost);
            el.dataset.dragging = kind;
            buzz(8);
          }
          if (!moved || !ghost) return;
          ghost.style.transform = `translate(${ev.clientX - 21}px,${ev.clientY - 21}px) scale(1.15)`;
          const target = targetAt(ev.clientX, ev.clientY);
          if (target !== over) {
            if (over) delete over.dataset.over;
            over = target;
            if (over) {
              over.dataset.over = '';
              buzz(10);
            }
          }
        };
        const up = () => {
          source.removeEventListener('pointermove', move);
          source.removeEventListener('pointerup', up);
          source.removeEventListener('pointercancel', up);
          delete el.dataset.dragging;
          ghost?.remove();
          if (over) delete over.dataset.over;
          if (!moved) onTap?.();
          else {
            // a drag is not a tap: swallow the click a button would fire after it
            const swallow = (c: Event) => c.stopPropagation();
            source.addEventListener('click', swallow, { capture: true, once: true });
            setTimeout(() => source.removeEventListener('click', swallow, { capture: true }), 400);
            if (over) onHit(over);
          }
        };
        source.addEventListener('pointermove', move);
        source.addEventListener('pointerup', up);
        source.addEventListener('pointercancel', up);
      };
      source.addEventListener('pointerdown', down);
      return () => source.removeEventListener('pointerdown', down);
    };

    const off: (() => void)[] = [];
    if (mine && onDrop) {
      off.push(
        drag(
          mine,
          'pay',
          (x, y) => {
            const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]');
            return hit && el.contains(hit) ? hit : null;
          },
          onTapMe,
          (t) => onDrop(t.dataset.drop === 'player' ? t.dataset.seat! : t.dataset.drop!),
        ),
      );
    }
    if (bank && mySeat && onTake) {
      off.push(
        drag(
          bank,
          'take',
          (x, y) => (mySeat.contains(document.elementFromPoint(x, y)) ? mySeat : null),
          // a plain tap keeps the button's own click (paying the bank)
          undefined,
          () => onTake(),
        ),
      );
    }
    return () => off.forEach((f) => f());
  }, [meId, meSeated, onDrop, onTapMe, onTake, coin]);

  return (
    <div ref={box} className={`table ${className}`} role="group" aria-label={label} data-take={(onTake && meSeated) || undefined}>
      <div aria-hidden className="table-top" />
      <div className="table-center">{center}</div>
      {seats.map((s, i) => {
        const a = (angleOf(i, n) * Math.PI) / 180;
        const style = { left: `${50 + 41 * Math.cos(a)}%`, top: `${50 + 41 * Math.sin(a)}%` };
        // seats in the upper half carry their name plate above the piece, away from the table
        const plate = Math.sin(a) < -0.01 ? 'above' : 'below';
        if (!s) {
          return (
            <div key={`empty-${i}`} className="seat" data-empty="" data-plate={plate} style={style} aria-hidden>
              <span className="tok">+</span>
              {/* a placeholder name plate, so the empty chair reads like a laid place */}
              <span className="seat-plate">
                <span className="seat-skel" />
              </span>
            </div>
          );
        }
        const isMe = s.id === meId;
        const clickable = !isMe && !s.out && onSeat;
        const content = (
          <>
            {crownId === s.id && (
              <span className="seat-crown" aria-hidden>
                <Crown strokeWidth={1.6} />
              </span>
            )}
            <Token color={s.color} token={s.token} muted={s.out} />
            <span className="seat-plate">
              <span className="seat-name">{s.name}</span>
              {s.balance != null && <span className="seat-balance">{s.balance}</span>}
            </span>
          </>
        );
        const attrs = {
          'data-seat': s.id,
          'data-me': isMe || undefined,
          'data-turn': turnId === s.id || undefined,
          'data-out': s.out || undefined,
          'data-arrived': s.arrived || undefined,
          'data-draggable': (isMe && onDrop && !s.out) || undefined,
          'data-drop': (onDrop && !isMe && !s.out && 'player') || undefined,
          'data-plate': plate,
          style,
        };
        return clickable ? (
          <button key={s.id} type="button" className="seat" aria-label={s.label ?? s.name} onClick={() => onSeat(s.id)} {...attrs}>
            {content}
          </button>
        ) : (
          <div key={s.id} className="seat" aria-label={isMe ? s.label : undefined} {...attrs}>
            {content}
          </div>
        );
      })}
    </div>
  );
});
