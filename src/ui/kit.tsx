"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, ChevronDown, Languages, Monitor, Moon, SlidersHorizontal, Sun, X } from "lucide-react";
import type { Reason } from "@/lib/domain/insights";
import type { Workspace } from "@/lib/domain/types";
import { api } from "@/lib/client-api";
import { useDisplay } from "./display";
import { locales, themeChoices, uiVersions, type ThemeChoice } from "./prefs";

export const ease = [0.23, 1, 0.32, 1] as const;
export const springUi = { type: "spring", duration: 0.45, bounce: 0.12 } as const;

export function Brand({ compact = false }: { compact?: boolean }) {
  const { t } = useDisplay();
  return <Link href="/" className={`v4-brand ${compact ? "is-compact" : ""}`} aria-label={t("brand.home")}>
    <span className="v4-brand-logo" aria-hidden="true"/>
    {!compact && <span className="v4-brand-sub" aria-hidden="true">{t("brand.studio")}</span>}
  </Link>;
}

/** Close on Escape and outside pointer; returns a ref for the popover root. */
export function useDismiss<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const down = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    window.addEventListener("keydown", key); window.addEventListener("pointerdown", down);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("pointerdown", down); };
  }, [open, close]);
  return ref;
}

const themeIcon: Record<ThemeChoice, ReactNode> = { system: <Monitor size={15} aria-hidden/>, light: <Sun size={15} aria-hidden/>, dark: <Moon size={15} aria-hidden/> };

/** One control for language, interface version and theme. Origin-aware popover from its trigger. */
export function DisplayMenu({ align = "end" }: { align?: "start" | "end" }) {
  const { t, locale, version, theme, setLocale, setVersion, setTheme } = useDisplay();
  const [open, setOpen] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  const id = useId();
  const activeTheme: ThemeChoice = theme ?? "system";
  return <div className={`v4-display ${align === "start" ? "align-start" : ""}`} ref={ref}>
    <button type="button" className="v4-chip-button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}>
      <Languages size={15} aria-hidden/><span>{t(`locale.short.${locale}`)}</span><span className="v4-sep" aria-hidden/>
      <SlidersHorizontal size={15} aria-hidden/><span className="v4-hide-sm">{t(`ui.${version}`)}</span><ChevronDown size={14} aria-hidden className="v4-caret"/>
    </button>
    <AnimatePresence>{open && <motion.div id={id} className="v4-popover" role="dialog" aria-label={t("chrome.display")}
      initial={{ opacity: 0, scale: 0.97, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: -2, transition: { duration: 0.12 } }}
      transition={{ duration: 0.2, ease }}>
      <fieldset className="v4-pop-group"><legend>{t("chrome.language")}</legend>
        <div className="v4-seg">{locales.map(l => <button key={l} type="button" aria-pressed={locale === l} onClick={() => setLocale(l)}>{t(`locale.${l}`)}</button>)}</div>
      </fieldset>
      <fieldset className="v4-pop-group"><legend>{t("chrome.version")}</legend>
        <div className="v4-versions">{uiVersions.map((v, i) => <button key={v} type="button" aria-pressed={version === v} onClick={() => setVersion(v)}>
          <span className="v4-version-n mono">V{i + 1}</span><span><strong>{t(`ui.${v}`)}</strong><small>{t(`ui.${v}.hint`)}</small></span>
          {version === v && <Check size={15} aria-hidden className="v4-version-check"/>}
        </button>)}</div>
      </fieldset>
      <fieldset className="v4-pop-group"><legend>{t("chrome.theme")}</legend>
        <div className="v4-seg">{themeChoices.map(c => <button key={c} type="button" aria-pressed={activeTheme === c} onClick={() => setTheme(c)}>{themeIcon[c]}{t(`chrome.theme.${c}`)}</button>)}</div>
      </fieldset>
    </motion.div>}</AnimatePresence>
  </div>;
}

export function DemoTag() {
  const { t } = useDisplay();
  const [open, setOpen] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  return <div className="v4-demo" ref={ref}>
    <button type="button" className="v4-demo-tag" aria-expanded={open} onClick={() => setOpen(o => !o)}><span className="v4-demo-dot" aria-hidden/>{t("chrome.demo")}</button>
    <AnimatePresence>{open && <motion.p className="v4-popover v4-demo-note" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.2, ease }}>{t("chrome.demoNote")}</motion.p>}</AnimatePresence>
  </div>;
}

export function DemoLink({ className = "v4-button", children }: { className?: string; children?: ReactNode }) {
  const { t } = useDisplay();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const open = async () => {
    setBusy(true); setError("");
    // A separate working copy per visitor, so reviewers never overwrite each other's demo.
    try { const ws = await api<Workspace>("/api/demo", { method: "POST" }); router.push(`/startups/${ws.startup.id}`); }
    catch { setError(t("err.demo")); setBusy(false); }
  };
  return <>
    <button type="button" className={className} onClick={() => void open()} disabled={busy} aria-busy={busy}>{busy ? t("land.cta.demoBusy") : children ?? t("land.cta.demo")}<ArrowRight size={16} aria-hidden className="v4-arrow"/></button>
    {error && <p className="v4-error" role="alert">{error}</p>}
  </>;
}

export function Provenance({ kind }: { kind: "rules" | "ai" | "founder" }) {
  const { t } = useDisplay();
  return <span className={`v4-prov is-${kind}`}>{kind === "rules" ? t("common.rules") : kind === "ai" ? t("common.ai") : t("common.founder")}</span>;
}

/** Score explanation: each rule shown as met or unmet, with the points it carries. */
export function Reasons({ reasons, prefix = "reason" }: { reasons: Reason[]; prefix?: string }) {
  const { tk, t } = useDisplay();
  return <ul className="v4-reasons">{reasons.map(r => <li key={r.code} className={r.ok ? "ok" : "no"}>
    <span className="v4-reason-mark" aria-hidden>{r.ok ? <Check size={13} strokeWidth={2.5}/> : <X size={13} strokeWidth={2.5}/>}</span>
    <span>{tk(`${prefix}.${r.code}`)}</span>
    <span className="mono v4-reason-pts">{r.ok ? `+${r.points}` : "0"}</span>
    <span className="sr-only">{r.ok ? t("common.complete") : t("common.incomplete")}</span>
  </li>)}</ul>;
}

/** A labelled number that can change: tabular, with an optional meaning line. */
export function Readout({ label, value, unit, meaning, children, className = "" }: { label: string; value: ReactNode; unit?: string; meaning?: ReactNode; children?: ReactNode; className?: string }) {
  return <div className={`v4-readout ${className}`}>
    <span className="v4-readout-label">{label}</span>
    <span className="v4-readout-value"><span className="num">{value}</span>{unit && <span className="v4-readout-unit">{unit}</span>}</span>
    {meaning && <span className="v4-readout-meaning">{meaning}</span>}
    {children}
  </div>;
}

/** Five segments: one per strategy section. */
export function SectionMeter({ states, labels }: { states: ("complete" | "draft" | "empty")[]; labels?: string[] }) {
  const { t } = useDisplay();
  const stateLabel = { complete: t("common.complete"), draft: t("band.draft"), empty: t("common.notSet") };
  return <div className="v4-meter" role="img" aria-label={labels ? labels.map((l, i) => `${l}: ${stateLabel[states[i]]}`).join(", ") : undefined}>
    {states.map((s, i) => <span key={i} className={`v4-meter-seg is-${s}`} style={{ transitionDelay: `${i * 50}ms` }}/>)}
  </div>;
}

export function Disclosure({ summary, children, defaultOpen = false }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return <div className={`v4-disclosure ${open ? "is-open" : ""}`}>
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}>{summary}<ChevronDown size={14} aria-hidden className="v4-caret"/></button>
    <AnimatePresence initial={false}>{open && <motion.div id={id} className="v4-disclosure-body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.24, ease }}>
      <div>{children}</div>
    </motion.div>}</AnimatePresence>
  </div>;
}
