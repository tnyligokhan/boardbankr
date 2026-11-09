import { useEffect, useState } from 'react';
import { Delete } from 'lucide-react';
import { AMOUNT_MAX, type GameAction, type GameSnapshot, type PlayerView } from '@mdb/shared';
import { FitText } from '../components/FitText';
import { Sheet } from '../components/Sheet';
import { Token } from '../components/Token';
import { Button } from '../components/ui';
import { buzz, ching } from '../lib/fx';
import { compactMoney, formatMoney, quickAmounts } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useToast, type ToastAction } from '../lib/toast';
import type { Result } from '../lib/useGame';
import { BankBadge, ParkingBadge } from './common';

/** Pay someone (a player id, 'bank' or 'parking'; null = not chosen yet), or take money from the bank. */
export type PayMode = { kind: 'pay'; to: string | null } | { kind: 'take' };

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'back'] as const;

export function PaySheet({
  mode,
  game,
  me,
  onClose,
  act,
  undoAction,
}: {
  mode: PayMode | null;
  game: GameSnapshot;
  me: PlayerView;
  onClose: () => void;
  act: (a: GameAction) => Promise<Result>;
  /** Offered on the toast after paying, to take it back. */
  undoAction?: () => ToastAction;
}) {
  const { t, locale, errorText } = useI18n();
  const toast = useToast();
  const [amount, setAmount] = useState(0);
  const [to, setTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode) {
      setAmount(0);
      setTo(mode.kind === 'pay' ? mode.to : null);
      setBusy(false);
    }
  }, [mode]);

  const open = mode !== null;
  const taking = mode?.kind === 'take';
  const others = game.players.filter((p) => p.userId !== me.userId && p.status === 'active');
  const target = others.find((p) => p.userId === to) ?? null;
  const tooMuch = !taking && amount > me.balance;
  const money = (n: number) => formatMoney(n, game.currency, locale);

  const press = (key: (typeof KEYS)[number]) => {
    buzz(6);
    if (key === 'back') return setAmount((v) => Math.floor(v / 10));
    setAmount((v) => {
      const next = Number(`${v === 0 ? '' : v}${key}`);
      return next <= AMOUNT_MAX ? next : v;
    });
  };

  // desktop: type digits straight in
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        setAmount((v) => {
          const next = Number(`${v === 0 ? '' : v}${e.key}`);
          return next <= AMOUNT_MAX ? next : v;
        });
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setAmount((v) => Math.floor(v / 10));
      } else if (e.key === 'Delete') setAmount(0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const toName = (id: string) => (id === 'bank' ? t('theBank') : id === 'parking' ? t('parkingShort') : (others.find((p) => p.userId === id)?.name ?? ''));

  const submit = async () => {
    if (!mode || amount <= 0 || tooMuch) return;
    let action: GameAction;
    if (taking) action = { kind: 'bank_to_player', amount };
    else if (to === 'bank') action = { kind: 'player_to_bank', amount };
    else if (to === 'parking') action = { kind: 'player_to_parking', amount };
    else if (target) action = { kind: 'player_to_player', toUserId: target.userId, amount };
    else return;

    setBusy(true);
    const r = await act(action);
    setBusy(false);
    if (r.ok) {
      buzz(20);
      ching(Boolean(taking));
      toast.success(taking ? t('tookDone', { amount: money(amount) }) : t('paidTo', { name: toName(to!), amount: money(amount) }), undoAction?.());
      onClose();
    } else {
      toast.error(errorText(r.error));
    }
  };

  const ready = amount > 0 && !tooMuch && (taking || Boolean(to));
  const label = taking
    ? t('takeAmount', { amount: money(amount) })
    : !to
      ? t('pickWhoFirst')
      : amount <= 0
        ? t('enterAmount')
        : t('sendTo', { name: toName(to), amount: money(amount) });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={taking ? t('takeFromBank') : t('payWho')}
      footer={
        <Button size="lg" block busy={busy} disabled={!ready} onClick={submit}>
          <span className="truncate">{label}</span>
        </Button>
      }
    >
      <form
        className="flex flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {!taking && (
          <div role="radiogroup" aria-label={t('payWho')} className="-mx-1 flex gap-2 overflow-x-auto px-1 pt-1 pb-2 [scrollbar-width:none]">
            {[...others.map((p) => ({ id: p.userId, name: p.name, p })), { id: 'bank', name: t('theBank'), p: null }, ...(game.freeParkingEnabled ? [{ id: 'parking', name: t('parkingShort'), p: null }] : [])].map((o) => {
              const on = o.id === to;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    buzz(8);
                    setTo(o.id);
                  }}
                  className={`flex h-11 shrink-0 items-center gap-2 rounded-full py-1 pr-4 pl-1.5 text-sm font-bold transition-colors ${
                    on ? 'bg-ink text-paper shadow-[0_2px_0_#000]' : 'bg-card text-ink shadow-[0_0_0_1.5px_var(--line),0_2px_0_var(--line)]'
                  }`}
                >
                  {o.p ? <Token color={o.p.color} token={o.p.token} size={30} /> : o.id === 'bank' ? <BankBadge size={30} /> : <ParkingBadge size={30} />}
                  <span className="max-w-[8rem] truncate">{o.name}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-col items-center pt-3 pb-1">
          <span className="sr-only">{t('amount')}</span>
          <FitText
            className={`w-full text-center font-display text-[clamp(2.6rem,13vw,3.4rem)] leading-[1.1] font-extrabold tabular ${
              amount === 0 ? 'text-line' : tooMuch ? 'text-loss' : 'text-ink'
            }`}
          >
            <output aria-live="polite" key={tooMuch ? 'bad' : 'ok'} style={tooMuch ? { animation: 'shake 300ms' } : undefined}>
              {money(amount)}
            </output>
          </FitText>
          <p className={`mt-1.5 min-h-5 text-center text-sm font-semibold tabular ${tooMuch ? 'text-loss' : 'text-ink-2'}`}>
            {tooMuch
              ? t('notEnough', { balance: money(me.balance) })
              : t('balanceAfter', { from: money(me.balance), to: money(taking ? me.balance + amount : me.balance - amount) })}
          </p>
        </div>

        <div className="mt-4 mb-2.5 grid grid-cols-5 gap-1.5">
          {quickAmounts(game.startingCapital).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                buzz(6);
                setAmount((v) => Math.min(AMOUNT_MAX, v + q));
              }}
              className="h-10 truncate rounded-full bg-gold px-1 font-display text-sm font-semibold text-gold-ink shadow-[0_2px_0_var(--gold-deep)] active:translate-y-0.5 active:shadow-none"
            >
              +{compactMoney(q, game.currency, locale)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((k) =>
            k === 'back' ? (
              <button
                key={k}
                type="button"
                onClick={() => press('back')}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setAmount(0);
                }}
                aria-label={t('backspace')}
                className="flex h-14 items-center justify-center rounded-2xl text-ink-2 hover:bg-sand"
              >
                <Delete aria-hidden className="size-6" />
              </button>
            ) : (
              <button
                key={k}
                type="button"
                onClick={() => press(k)}
                className="h-14 rounded-2xl bg-card font-display text-[1.4rem] font-medium tabular text-ink shadow-[0_0_0_1.5px_var(--line),0_3px_0_var(--line)] active:translate-y-[3px] active:shadow-[0_0_0_1.5px_var(--line)]"
              >
                {k}
              </button>
            ),
          )}
        </div>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
