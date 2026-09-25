import { useEffect, useState, type ReactNode, type CSSProperties } from 'react';
import { DomTranslator, type Dictionary } from './domTranslator';

/**
 * English / Spanish for the signed-in portals (investor, landlord, staff, Pro) and their
 * sign-in pages. Wrap a portal route in <PortalLanguage>; it shows the EN | ES switch and,
 * when Spanish is chosen, translates the page. The choice is remembered on this device.
 *
 * The public marketing site is not wrapped, so it is unaffected.
 */

export type Lang = 'en' | 'es';
const STORAGE_KEY = 'ayp_portal_language';
const EVENT = 'ayp-portal-language';

export function getPortalLanguage(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'es' || v === 'en') return v;
  } catch { /* storage blocked */ }
  return 'en';
}

export function setPortalLanguage(lang: Lang) {
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* storage blocked */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: lang }));
}

export function usePortalLanguage(): [Lang, (l: Lang) => void] {
  const [lang, setLang] = useState<Lang>(getPortalLanguage);
  useEffect(() => {
    const on = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return [lang, setPortalLanguage];
}

// The dictionary is ~200KB, so it loads only when someone picks Spanish.
let dictionaryPromise: Promise<Dictionary> | null = null;
const loadDictionary = () => {
  dictionaryPromise ||= import('./es.json').then((m) => (m.default || m) as unknown as Dictionary);
  return dictionaryPromise;
};

export function LanguageSwitch({ className, style }: { className?: string; style?: CSSProperties }) {
  const [lang, setLang] = usePortalLanguage();
  const btn = (value: Lang, label: string, full: string) => (
    <button
      type="button"
      onClick={() => setLang(value)}
      aria-pressed={lang === value}
      aria-label={full}
      lang={value}
      style={{
        minWidth: 44, minHeight: 36, padding: '0 10px', border: 0, borderRadius: 999, cursor: 'pointer',
        fontWeight: 700, fontSize: '.85rem',
        background: lang === value ? '#1a365d' : 'transparent',
        color: lang === value ? '#fff' : '#1a365d',
      }}
    >{label}</button>
  );
  return (
    // translate="no": the switch names each language in that language, always.
    <div role="group" aria-label="Language / Idioma" translate="no" className={className}
      style={{ display: 'inline-flex', gap: 2, padding: 3, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 999, ...style }}>
      {btn('en', 'EN', 'English')}
      {btn('es', 'ES', 'Español')}
    </div>
  );
}

export function PortalLanguage({ children, showSwitch = true }: { children: ReactNode; showSwitch?: boolean }) {
  const [lang] = usePortalLanguage();

  useEffect(() => {
    document.documentElement.lang = lang;
    if (lang !== 'es') return;
    let translator: DomTranslator | null = null;
    let cancelled = false;
    loadDictionary()
      .then((dict) => {
        if (cancelled) return;
        translator = new DomTranslator(dict);
        translator.start();
      })
      .catch(() => { /* dictionary failed to load: the page stays in English */ });
    return () => {
      cancelled = true;
      translator?.stop();
      document.documentElement.lang = 'en';
    };
  }, [lang]);

  return (
    <>
      {children}
      {showSwitch && (
        // Bottom left: Penny and the chat widgets sit bottom right.
        <div style={{ position: 'fixed', left: 12, bottom: 12, zIndex: 60, boxShadow: '0 2px 8px rgba(0,0,0,.15)', borderRadius: 999 }}>
          <LanguageSwitch />
        </div>
      )}
    </>
  );
}

/**
 * Shown above an agreement's text when the portal is in Spanish. The agreement itself is
 * never translated: what someone signs must be the exact text on record.
 */
export function OriginalLanguageNote() {
  const [lang] = usePortalLanguage();
  if (lang !== 'es') return null;
  return (
    <p translate="no" lang="es" style={{ fontSize: '.85rem', color: '#475569', margin: '0 0 8px' }}>
      Este documento se muestra en su idioma original (inglés), que es el texto que se firma y queda registrado.
      Si necesita ayuda para entenderlo, escríbanos antes de firmar.
    </p>
  );
}
