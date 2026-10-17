import { en, type MessageKey } from "./en";
import { ru } from "./ru";
import { kk } from "./kk";
import type { Locale } from "../prefs";

export type Dictionary = Record<MessageKey, string>;
const all: Record<Locale, Partial<Dictionary>> = { en, ru, kk };
/** Missing keys fall back to English so a gap is visible in review but never breaks a page. */
export function dictionaryFor(locale: Locale): Dictionary {
  return locale === "en" ? en : { ...en, ...all[locale] };
}
export function missingKeys(locale: Locale): MessageKey[] {
  return (Object.keys(en) as MessageKey[]).filter(key => !(key in all[locale]));
}
