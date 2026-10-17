import "server-only";
import { cookies, headers } from "next/headers";
import { isLocale, isTheme, isVersion, negotiateLocale, prefCookies, type DisplayPrefs } from "./prefs";
import { dictionaryFor } from "./i18n/dictionaries";

export async function getDisplayPrefs(): Promise<DisplayPrefs> {
  const jar = await cookies();
  const locale = jar.get(prefCookies.locale)?.value;
  const version = jar.get(prefCookies.ui)?.value;
  const theme = jar.get(prefCookies.theme)?.value;
  return {
    locale: isLocale(locale) ? locale : negotiateLocale((await headers()).get("accept-language")),
    version: isVersion(version) ? version : "observatory",
    theme: isTheme(theme) ? theme : null,
  };
}
export async function getServerT() {
  const prefs = await getDisplayPrefs();
  const dict = dictionaryFor(prefs.locale);
  return { prefs, dict, t: (key: keyof typeof dict, vars?: Record<string, string | number>) => format(dict[key], vars) };
}
export function format(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => name in vars ? String(vars[name]) : match);
}
