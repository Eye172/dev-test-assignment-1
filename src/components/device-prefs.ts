"use client";
import { useCallback, useSyncExternalStore } from "react";

/**
 * Per-device conveniences (autosave, roadmap view, examples). They change how this browser works,
 * never the workspace data, so they stay out of the shared database preferences.
 */
const prefix = "orbit:device:";
const listeners = new Set<() => void>();
const memory = new Map<string, string>();
function read(key: string): string | null {
  try { return localStorage.getItem(prefix + key) ?? memory.get(key) ?? null; } catch { return memory.get(key) ?? null; }
}
export function useDevicePref<T extends string>(key: string, fallback: T): [T, (value: T) => void] {
  const value = useSyncExternalStore(
    listener => { listeners.add(listener); const storage = (e: StorageEvent) => { if (e.key === prefix + key) listener(); }; window.addEventListener("storage", storage); return () => { listeners.delete(listener); window.removeEventListener("storage", storage); }; },
    () => (read(key) as T | null) ?? fallback,
    () => fallback,
  );
  const set = useCallback((next: T) => {
    memory.set(key, next);
    try { localStorage.setItem(prefix + key, next); } catch { /* Memory copy keeps this tab consistent. */ }
    listeners.forEach(listener => listener());
  }, [key]);
  return [value, set];
}
