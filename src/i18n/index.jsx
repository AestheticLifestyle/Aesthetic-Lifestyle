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
const DEFAULT_LANG = 'en'; // Locked to English — Dutch option removed

// ── Read / write language preference ──
// Always return English — Dutch support is disabled.
function storedLang() {
  // Force-overwrite any legacy Dutch setting so users who previously
  // switched to NL are returned to English.
  try { localStorage.setItem(STORAGE_KEY, DEFAULT_LANG); } catch { /* noop */ }
  return DEFAULT_LANG;
}

function storeLang(_lang) {
  // Language is locked to English — ignore writes.
  try { localStorage.setItem(STORAGE_KEY, DEFAULT_LANG); } catch { /* noop */ }
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

/** Available languages — currently English only */
export const AVAILABLE_LANGS = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
];
