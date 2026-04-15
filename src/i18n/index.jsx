/**
 * Lightweight i18n system for Aesthetic Lifestyle App.
 *
 * Usage:
 *   import { useT, setLanguage, getLanguage } from '../i18n';
 *   const t = useT();
 *   <span>{t('save')}</span>
 *   <span>{t('checkinSaved', { date: '2026-04-15' })}</span>
 *
 * The current language is stored in localStorage and in the
 * Supabase profiles.preferences JSONB column for cross-device sync.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import en from './en';
import nl from './nl';

const LANGS = { en, nl };
const STORAGE_KEY = 'aes_lang';
const DEFAULT_LANG = 'nl'; // Dutch default — most clients are Dutch

// ── Read / write language preference ──
function storedLang() {
  try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG; }
  catch { return DEFAULT_LANG; }
}

function storeLang(lang) {
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* noop */ }
}

// ── Context ──
const I18nContext = createContext({ lang: DEFAULT_LANG, setLang: () => {} });

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(storedLang);

  const setLang = useCallback((newLang) => {
    if (LANGS[newLang]) {
      setLangState(newLang);
      storeLang(newLang);
    }
  }, []);

  // Sync from Supabase preferences if available (loaded by SettingsScreen)
  useEffect(() => {
    const saved = storedLang();
    if (saved !== lang) setLangState(saved);
  }, []);

  return (
    <I18nContext.Provider value={{ lang, setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

/**
 * Main translation hook.
 * Returns a function t(key, params?) that looks up translations.
 *
 * Params are interpolated: t('checkinSaved', { date: '2026-04-15' })
 * → "Check-in saved for 2026-04-15!"
 */
export function useT() {
  const { lang } = useContext(I18nContext);
  const dict = LANGS[lang] || LANGS[DEFAULT_LANG];

  return useCallback((key, params) => {
    let str = dict[key] ?? LANGS.en[key] ?? key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
      });
    }
    return str;
  }, [dict]);
}

/** Hook to get/set the current language code */
export function useLanguage() {
  return useContext(I18nContext);
}

/** Non-hook getter for use in services / utilities */
export function getLanguage() {
  return storedLang();
}

/** Non-hook setter */
export function setLanguage(lang) {
  if (LANGS[lang]) storeLang(lang);
}

/** Available languages */
export const AVAILABLE_LANGS = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
];
