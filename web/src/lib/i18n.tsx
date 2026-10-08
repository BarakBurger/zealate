import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en, type Dict } from '../locales/en';
import { he } from '../locales/he';
import { ar } from '../locales/ar';
import { de } from '../locales/de';
import { es } from '../locales/es';
import { fr } from '../locales/fr';

export type Lang = 'he' | 'en' | 'ar' | 'de' | 'es' | 'fr';

/** Every interface language, named in its own language for the picker. */
export const LANGS: { code: Lang; name: string }[] = [
  { code: 'he', name: 'עברית' }, { code: 'en', name: 'English' }, { code: 'ar', name: 'العربية' },
  { code: 'de', name: 'Deutsch' }, { code: 'es', name: 'Español' }, { code: 'fr', name: 'Français' },
];
const DICTS: Record<Lang, Dict> = { he, en, ar, de, es, fr };
export const isRtlLang = (l: Lang) => l === 'he' || l === 'ar';
const isLang = (s: string): s is Lang => s in DICTS;

const Ctx = createContext<{ lang: Lang; t: Dict; dir: 'rtl' | 'ltr'; setLang: (l: Lang) => void }>(null!);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  // index.html already chose the language before first paint (the visitor's saved choice, else English).
  const [lang, setLang] = useState<Lang>(() => {
    const l = document.documentElement.lang;
    return isLang(l) ? l : 'en';
  });
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtlLang(lang) ? 'rtl' : 'ltr';
  }, [lang]);
  // Remembered only when the visitor picks a language; until then every visit opens in English.
  const choose = (l: Lang) => {
    setLang(l);
    try { localStorage.setItem('z_lang', l); } catch { /* private mode */ }
  };
  const value = useMemo(() => ({ lang, t: DICTS[lang], dir: (isRtlLang(lang) ? 'rtl' : 'ltr') as 'rtl' | 'ltr', setLang: choose }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
export const useI18n = () => useContext(Ctx);

const RTL_CHARS = /[֐-׿؀-ۿݐ-ݿיִ-﷿ﹰ-﻿]/;
const STRONG = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ֐-׿؀-ۿݐ-ݿיִ-﷿ﹰ-﻿]/;

/** Direction of a piece of user text, from its first strong character. Empty text follows the UI. */
export const textDir = (s: string, fallback: 'rtl' | 'ltr'): 'rtl' | 'ltr' => {
  const m = s.match(STRONG);
  if (!m) return fallback;
  return RTL_CHARS.test(m[0]) ? 'rtl' : 'ltr';
};

/** A language tag for user text, so the browser picks fonts and hyphenation that fit its script. */
export const textLang = (s: string): string => {
  const m = s.match(STRONG);
  if (!m) return 'en';
  if (/[֐-׿יִ-ﭏ]/.test(m[0])) return 'he';
  if (RTL_CHARS.test(m[0])) return 'ar';
  return 'en';
};
