import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Check, SlidersHorizontal } from 'lucide-react';
import { AMOUNT_MAX, CURRENCIES, EDITION_PRESETS, type Currency, type GameSnapshot } from '@mdb/shared';
import { FitText } from '../components/FitText';
import { Button, Segmented, Toggle } from '../components/ui';
import { ApiError, api } from '../lib/api';
import { formatMoney } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useToast } from '../lib/toast';

type Edition = 'classic' | 'electronic' | 'custom';

const EDITIONS: Record<Exclude<Edition, 'custom'>, { capital: number; salary: number }> = EDITION_PRESETS;

/** Three paper notes fanned out: the classic box. */
function NotesArt() {
  return (
    <span aria-hidden className="relative block h-13 w-16 shrink-0">
      {(['peach', 'sun', 'mint'] as const).map((c, i) => (
        <span
          key={c}
          data-note={c}
          className="absolute left-1 h-[1.9rem] w-[3.4rem] rounded-[5px] bg-[var(--note)] shadow-[inset_0_0_0_2px_rgb(255_255_255/0.5),0_2px_0_rgb(0_0_0/0.15)]"
          style={{ top: 2 + i * 9, transform: `rotate(${[-8, 3, -2][i]}deg)` }}
        >
          <span className="absolute inset-x-[18px] inset-y-[7px] rounded-full border-2 border-white/60" />
        </span>
      ))}
    </span>
  );
}

/** A bank card: the electronic banking box. */
function CardArt() {
  return (
    <span aria-hidden className="relative block h-13 w-16 shrink-0">
      <span className="absolute inset-x-1 inset-y-2 rounded-[7px] bg-gradient-to-br from-[#2a3530] to-[#0f1713] shadow-[0_3px_0_rgb(0_0_0/0.25)]">
        <span className="absolute top-2.5 left-2 h-2.5 w-3.5 rounded-[2px] bg-gold" />
        <span className="absolute bottom-[7px] left-2 h-[3px] w-8 rounded-sm bg-white/40" />
      </span>
    </span>
  );
}

function EditionBox({ selected, onSelect, art, title, children }: { selected: boolean; onSelect: () => void; art: ReactNode; title: string; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex items-center gap-4 rounded-[1.25rem] bg-card p-4 text-left transition-[transform,box-shadow] hover:-translate-y-px ${
        selected ? 'shadow-[0_0_0_3px_var(--ink),0_4px_0_var(--ink)]' : 'shadow-[0_0_0_1.5px_var(--line),0_3px_0_var(--line)]'
      }`}
    >
      {art}
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[1.05rem] font-bold">{title}</span>
        <span className="mt-0.5 block text-sm text-ink-2 tabular">{children}</span>
      </span>
      <span
        aria-hidden
        className={`grid size-[26px] shrink-0 place-items-center rounded-full ${selected ? 'bg-ink text-paper' : 'shadow-[inset_0_0_0_2px_var(--line)]'}`}
      >
        {selected && <Check className="size-3.5" strokeWidth={3} />}
      </span>
    </button>
  );
}

function AmountInput({ id, label, value, onChange, currency, hint }: { id: string; label: string; value: number; onChange: (n: number) => void; currency: Currency; hint?: string }) {
  const { locale } = useI18n();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold text-ink-2">
        {label}
      </label>
      <div className="flex h-13 items-center rounded-2xl bg-card shadow-[0_0_0_1.5px_var(--line)] focus-within:shadow-[0_0_0_2.5px_var(--ink)]">
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          value={value === 0 ? '' : value.toLocaleString(locale)}
          placeholder="0"
          onChange={(e) => onChange(Math.min(AMOUNT_MAX, Number(e.target.value.replace(/\D/g, '')) || 0))}
          className="h-full min-w-0 flex-1 bg-transparent pl-4 font-display text-lg font-bold tabular text-ink placeholder:text-ink-3 focus:outline-none"
        />
        <span aria-hidden className="pr-4 font-display text-lg font-bold text-ink-3">
          {currency}
        </span>
      </div>
      {hint && <p className="text-sm text-ink-3">{hint}</p>}
    </div>
  );
}

export default function NewGame() {
  const { t, lang, locale, errorText } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // links from the game guides pick an edition; "play again" brings the last game's settings
  const [initial] = useState(() => {
    const capital = Number(params.get('capital')) || 0;
    const salary = Number(params.get('salary') ?? -1);
    const known = (Object.keys(EDITIONS) as (keyof typeof EDITIONS)[]).find(
      (k) => EDITIONS[k].capital === capital && EDITIONS[k].salary === salary,
    );
    const fromLink = params.get('edition');
    const edition: Edition =
      capital > 0 ? (known ?? 'custom') : fromLink === 'electronic' || fromLink === 'custom' ? fromLink : 'classic';
    const cur = params.get('currency');
    return {
      edition,
      custom: capital > 0 ? { capital, salary: Math.max(0, salary) } : { capital: 1500, salary: 200 },
      currency: (CURRENCIES as readonly string[]).includes(cur ?? '') ? (cur as Currency) : lang === 'tr' ? '₺' : '$',
      parking: params.get('parking') === '1',
      turns: params.get('turns') !== '0',
    };
  });
  const [edition, setEdition] = useState<Edition>(initial.edition);
  const [currency, setCurrency] = useState<Currency>(initial.currency);
  const [custom, setCustom] = useState(initial.custom);
  const [parking, setParking] = useState(initial.parking);
  const [turns, setTurns] = useState(initial.turns);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = `${t('createTitle')} · BoardBankr`;
  }, [t]);

  const preset = edition === 'custom' ? null : EDITIONS[edition];
  const capital = preset?.capital ?? custom.capital;
  const salary = preset?.salary ?? custom.salary;
  const valid = capital >= 1;
  const money = (n: number) => formatMoney(n, currency, locale);

  const create = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const res = await api<{ game: GameSnapshot }>('/api/games', {
        method: 'POST',
        body: { startingCapital: capital, salary, freeParkingEnabled: parking, currency, turnsEnabled: turns },
      });
      navigate(`/g/${res.game.code}`, { replace: true });
    } catch (err) {
      toast.error(errorText(err instanceof ApiError ? err.code : 'internal'));
      setBusy(false);
    }
  };

  const rules = [salary > 0 ? t('salaryChip', { amount: money(salary) }) : t('noSalaryChip'), parking ? t('parkingOn') : t('parkingOff'), turns ? t('turnsOn') : t('turnsOff')];

  return (
    <div className="min-h-dvh">
      <div className="felt">
        <div className="mx-auto max-w-2xl px-4 pt-safe sm:px-6">
          <div className="-ml-2.5 flex h-16 items-center gap-1.5">
            <Link to="/app" aria-label={t('back')} className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-white/10">
              <ArrowLeft aria-hidden className="size-5" />
            </Link>
            <span className="font-display font-semibold">{t('createTitle')}</span>
          </div>
          <div className="pt-1 pb-8">
            <h1 className="font-display text-[clamp(1.9rem,6vw,2.5rem)] leading-tight font-extrabold">{t('editionLabel')}</h1>
            <p className="mt-1.5 text-white/75">{t('newGameLead')}</p>
          </div>
        </div>
      </div>

      <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 pt-7 pb-40 sm:px-6">
        <section className="flex flex-col gap-3">
          <div role="radiogroup" aria-label={t('editionLabel')} className="flex flex-col gap-3">
            <EditionBox selected={edition === 'classic'} onSelect={() => setEdition('classic')} art={<NotesArt />} title={t('editionClassic')}>
              {t('editionLine', { capital: money(EDITIONS.classic.capital), salary: money(EDITIONS.classic.salary) })}
            </EditionBox>
            <EditionBox selected={edition === 'electronic'} onSelect={() => setEdition('electronic')} art={<CardArt />} title={t('editionElectronic')}>
              {t('editionLine', { capital: money(EDITIONS.electronic.capital), salary: money(EDITIONS.electronic.salary) })}
            </EditionBox>
            <EditionBox
              selected={edition === 'custom'}
              onSelect={() => setEdition('custom')}
              art={
                <span aria-hidden className="grid h-13 w-16 shrink-0 place-items-center rounded-xl bg-sand text-ink-2">
                  <SlidersHorizontal className="size-5" />
                </span>
              }
              title={t('editionCustom')}
            >
              {t('editionCustomNote')}
            </EditionBox>
          </div>
          {edition === 'custom' && (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 pt-1 sm:grid-cols-2" style={{ animation: 'pop-in 220ms cubic-bezier(0.2, 1.2, 0.4, 1)' }}>
              <AmountInput id="capital" label={t('startingCapital')} value={custom.capital} currency={currency} onChange={(n) => setCustom((c) => ({ ...c, capital: n }))} />
              <AmountInput
                id="salary"
                label={t('salaryShort')}
                hint={t('salaryHint')}
                value={custom.salary}
                currency={currency}
                onChange={(n) => setCustom((c) => ({ ...c, salary: n }))}
              />
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="eyebrow">{t('currency')}</h2>
          <Segmented label={t('currency')} value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="eyebrow">{t('rulesLabel')}</h2>
          <Toggle checked={parking} onChange={setParking} label={t('freeParking')} description={t('freeParkingNote')} />
          <Toggle checked={turns} onChange={setTurns} label={t('turnsLabel')} description={t('turnsNote')} />
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-felt-deep pt-3.5 pb-safe text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <FitText className="font-display text-xl leading-tight font-extrabold text-gold tabular">{t('everyoneGets', { amount: money(capital) })}</FitText>
            <p className="truncate text-sm text-white/70">{rules.join(' · ')}</p>
          </div>
          <Button size="lg" busy={busy} disabled={!valid} onClick={create}>
            {t('createGame')}
          </Button>
        </div>
      </div>
    </div>
  );
}
