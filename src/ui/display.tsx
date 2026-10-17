"use client";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { MessageKey } from "./i18n/en";
import type { Dictionary } from "./i18n/dictionaries";
import { setRuntimeDictionary } from "./i18n/runtime";
import { localeTags, prefCookies, resolvedTheme, type DisplayPrefs, type Locale, type ThemeChoice, type UiVersion } from "./prefs";

type Vars = Record<string, string | number>;
type DisplayContext = DisplayPrefs & {
  t: (key: MessageKey, vars?: Vars) => string;
  /** Translate a dynamic key (e.g. built from a code) with a visible fallback. */
  tk: (key: string, vars?: Vars, fallback?: string) => string;
  number: (n: number, options?: Intl.NumberFormatOptions) => string;
  date: (iso: string, options?: Intl.DateTimeFormatOptions) => string;
  setLocale: (locale: Locale) => void;
  setVersion: (version: UiVersion) => void;
  setTheme: (theme: ThemeChoice) => void;
};
const Context = createContext<DisplayContext | null>(null);

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}
export function format(template: string, vars?: Vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => name in vars ? String(vars[name]) : match);
}

export function DisplayProvider({ prefs, dict, children }: { prefs: DisplayPrefs; dict: Dictionary; children: ReactNode }) {
  const router = useRouter();
  setRuntimeDictionary(dict);
  const t = useCallback((key: MessageKey, vars?: Vars) => format(dict[key] ?? key, vars), [dict]);
  const tk = useCallback((key: string, vars?: Vars, fallback?: string) => format((dict as Record<string, string>)[key] ?? fallback ?? key, vars), [dict]);
  const tag = localeTags[prefs.locale];
  const number = useCallback((n: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat(tag, options).format(n), [tag]);
  const date = useCallback((iso: string, options?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, options ?? { day: "numeric", month: "short" }).format(new Date(iso)), [tag]);
  const setLocale = useCallback((locale: Locale) => { writeCookie(prefCookies.locale, locale); document.documentElement.lang = locale; router.refresh(); }, [router]);
  const setVersion = useCallback((version: UiVersion) => {
    writeCookie(prefCookies.ui, version);
    const theme = resolvedTheme({ version, theme: prefs.theme });
    if (theme) document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme;
    document.documentElement.dataset.ui = version;
    router.refresh();
  }, [router, prefs.theme]);
  const setTheme = useCallback((theme: ThemeChoice) => {
    writeCookie(prefCookies.theme, theme);
    const resolved = resolvedTheme({ version: prefs.version, theme });
    if (resolved) document.documentElement.dataset.theme = resolved; else delete document.documentElement.dataset.theme;
    router.refresh();
  }, [router, prefs.version]);
  const value = useMemo(() => ({ ...prefs, t, tk, number, date, setLocale, setVersion, setTheme }), [prefs, t, tk, number, date, setLocale, setVersion, setTheme]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useDisplay() {
  const value = useContext(Context);
  if (!value) throw new Error("DisplayProvider missing");
  return value;
}
export const useT = () => useDisplay().t;
