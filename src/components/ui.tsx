"use client";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AlertCircle, ArrowUpRight, Check, Circle, CircleDashed, FlaskConical, X } from "lucide-react";
import Link from "next/link";

export function Mark({ size = 30 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M25.4 12.58A10 10 0 1 1 19.42 6.6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><circle cx="16" cy="16" r="3" fill="currentColor"/><circle cx="25.9" cy="6.1" r="2.75" fill="var(--accent)"/></svg>;
}
export function Brand() {
  return <Link href="/" className="brand" aria-label="Orbit GTM Studio, home"><Mark/><span className="brand-word">Orbit GTM <span className="muted">Studio</span></span></Link>;
}
export function ArrowLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return <Link href={href} className={`button primary ${className}`}>{children}<ArrowUpRight size={17} aria-hidden/></Link>;
}
export type BadgeStatus = "complete" | "draft" | "empty" | "untested" | "todo" | "in_progress" | "done" | "skipped" | "custom" | "low" | "medium" | "high";
const badgeText: Record<BadgeStatus, string> = {
  complete: "Complete", draft: "Draft", empty: "Not started", untested: "Untested", todo: "To do", in_progress: "In progress",
  done: "Done", skipped: "Skipped", custom: "Custom", low: "Low risk", medium: "Medium risk", high: "High risk",
};
export function Badge({ status, label }: { status: BadgeStatus; label?: string }) {
  const Icon = status === "complete" || status === "done" ? Check : status === "draft" || status === "in_progress" ? CircleDashed : status === "untested" ? FlaskConical : Circle;
  return <span className={`badge ${status}`}><Icon size={12} aria-hidden/>{label ?? badgeText[status]}</span>;
}
export function ErrorNotice({ error, onReload, onCopy, onRetry }: { error: Error | string | null; onReload?: () => void; onCopy?: () => void; onRetry?: () => void }) {
  if (!error) return null;
  return <div className="error-notice" role="alert" tabIndex={-1}><p>{typeof error === "string" ? error : error.message}</p>
    {onRetry && <button type="button" className="button small" onClick={onRetry}>Retry</button>}
    {onReload && <button type="button" className="button small" onClick={onReload}>Load latest</button>}
    {onCopy && <button type="button" className="button small ghost" onClick={onCopy}>Copy my draft</button>}</div>;
}
export function Field({ name, label, value, onChange, help, error, required = false, textarea = false, type = "text", placeholder = "", maxLength = 3000, onBlur, autoComplete, list, inputMode }: {
  name: string; label: string; value: string; onChange: (value: string) => void; help?: string; error?: string; required?: boolean; textarea?: boolean;
  type?: string; placeholder?: string; maxLength?: number; onBlur?: () => void; autoComplete?: string; list?: string; inputMode?: "url" | "text";
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = ref.current; if (el) { el.style.height = "auto"; el.style.height = `${Math.min(320, Math.max(96, el.scrollHeight + 2))}px`; } }, [value]);
  const id = `field-${name}`;
  const describedBy = [help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const shared = { id, name, value, placeholder, maxLength, "aria-required": required || undefined, "aria-invalid": !!error || undefined, "aria-describedby": describedBy, onBlur, autoComplete,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value) };
  return <div className="field">
    <label htmlFor={id}>{label}{required && <span className="field-required">Required</span>}</label>
    {textarea ? <textarea {...shared} ref={ref} rows={3}/> : <input {...shared} type={type} list={list} inputMode={inputMode}/>}
    {help && <p className="field-help" id={`${id}-help`}>{help}</p>}
    {error && <p className="field-error" id={`${id}-error`}><AlertCircle size={14} aria-hidden/>{error}</p>}
    {value.length > maxLength * 0.8 && <span className="field-count">{value.length}/{maxLength}</span>}
  </div>;
}
export function Choice<T extends string>({ label, name, value, options, onChange, className = "", labels }: {
  label: string; name: string; value: T; options: readonly T[]; onChange: (v: T) => void; className?: string; labels?: Partial<Record<T, string>>;
}) {
  return <fieldset className={`choice ${className}`}><legend>{label}</legend><div>{options.map(option =>
    <label key={option} className={value === option ? "selected" : ""} data-value={option}>
      <input type="radio" name={name} checked={value === option} value={option} onChange={() => onChange(option)}/>
      <span>{labels?.[option] ?? option.replaceAll("_", " ")}</span>
    </label>)}</div></fieldset>;
}
/** Single controlled close path. While `locked` (a request is pending) Escape, backdrop and Close do nothing. */
export function Dialog({ open, onClose, title, children, locked = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; locked?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { const dialog = ref.current; if (open && !dialog?.open) dialog?.showModal(); else if (!open && dialog?.open) dialog.close(); }, [open]);
  const request = () => { if (!locked) onClose(); };
  return <dialog ref={ref} className="dialog" onCancel={event => { event.preventDefault(); request(); }} aria-labelledby={titleId} aria-busy={locked || undefined}
    onClick={e => { if (e.target === ref.current) request(); }}>
    <div className="dialog-head"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" onClick={request} disabled={locked} aria-label="Close"><X size={20}/></button></div>
    {children}
  </dialog>;
}
export function Spinner() { return <span className="spinner" aria-hidden/>; }
/* One draft-protection mechanism shared by in-app links, keyboard shortcuts and page unload. */
const dirtySources = new Set<symbol>();
export function hasUnsavedChanges() { return dirtySources.size > 0; }
export function confirmLeave() { return !hasUnsavedChanges() || window.confirm("You have unsaved changes. Leave without saving?"); }
export function useDirtyGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const token = Symbol("draft");
    dirtySources.add(token);
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const click = (event: MouseEvent) => {
      const link = (event.target as Element).closest("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download") || link.origin !== location.origin) return;
      if (link.pathname === location.pathname && link.search === location.search) return;
      if (!window.confirm("You have unsaved changes. Leave without saving?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", beforeUnload); document.addEventListener("click", click, true);
    return () => { dirtySources.delete(token); window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", click, true); };
  }, [dirty]);
}
export function formatTime(iso: string | null) {
  if (!iso) return "";
  // Server and browser locales/time zones can differ. A stable, labelled UTC
  // value prevents hydration from remounting an editor and erasing early input.
  return `${new Date(iso).toISOString().slice(11,16)} UTC`;
}
export function SaveState({ saving, dirty, savedAt, failed }: { saving: boolean; dirty: boolean; savedAt: string | null; failed?: boolean }) {
  const text = saving ? "Saving…" : failed ? "Couldn't save" : dirty ? "Unsaved changes" : savedAt ? `Saved · ${formatTime(savedAt)}` : "Not saved yet";
  const tone = saving ? "" : failed ? "danger" : dirty ? "warn" : savedAt ? "ok" : "";
  return <span className={`save-state ${tone}`} aria-live="polite">{tone === "ok" && <Check size={14} aria-hidden/>}{text}</span>;
}

/* Per-tab draft recovery. Browser Back/Forward and reloads bypass navigation guards, so dirty drafts are
   mirrored to sessionStorage (this tab only, never sent anywhere) and offered back when the editor mounts again.
   A restored draft keeps the revision it was based on, so saving it over newer data raises the normal conflict.
   Storage is read through useSyncExternalStore: the server snapshot is empty, so hydration never mismatches. */
type StoredDraft<T> = { value: T; revision: number; at: number; owner: string };
const draftListeners = new Set<() => void>();
const notifyDrafts = () => draftListeners.forEach(l => l());
const subscribeDrafts = (l: () => void) => { draftListeners.add(l); return () => { draftListeners.delete(l); }; };
const readRaw = (key: string) => { try { return sessionStorage.getItem(key); } catch { return null; } };
const noop = () => () => {};
export function useHydrated() { return useSyncExternalStore(noop, () => true, () => false); }
export function useHasDraft(key: string) { return useSyncExternalStore(subscribeDrafts, () => readRaw(key) !== null, () => false); }
export function clearDraft(key: string) { try { sessionStorage.removeItem(key); } catch { /* storage unavailable */ } notifyDrafts(); }
function writeDraft(key: string, draft: StoredDraft<unknown>) { try { sessionStorage.setItem(key, JSON.stringify(draft)); } catch { /* storage full or blocked */ } notifyDrafts(); }
export function useDraftRecovery<T>(key: string, value: T, dirty: boolean, revision: number, baseline: T) {
  const [owner] = useState(() => Math.random().toString(36).slice(2));
  const [decided, setDecided] = useState(false);
  const hydrated = useHydrated();
  const raw = useSyncExternalStore(subscribeDrafts, () => readRaw(key), () => null);
  let stored: StoredDraft<T> | null = null;
  try { stored = raw ? JSON.parse(raw) as StoredDraft<T> : null; } catch { stored = null; }
  // Offer only a draft left by an earlier editor instance that differs from what is saved now.
  const offer = !decided && stored && stored.owner !== owner && JSON.stringify(stored.value) !== JSON.stringify(baseline) ? stored : null;
  const serialized = JSON.stringify(value);
  const hasOffer = offer !== null;
  // Mirror the draft when it changes. The stored value is deliberately not a dependency:
  // this effect writes it, so depending on it would loop.
  useEffect(() => {
    if (!hydrated || hasOffer) return;
    if (dirty) writeDraft(key, { value: JSON.parse(serialized), revision, at: Date.now(), owner });
    else if (readRaw(key) !== null) clearDraft(key);
  }, [hydrated, hasOffer, dirty, key, serialized, revision, owner]);
  return {
    offer,
    accept: () => { setDecided(true); return offer; },
    discard: () => { setDecided(true); clearDraft(key); },
  };
}
export function DraftOffer({ offer, currentRevision, onRestore, onDiscard, what = "draft" }: { offer: { at: number; revision: number } | null; currentRevision: number; onRestore: () => void; onDiscard: () => void; what?: string }) {
  if (!offer) return null;
  const time = `${new Date(offer.at).toISOString().slice(11, 16)} UTC`;
  return <div className="draft-offer" role="region" aria-label="Unsaved draft found">
    <p><strong>Unsaved {what} found in this tab</strong> · last edited {time}.{offer.revision !== currentRevision && " The saved version changed since. Saving the restored draft will ask you to resolve the conflict."}</p>
    <div className="draft-offer-actions"><button type="button" className="button small primary" onClick={onRestore}>Restore draft</button><button type="button" className="button small ghost" onClick={onDiscard}>Discard</button></div>
  </div>;
}
