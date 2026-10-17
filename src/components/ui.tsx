"use client";
import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { AlertCircle, ArrowUpRight, Check, Circle, CircleDashed, FlaskConical, X } from "lucide-react";
import Link from "next/link";

export function Brand() {
  return <Link href="/" className="brand" aria-label="Black Orbit GTM Studio, home"><span className="brand-logo" aria-hidden="true"/><span className="brand-sub" aria-hidden="true">GTM Studio</span></Link>;
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
export function Field({ name, label, value, onChange, help, error, required = false, textarea = false, type = "text", placeholder = "", maxLength = 3000, onBlur, autoComplete, list, inputMode, className = "", children, minRows = 96 }: {
  name: string; label: string; value: string; onChange: (value: string) => void; help?: string; error?: string; required?: boolean; textarea?: boolean;
  type?: string; placeholder?: string; maxLength?: number; onBlur?: () => void; autoComplete?: string; list?: string; inputMode?: "url" | "text";
  className?: string; children?: ReactNode; minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = ref.current; if (el) { el.style.height = "auto"; el.style.height = `${Math.min(420, Math.max(minRows, el.scrollHeight + 2))}px`; } }, [value, minRows]);
  const id = `field-${name}`;
  const describedBy = [help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const shared = { id, name, value, placeholder, maxLength, "aria-required": required || undefined, "aria-invalid": !!error || undefined, "aria-describedby": describedBy, onBlur, autoComplete,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value) };
  return <div className={`field ${className}`}>
    <label htmlFor={id}>{label}{required && <span className="field-required">Required</span>}</label>
    {textarea ? <textarea {...shared} ref={ref} rows={minRows < 96 ? 1 : 3}/> : <input {...shared} type={type} list={list} inputMode={inputMode}/>}
    {help && <p className="field-help" id={`${id}-help`}>{help}</p>}
    {error && <p className="field-error" id={`${id}-error`}><AlertCircle size={14} aria-hidden/>{error}</p>}
    {value.length > maxLength * 0.8 && <span className="field-count">{value.length}/{maxLength}</span>}
    {children}
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
export function Dialog({ open, onClose, title, children, locked = false, className = "" }: { open: boolean; onClose: () => void; title: string; children: ReactNode; locked?: boolean; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { const dialog = ref.current; if (open && !dialog?.open) dialog?.showModal(); else if (!open && dialog?.open) dialog.close(); }, [open]);
  const request = () => { if (!locked) onClose(); };
  return <dialog ref={ref} className={`dialog ${className}`} onCancel={event => { event.preventDefault(); request(); }} aria-labelledby={titleId} aria-busy={locked || undefined}
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
  return <span className={`save-state ${tone}`} aria-live="polite" title={text}>{tone === "ok" && <Check size={14} aria-hidden/>}{tone === "ok" && savedAt ? <span>Saved<span className="save-time"> · {formatTime(savedAt)}</span></span> : text}</span>;
}


const noop = () => () => {};
export function useHydrated() { return useSyncExternalStore(noop, () => true, () => false); }
/** Media query state; false on the server and during hydration. */
export function useMedia(query: string) {
  return useSyncExternalStore(
    listener => { const m = window.matchMedia(query); m.addEventListener("change", listener); return () => m.removeEventListener("change", listener); },
    () => window.matchMedia(query).matches, () => false);
}
