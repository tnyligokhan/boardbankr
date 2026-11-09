import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { NAME_MAX, NAME_MIN } from '@mdb/shared';
import { LangSwitch, Logo } from '../components/Logo';
import { Button, Field, TextInput } from '../components/ui';
import { ApiError } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';

function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/app';
}

export function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="size-5 shrink-0">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function Login() {
  const { t, errorText } = useI18n();
  const { user, loading, googleEnabled, googleUrl, signInAsGuest } = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));
  const joiningCode = next.match(/^\/g\/([A-Z0-9]{5})$/i)?.[1]?.toUpperCase();

  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get('error') === 'google' ? t('googleFailed') : null);

  useEffect(() => {
    document.title = `${t('loginTitle')} · BoardBankr`;
  }, [t]);

  if (!loading && user) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim().replace(/\s+/g, ' ');
    if (clean.length < NAME_MIN || clean.length > NAME_MAX) {
      setError(t('nameInvalid'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInAsGuest(clean);
      navigate(next, { replace: true });
    } catch (err) {
      setError(errorText(err instanceof ApiError ? err.code : 'internal'));
      setBusy(false);
    }
  };

  return (
    <div className="felt flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-safe sm:px-6">
        <div className="py-4">
          <Logo />
        </div>
        <LangSwitch />
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pt-4 pb-16">
        <h1 className="font-display text-[clamp(2rem,7vw,2.6rem)] leading-tight font-extrabold">{t('loginTitle')}</h1>
        {joiningCode && (
          <p className="mt-3 rounded-2xl bg-gold px-4 py-3 font-bold text-gold-ink">{t('loginJoining', { code: joiningCode })}</p>
        )}

        <div className="card mt-6 p-5 text-ink sm:p-6">
          {googleEnabled && (
            <>
              <a href={googleUrl(next)} className="btn btn-paper btn-lg w-full">
                <GoogleMark />
                {t('loginGoogle')}
              </a>
              <p className="mt-2.5 text-sm text-ink-2">{t('loginGoogleNote')}</p>
              <div className="my-6 flex items-center gap-4 text-sm font-semibold text-ink-3">
                <span className="h-px flex-1 bg-line" />
                {t('loginOr')}
                <span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}

          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <h2 className="font-display text-lg font-bold">{t('loginGuestTitle')}</h2>
            <Field label={t('yourName')} htmlFor="guest-name" error={error} hint={t('loginGuestNote')}>
              <TextInput
                id="guest-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
                maxLength={NAME_MAX + 8}
                autoComplete="nickname"
                enterKeyHint="go"
                invalid={Boolean(error)}
              />
            </Field>
            <Button type="submit" size="lg" block busy={busy}>
              {t('heroSit')}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
