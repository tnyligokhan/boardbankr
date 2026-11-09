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
 * any element inside the table marked `data-drop` is a target.
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
    /** Tapping my piece without dragging. */
    onTapMe?: () => void;
    className?: string;
    label?: string;
    /** Shown on the coin while dragging. */
    coin?: string;
  }
>(function RoundTable({ seats, center, meId, turnId, crownId, onSeat, onDrop, onTapMe, className = '', label, coin = '₺' }, ref) {
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

  // dragging my piece to someone
  useEffect(() => {
    const el = box.current;
    const mine = meId ? el?.querySelector<HTMLElement>(`[data-seat="${CSS.escape(meId)}"] > .tok`) : null;
    if (!el || !mine || !onDrop) return;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const start = { x: e.clientX, y: e.clientY };
      let moved = false;
      let ghost: HTMLDivElement | null = null;
      let over: HTMLElement | null = null;
      mine.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) {
          moved = true;
          ghost = document.createElement('div');
          ghost.className = 'coin';
          ghost.textContent = coin;
          document.body.append(ghost);
          el.dataset.dragging = '';
          buzz(8);
        }
        if (!moved || !ghost) return;
        ghost.style.transform = `translate(${ev.clientX - 21}px,${ev.clientY - 21}px) scale(1.15)`;
        const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-drop]');
        const target = hit && el.contains(hit) ? hit : null;
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
        mine.removeEventListener('pointermove', move);
        mine.removeEventListener('pointerup', up);
        mine.removeEventListener('pointercancel', up);
        delete el.dataset.dragging;
        ghost?.remove();
        if (over) delete over.dataset.over;
        if (!moved) onTapMe?.();
        else if (over) onDrop(over.dataset.drop === 'player' ? over.dataset.seat! : over.dataset.drop!);
      };
      mine.addEventListener('pointermove', move);
      mine.addEventListener('pointerup', up);
      mine.addEventListener('pointercancel', up);
    };
    mine.addEventListener('pointerdown', down);
    return () => mine.removeEventListener('pointerdown', down);
  }, [meId, meSeated, onDrop, onTapMe, coin]);

  return (
    <div ref={box} className={`table ${className}`} role="group" aria-label={label}>
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
