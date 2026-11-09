import { Anchor, Bird, Car, Cat, Crown, Dog, Gem, Ghost, Plane, Rocket, Sailboat, Zap, type LucideIcon } from 'lucide-react';
import type { PlayerColor, PlayerToken } from '@mdb/shared';
import { useTilt } from '../lib/useTilt';

export const TOKEN_ICONS: Record<PlayerToken, LucideIcon> = {
  rocket: Rocket,
  car: Car,
  sailboat: Sailboat,
  cat: Cat,
  dog: Dog,
  crown: Crown,
  gem: Gem,
  plane: Plane,
  ghost: Ghost,
  anchor: Anchor,
  bird: Bird,
  zap: Zap,
};

/** A player's game piece: their colour with their chosen icon. */
export function Token({
  color,
  token,
  size,
  muted,
  className = '',
}: {
  color: PlayerColor;
  token: PlayerToken;
  /** In px. Leave out inside a table seat, where the seat sets the size. */
  size?: number;
  muted?: boolean;
  className?: string;
}) {
  const Icon = TOKEN_ICONS[token] ?? Rocket;
  const { ref, glint } = useTilt<HTMLSpanElement>(!muted);
  return (
    <span
      ref={ref}
      aria-hidden
      data-note={color}
      data-muted={muted || undefined}
      className={`tok ${className}`}
      style={size ? { width: size, height: size } : undefined}
    >
      <Icon strokeWidth={size && size < 30 ? 2.6 : 2.3} />
      {!muted && (
        <span className="tok-shine">
          <span className="tok-foil" />
          <span className="tok-glare" />
          {glint > 0 && <span key={glint} className="tok-glint" />}
        </span>
      )}
    </span>
  );
}
