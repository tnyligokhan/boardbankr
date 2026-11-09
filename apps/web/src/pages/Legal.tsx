import { LEGAL } from '@mdb/shared';
import { SiteFooter, SiteHeader, useSeo } from '../components/Site';
import { useI18n } from '../lib/i18n';

/** /yasal and /en/legal — trademarks, play money, data and cookies, limits of responsibility. */
export default function Legal() {
  const { lang } = useI18n();
  const text = LEGAL[lang];
  useSeo(`${text.title} | BoardBankr`, text.description);
  return (
    <div className="min-h-dvh overflow-x-clip">
      <div className="felt">
        <SiteHeader />
        <section className="mx-auto max-w-3xl px-4 pt-4 pb-12 sm:px-6 lg:pt-10 lg:pb-14">
          <h1 className="font-display text-[clamp(2.1rem,6.5vw,3.25rem)] leading-[1.05] font-extrabold tracking-[-0.02em]">{text.title}</h1>
          <p className="mt-4 max-w-[62ch] text-lg leading-relaxed text-white/80">{text.lead}</p>
        </section>
      </div>
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 pt-10 pb-20 sm:px-6">
        {text.sections.map((s, i) => (
          <section key={s.title} className="card px-6 py-5 sm:px-7">
            <h2 className="flex items-baseline gap-3 font-display text-xl font-bold">
              <span className="font-display text-sm font-bold text-ink-3 tabular">{String(i + 1).padStart(2, '0')}</span>
              {s.title}
            </h2>
            <div className="mt-3 flex flex-col gap-3 leading-relaxed text-ink-2">
              {s.body.map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
            </div>
          </section>
        ))}
        <p className="text-sm text-ink-3">{text.updated}</p>
      </main>
      <SiteFooter />
    </div>
  );
}
