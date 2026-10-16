"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpRight, Check, Circle, CircleDashed, X } from "lucide-react";
import Link from "next/link";

export function Mark({ size = 34 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M25.4 12.58A10 10 0 1 1 19.42 6.6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/><circle cx="16" cy="16" r="3" fill="currentColor"/><circle cx="25.9" cy="6.1" r="2.75" fill="var(--accent)"/></svg>;
}
export function Brand() { return <Link href="/" className="brand" aria-label="Orbit GTM Studio home"><Mark/><span>orbit<span className="brand-divider"/>gtm <span className="muted">studio</span></span></Link>; }
export function ArrowLink({ href,children,className = "" }: { href: string;children: ReactNode;className?: string }) {
  return <Link href={href} className={`button primary ${className}`}>{children}<ArrowUpRight size={17}/></Link>;
}
export function Badge({ status,label }: { status: "complete" | "draft" | "empty" | "untested";label?: string }) {
  const Icon = status === "complete" ? Check : status === "draft" ? CircleDashed : Circle;
  return <span className={`badge ${status}`}><Icon size={12}/>{label ?? { complete: "Complete",draft: "Draft",empty: "Not started",untested: "Untested" }[status]}</span>;
}
export function ErrorNotice({ error,onReload,onCopy }: { error: Error | string | null;onReload?: () => void;onCopy?: () => void }) {
  if (!error) return null;
  return <div className="error-notice" role="alert"><p>{typeof error === "string" ? error : error.message}</p>{onReload && <button type="button" className="button small" onClick={onReload}>Load latest</button>}{onCopy && <button type="button" className="button small" onClick={onCopy}>Copy my draft</button>}</div>;
}
export function Field({ name,label,value,onChange,help,error,required = false,textarea = false,type = "text",placeholder = "",maxLength = 3000,onBlur }: {
  name: string;label: string;value: string;onChange: (value: string) => void;help?: string;error?: string;required?: boolean;textarea?: boolean;type?: string;placeholder?: string;maxLength?: number;onBlur?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (ref.current) { ref.current.style.height = "auto"; ref.current.style.height = `${Math.min(300,Math.max(100,ref.current.scrollHeight))}px`; } },[value]);
  const id = `field-${name}`;
  const shared = { id,name,value,placeholder,maxLength,required,"aria-invalid": !!error,"aria-describedby": (help ? `${id}-help ` : "") + (error ? `${id}-error` : "") || undefined,onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),onBlur };
  return <div className="field"><label htmlFor={id}>{label}{required && <span className="field-required">Required</span>}</label>{textarea ? <textarea {...shared} ref={ref} rows={3}/> : <input {...shared} type={type}/>}{help && <p className="field-help" id={`${id}-help`}>{help}</p>}{error && <p className="field-error" id={`${id}-error`}>{error}</p>}{value.length > maxLength * .8 && <span className="field-help">{value.length}/{maxLength}</span>}</div>;
}
export function Choice<T extends string>({ label,name,value,options,onChange }: { label: string;name: string;value: T;options: readonly T[];onChange: (v: T) => void }) {
  return <fieldset className="choice"><legend>{label}</legend><div>{options.map(option => <label key={option} className={value === option ? "selected" : ""}><input type="radio" name={name} checked={value === option} value={option} onChange={() => onChange(option)}/><span>{option.replaceAll("_"," ")}</span></label>)}</div></fieldset>;
}
export function Dialog({ open,onClose,title,children }: { open: boolean;onClose: () => void;title: string;children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; if (open && !dialog?.open) dialog?.showModal(); else if (!open && dialog?.open) dialog.close(); },[open]);
  return <dialog ref={ref} className="dialog" onCancel={onClose} onClose={onClose} aria-labelledby="dialog-title"><div className="dialog-head"><h2 id="dialog-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20}/></button></div>{children}</dialog>;
}
export function useDirtyGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const click = (event: MouseEvent) => {
      const link = (event.target as Element).closest("a[href]") as HTMLAnchorElement | null;
      if (link && link.origin === location.origin && link.pathname !== location.pathname && !window.confirm("You have unsaved changes. Leave without saving?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload",beforeUnload); document.addEventListener("click",click,true);
    return () => { window.removeEventListener("beforeunload",beforeUnload); document.removeEventListener("click",click,true); };
  },[dirty]);
}
