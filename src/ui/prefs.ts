/** Device-level display preferences, shared by server and client. Stored in first-party cookies. */
export const locales = ["en", "ru", "kk"] as const;
export type Locale = (typeof locales)[number];
export const uiVersions = ["observatory", "ledger", "flow"] as const;
export type UiVersion = (typeof uiVersions)[number];
export const themeChoices = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof themeChoices)[number];

export const prefCookies = { locale: "orbit-locale", ui: "orbit-ui", theme: "orbit-theme" } as const;
/** Each design read has a home theme; an explicit device choice always wins. */
export const versionTheme: Record<UiVersion, "light" | "dark"> = { observatory: "dark", ledger: "light", flow: "dark" };
export const localeTags: Record<Locale, string> = { en: "en-GB", ru: "ru-RU", kk: "kk-KZ" };

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (locales as readonly string[]).includes(v);
export const isVersion = (v: unknown): v is UiVersion => typeof v === "string" && (uiVersions as readonly string[]).includes(v);
export const isTheme = (v: unknown): v is ThemeChoice => typeof v === "string" && (themeChoices as readonly string[]).includes(v);

export type DisplayPrefs = { locale: Locale; version: UiVersion; theme: ThemeChoice | null };
/** The attribute rendered on <html>: undefined means "follow the operating system". */
export function resolvedTheme(prefs: Pick<DisplayPrefs, "version" | "theme">): "light" | "dark" | undefined {
  if (prefs.theme === "system") return undefined;
  return prefs.theme ?? versionTheme[prefs.version];
}
export function negotiateLocale(acceptLanguage: string | null): Locale {
  const tags = (acceptLanguage ?? "").toLowerCase().split(",").map(part => part.split(";")[0].trim());
  for (const tag of tags) {
    if (tag.startsWith("kk")) return "kk";
    if (tag.startsWith("ru")) return "ru";
    if (tag.startsWith("en")) return "en";
  }
  return "en";
}
