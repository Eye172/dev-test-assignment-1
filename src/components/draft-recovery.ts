"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";

const prefix = "orbit:tab-draft:v1:";
const memory = new Map<string, string>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const announce = () => listeners.forEach(listener => listener());
const maxAge = 7 * 24 * 60 * 60 * 1000;

/** Recovery is per browser tab. A recovered draft still needs an explicit database save. */
export function readDraft(key: string): unknown | null {
  try {
    const raw = memory.get(key) ?? sessionStorage.getItem(prefix + key);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (typeof record.updatedAt !== "number" || Date.now() - record.updatedAt > maxAge) return null;
    return record.value;
  } catch { return null; }
}
/** Seed a draft (e.g. from onboarding) that an editor will open as unsaved changes. Never saved without the founder. */
export function writeDraft(key: string, value: unknown) {
  const raw = JSON.stringify({ updatedAt: Date.now(), value });
  memory.set(key, raw);
  try { sessionStorage.setItem(prefix + key, raw); } catch { /* Memory copy keeps this tab's draft. */ }
  announce();
}
export function clearDraft(key: string) {
  memory.delete(key);
  try { sessionStorage.removeItem(prefix + key); } catch { /* In-memory recovery still works if browser storage is unavailable. */ }
  announce();
}
/** An old response may finish after this editor was unmounted and a new draft opened. */
export function clearSubmittedDraft(key: string, submitted: unknown) {
  const current = readDraft(key);
  if (current === null || JSON.stringify(current) === JSON.stringify(submitted)) clearDraft(key);
}
export function useHasDraft(key: string) { return useSyncExternalStore(subscribe,() => readDraft(key) !== null,() => false); }

export function useDraftRecovery(key: string, value: unknown, dirty: boolean, recover: (value: unknown) => void) {
  const firstWrite = useRef(true);
  const recovery = useRef(recover);
  useEffect(() => { recovery.current = recover; });
  useEffect(() => {
    firstWrite.current = true;
    const saved = readDraft(key);
    if (saved !== null) {
      try { recovery.current(saved); } catch { clearDraft(key); }
    }
  }, [key]);
  const serialized = JSON.stringify(value);
  useEffect(() => {
    // The first render uses server data. Do not erase a recovery record before
    // the restoration render has applied it (also keeps hydration deterministic).
    if (firstWrite.current) { firstWrite.current = false; return; }
    if (!dirty) { clearDraft(key); return; }
    const raw = JSON.stringify({ updatedAt: Date.now(),value: JSON.parse(serialized) });
    memory.set(key,raw);
    try { sessionStorage.setItem(prefix + key,raw); } catch { /* Keep this tab's memory copy. */ }
    announce();
  }, [key,serialized,dirty]);
}
