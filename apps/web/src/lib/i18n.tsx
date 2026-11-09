import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ErrorCode } from '@mdb/shared';
import { parsePublicPath, publicPath, type PublicPage } from '@mdb/shared';
import { NETWORK_ERROR, dictionaries, errorMessages, type Lang, type MessageKey } from './dictionary';
import { storage } from './storage';

type Vars = Record<string, string | number>;

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey, vars?: Vars) => string;
  errorText: (code: ErrorCode | 'network') => string;
  locale: string;
}

const Ctx = createContext<I18n | null>(null);

function detect(): Lang {
  // a public page's address decides its language, so crawlers and visitors see the same text
  const fromPath = parsePublicPath(window.location.pathname);
  if (fromPath) return fromPath.lang;
  const saved = storage.get('lang');
  if (saved === 'tr' || saved === 'en') return saved;
  return navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detect);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    storage.set('lang', next);
    setLangState(next);
  }, []);

  const value = useMemo<I18n>(() => {
    const dict = dictionaries[lang];
    return {
      lang,
      setLang,
      locale: lang === 'tr' ? 'tr-TR' : 'en-GB',
      t: (key, vars) => interpolate(dict[key], vars),
      errorText: (code) => (code === 'network' ? NETWORK_ERROR[lang] : errorMessages[lang][code]),
    };
  }, [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside provider');
  return v;
}

/** Address of a public page in the current language. */
export function usePublicPath(): (page: PublicPage) => string {
  const { lang } = useI18n();
  return useCallback((page: PublicPage) => publicPath(lang, page), [lang]);
}

/** Keeps the app language in step with the address of the public page being shown. */
export function PublicLang({ lang, children }: { lang: Lang; children: ReactNode }) {
  const i18n = useI18n();
  useEffect(() => {
    if (i18n.lang !== lang) i18n.setLang(lang);
  }, [i18n, lang]);
  return i18n.lang === lang ? children : null;
}
