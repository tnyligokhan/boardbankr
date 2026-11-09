import type { Currency } from '@mdb/shared';

const formatters = new Map<string, Intl.NumberFormat>();

function nf(locale: string): Intl.NumberFormat {
  let f = formatters.get(locale);
  if (!f) formatters.set(locale, (f = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })));
  return f;
}

export function formatNumber(n: number, locale: string): string {
  return nf(locale).format(n);
}

/** ₺ goes after the number (Turkish convention); the others before. */
export function formatMoney(n: number, currency: Currency, locale: string): string {
  const num = formatNumber(Math.abs(n), locale);
  const sign = n < 0 ? '−' : '';
  return currency === '₺' ? `${sign}${num} ₺` : `${sign}${currency}${num}`;
}

const compact = new Map<string, Intl.NumberFormat>();

/** Short form for tight spots like chart axes and quick-amount keys: 1,5 B · 15 Mn. */
export function formatCompact(n: number, locale: string): string {
  let f = compact.get(locale);
  if (!f) compact.set(locale, (f = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 })));
  return f.format(n);
}

export function compactMoney(n: number, currency: Currency, locale: string): string {
  // small amounts read better in full ("3.000 ₺", not "3 B ₺")
  if (Math.abs(n) < 10_000) return formatMoney(n, currency, locale);
  const num = formatCompact(Math.abs(n), locale);
  return currency === '₺' ? `${num} ₺` : `${currency}${num}`;
}

/** Quick-add amounts sized to the game: 10…500 in a 1,500 game, 100 B…5 Mn in a 15 Mn game. */
export function quickAmounts(startingCapital: number): number[] {
  const scale = Math.max(1, startingCapital / 1500);
  return [10, 50, 100, 200, 500].map((q) => {
    const raw = q * scale;
    const unit = 10 ** Math.max(0, Math.floor(Math.log10(raw)) - 1);
    return Math.max(1, Math.round(raw / unit) * unit);
  });
}

export function durationParts(ms: number): { h: number; m: number } {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  return { h: Math.floor(totalMin / 60), m: totalMin % 60 };
}

export function formatTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function initials(name: string): string {
  const letter = [...name.trim()][0] ?? '?';
  return letter.toLocaleUpperCase();
}

export function newClientTxId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID();
    } catch {
      /* insecure context */
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 8)}`;
}
