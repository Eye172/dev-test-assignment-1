import { en, type MessageKey } from "./en";

/** The active dictionary for code that runs outside React hooks (confirm dialogs, shared primitives). Set by DisplayProvider. */
let current: Record<string, string> = en;
export function setRuntimeDictionary(dict: Record<string, string>) { current = dict; }
export function rt(key: MessageKey, vars?: Record<string, string | number>) {
  const template = current[key] ?? en[key] ?? key;
  return vars ? template.replace(/\{(\w+)\}/g, (m, name: string) => name in vars ? String(vars[name]) : m) : template;
}
