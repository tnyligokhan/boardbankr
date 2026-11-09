import { Link } from 'react-router';
import { Logo } from '../components/Logo';
import { Token } from '../components/Token';
import { buttonClass } from '../components/ui';
import { useI18n } from '../lib/i18n';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <main className="felt flex min-h-dvh flex-col px-4 pt-safe">
      <div className="mx-auto w-full max-w-md py-4">
        <Logo />
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 pb-24">
        <Token color="lilac" token="ghost" size={64} />
        <h1 className="font-display text-3xl font-extrabold">{t('notFoundTitle')}</h1>
        <p className="text-white/75">{t('notFoundBody')}</p>
        <Link to="/" className={`${buttonClass('gold')} mt-2 w-fit`}>
          {t('backHome')}
        </Link>
      </div>
    </main>
  );
}
