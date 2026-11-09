import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';

export type ButtonVariant = 'gold' | 'ink' | 'white' | 'paper' | 'glass' | 'danger' | 'quiet';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: Size;
  busy?: boolean;
  block?: boolean;
}

/** Class names for a button, so links can look the same. */
export function buttonClass(variant: ButtonVariant = 'gold', size: Size = 'md', block = false) {
  return `btn btn-${variant} ${size === 'lg' ? 'btn-lg' : size === 'sm' ? 'btn-sm' : ''} ${block ? 'w-full' : ''}`;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'gold', size = 'md', busy, block, className = '', children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${buttonClass(variant, size, block)} ${className}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <LoaderCircle aria-hidden className="size-5 animate-spin" /> : children}
    </button>
  );
});

export function IconButton({
  label,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-black/5 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function TextInput({ className = '', invalid, ...rest }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={`h-13 w-full rounded-2xl bg-card px-4 text-base font-semibold text-ink shadow-[0_0_0_1.5px_var(--line)] placeholder:font-medium placeholder:text-ink-3 focus:shadow-[0_0_0_2.5px_var(--ink)] focus:outline-none aria-invalid:shadow-[0_0_0_2px_var(--loss)] ${className}`}
        {...rest}
      />
    );
  },
);

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-bold text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm font-semibold text-loss">{error}</p>
      ) : hint ? (
        <p className="text-sm text-ink-2">{hint}</p>
      ) : null}
    </div>
  );
}

/** A row of chunky choice keys; the chosen one turns gold. */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`h-13 min-w-14 rounded-2xl px-4 font-display text-lg font-bold transition-[transform,box-shadow] active:translate-y-0.5 ${
              on
                ? 'bg-gold text-gold-ink shadow-[0_0_0_2px_var(--gold-deep),0_3px_0_var(--gold-deep)]'
                : 'bg-card text-ink shadow-[0_0_0_1.5px_var(--line),0_3px_0_var(--line)]'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors ${checked ? 'bg-gain' : 'bg-line'}`}
    >
      <span
        className={`absolute top-[3px] left-[3px] size-6 rounded-full bg-white shadow-[0_2px_0_rgb(0_0_0/0.15)] transition-transform duration-250 ease-[cubic-bezier(0.3,1.5,0.5,1)] ${checked ? 'translate-x-5' : ''}`}
      />
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  flat,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  /** Without the card frame, e.g. inside a menu. */
  flat?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center gap-4 rounded-2xl text-left ${flat ? 'px-3.5 py-3 hover:bg-sand' : 'card px-4 py-4'}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-ink-2">{description}</span>}
      </span>
      <Switch checked={checked} />
    </button>
  );
}

export function Spinner({ label, onFelt }: { label: string; onFelt?: boolean }) {
  return (
    <div role="status" className={`flex flex-col items-center gap-3 py-16 ${onFelt ? 'text-white/70' : 'text-ink-2'}`}>
      <LoaderCircle aria-hidden className="size-7 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
