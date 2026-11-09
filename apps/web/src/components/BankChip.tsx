import { Landmark } from 'lucide-react';
import { useTilt } from '../lib/useTilt';

/**
 * The gold bank chip in the middle of the table. It leans towards the pointer and
 * catches the light the same way the pieces do (useTilt, .tok-shine). With `onClick`
 * it is a button; `drop` makes it a target for drag-to-pay.
 */
export function BankChip({
  label,
  onClick,
  ariaLabel,
  drop,
}: {
  label: string;
  onClick?: () => void;
  ariaLabel?: string;
  drop?: boolean;
}) {
  const { ref, glint } = useTilt<HTMLButtonElement & HTMLDivElement>();
  const inside = (
    <>
      <Landmark aria-hidden className="size-5" strokeWidth={2.3} />
      {label}
      <span aria-hidden className="tok-shine">
        <span className="tok-foil" />
        <span className="tok-glare" />
        {glint > 0 && <span key={glint} className="tok-glint" />}
      </span>
    </>
  );
  const dropAttr = drop ? { 'data-drop': 'bank' } : {};
  return onClick ? (
    <button ref={ref} type="button" className="bank-chip" onClick={onClick} aria-label={ariaLabel} {...dropAttr}>
      {inside}
    </button>
  ) : (
    <div ref={ref} className="bank-chip" {...dropAttr}>
      {inside}
    </div>
  );
}
