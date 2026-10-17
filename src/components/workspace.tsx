"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowDownToLine, Check, Compass, LayoutGrid, Link2, Orbit, Route, Search, Share2, Sparkles, UserRound } from "lucide-react";
import { api } from "@/lib/client-api";
import { mergeWorkspace } from "@/lib/client-workspace";
import { computeInsights, type Insights } from "@/lib/domain/insights";
import type { Preferences, Startup, Workspace } from "@/lib/domain/types";
import { confirmLeave, useHydrated } from "./ui";
import { OrbitDial, useOrbitModel } from "./orbit";
import { CommandPalette } from "./command-palette";
import { useDisplay } from "@/ui/display";
import { Brand, DemoTag, DisplayMenu, ease, useDismiss } from "@/ui/kit";
import type { MessageKey } from "@/ui/i18n/en";

type WorkspaceContext = {
  workspace: Workspace;
  setWorkspace: Dispatch<SetStateAction<Workspace>>;
  refresh: () => Promise<void>;
  notify: (message: string) => void;
  savePreferences: (patch: Partial<Preferences>, expectedRevision?: number) => Promise<void>;
  /** Report a write in flight so the top bar can show one honest save state for the whole workspace. */
  track: <T>(work: Promise<T>) => Promise<T>;
  openPalette: () => void;
  insights: Insights;
  base: string;
};
const Context = createContext<WorkspaceContext | null>(null);
export function useWorkspace() { const value = useContext(Context); if (!value) throw new Error("Workspace provider missing"); return value; }

export const spring = { type: "spring", duration: 0.45, bounce: 0.12 } as const;
export const softSpring = { type: "spring", stiffness: 260, damping: 30 } as const;
export const easeOut = ease;

export type NavItem = { key: "overview" | "strategy" | "dashboard" | "roadmap" | "ai"; label: MessageKey; href: string; Icon: typeof Orbit; shortcut: string };

export function WorkspaceShell({ initial, serverNow, children }: { initial: Workspace; serverNow: string; children: ReactNode }) {
  const { t, version } = useDisplay();
  const [workspace, setWorkspaceState] = useState(initial);
  const setWorkspace: Dispatch<SetStateAction<Workspace>> = useCallback(action => {
    setWorkspaceState(current => mergeWorkspace(current, typeof action === "function" ? action(current) : action));
  }, []);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [inFlight, setInFlight] = useState(0);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const pathname = usePathname(); const router = useRouter();
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const base = `/startups/${workspace.startup.id}`;
  // Server render and hydration use the server clock; afterwards the device clock (plan day can differ across midnight).
  const hydrated = useHydrated();
  const insights = useMemo(() => computeInsights(workspace, hydrated ? new Date() : new Date(serverNow)), [workspace, hydrated, serverNow]);

  const refresh = useCallback(async () => {
    const latest = await api<Workspace>(`/api/startups/${initial.startup.id}`);
    setWorkspace(latest);
  }, [initial.startup.id, setWorkspace]);
  const notify = useCallback((text: string) => {
    setNotice({ id: Date.now(), text });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4200);
  }, []);
  const track = useCallback(async <T,>(work: Promise<T>) => {
    setInFlight(n => n + 1);
    try { const result = await work; setLastSaved(Date.now()); return result; }
    finally { setInFlight(n => n - 1); }
  }, []);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);
  useEffect(() => { document.querySelector<HTMLElement>("main h1")?.focus({ preventScroll: true }); }, [pathname]);

  useEffect(() => {
    let prefix = false; let timer: ReturnType<typeof setTimeout> | undefined;
    const keydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen(o => !o); return; }
      if ((e.target as Element)?.closest("input,textarea,select,[contenteditable],dialog") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (prefix) {
        prefix = false;
        const route = ({ o: base, s: `${base}/strategy`, d: `${base}/dashboard`, r: `${base}/roadmap`, a: `${base}/ai` } as Record<string, string>)[e.key.toLowerCase()];
        if (route) { e.preventDefault(); if (confirmLeave()) router.push(route); }
      } else if (e.key === "g") { prefix = true; clearTimeout(timer); timer = setTimeout(() => { prefix = false; }, 1200); }
      else if (e.key === "/") { e.preventDefault(); setPaletteOpen(true); }
    };
    window.addEventListener("keydown", keydown);
    return () => { window.removeEventListener("keydown", keydown); clearTimeout(timer); };
  }, [base, router]);

  const savePreferences = useCallback(async (patch: Partial<Preferences>, expectedRevision = workspace.startup.revision) => {
    const startup = await track(api<Startup>(`/api/startups/${workspace.startup.id}`, { method: "PATCH",
      body: JSON.stringify({ expectedRevision, patch: { preferences: { ...workspace.startup.preferences, ...patch } } }) }));
    setWorkspace(current => ({ ...current, startup }));
  }, [workspace.startup, setWorkspace, track]);

  const nav: NavItem[] = [
    { key: "overview", label: "nav.overview", href: base, Icon: Orbit, shortcut: "o" },
    { key: "strategy", label: "nav.strategy", href: `${base}/strategy`, Icon: Compass, shortcut: "s" },
    { key: "dashboard", label: "nav.dashboard", href: `${base}/dashboard`, Icon: LayoutGrid, shortcut: "d" },
    { key: "roadmap", label: "nav.roadmap", href: `${base}/roadmap`, Icon: Route, shortcut: "r" },
    { key: "ai", label: "nav.ai", href: `${base}/ai`, Icon: Sparkles, shortcut: "a" },
  ];
  const isActive = (href: string) => href === base ? pathname === base : pathname.startsWith(href);
  const copyLink = useCallback(async () => {
    const url = `${location.origin}${base}`;
    try { await navigator.clipboard.writeText(url); notify(t("chrome.shareDone")); } catch { window.prompt(t("chrome.share"), url); }
  }, [base, notify, t]);

  const header = <>
    <SaveIndicator busy={inFlight > 0} savedAt={lastSaved}/>
    <div className="v4-header-actions">
      <button type="button" className="v4-search" onClick={() => setPaletteOpen(true)} aria-keyshortcuts="Control+K Meta+K">
        <Search size={15} aria-hidden/><span className="v4-hide-sm">{t("chrome.search")}</span><kbd aria-hidden className="v4-hide-sm">⌘K</kbd>
      </button>
      <DemoTag/>
      <DisplayMenu/>
      <ShareMenu startupId={workspace.startup.id} onCopy={() => void copyLink()}/>
    </div>
  </>;
  const shellProps = { workspace, insights, nav, isActive, header, base };

  return <Context.Provider value={{ workspace, setWorkspace, refresh, notify, savePreferences, track, openPalette: () => setPaletteOpen(true), insights, base }}>
    <MotionConfig reducedMotion="user" transition={spring}>
      <div className={`v4-app v4-ws is-${version}`}>
        {version === "observatory" ? <ObservatoryChrome {...shellProps}/> : version === "ledger" ? <LedgerChrome {...shellProps}/> : <FlowChrome {...shellProps}/>}
        <main id="content" className="v4-main">{children}</main>
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} workspace={workspace} base={base}
          actions={{ copyLink: () => void copyLink(), toggleTheme: () => {}, preferences: () => {} }}/>
        <div className="v4-toasts" aria-live="polite">
          <AnimatePresence>{notice && <motion.div key={notice.id} className="v4-toast" role="status" layout
            initial={{ opacity: 0, y: -10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.14 } }} transition={{ duration: 0.24, ease }}>
            <Check size={15} aria-hidden strokeWidth={2.5}/>{notice.text}
          </motion.div>}</AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  </Context.Provider>;
}

type ChromeProps = { workspace: Workspace; insights: Insights; nav: NavItem[]; isActive: (href: string) => boolean; header: ReactNode; base: string };

/* V1 — Observatory: an instrument rail with the orbit dial as home control. */
function ObservatoryChrome({ workspace, nav, isActive, header, base }: ChromeProps) {
  const { t } = useDisplay();
  const model = useOrbitModel(workspace);
  return <>
    <header className="v4-topbar obs-topbar">
      <Brand/>
      <span className="v4-crumb-sep" aria-hidden>/</span>
      <span className="v4-crumb" title={workspace.startup.name}>{workspace.startup.name}</span>
      {header}
    </header>
    <nav className="obs-rail" aria-label={t("nav.workspace")}>
      <Link href={base} className="obs-rail-dial" aria-label={`${t("nav.overview")}: ${model.completion}%`} tabIndex={-1}>
        <OrbitDial model={model} size={52} label="" center={<span className="obs-rail-num num">{model.completion}</span>}/>
      </Link>
      {nav.map(({ key, label, href, Icon, shortcut }) => {
        const active = isActive(href);
        return <Link key={key} href={href} aria-current={active ? "page" : undefined} className={active ? "is-active" : ""} aria-keyshortcuts={`g ${shortcut}`}>
          {active && <motion.span layoutId="obs-active" className="obs-rail-active" transition={spring}/>}
          <Icon size={19} aria-hidden strokeWidth={1.75}/><span className="obs-rail-label">{t(label)}</span>
        </Link>;
      })}
    </nav>
  </>;
}

/* V2 — Ledger: a quiet masthead with text tabs and an ink underline. */
function LedgerChrome({ workspace, nav, isActive, header }: ChromeProps) {
  const { t } = useDisplay();
  return <header className="v4-topbar led-masthead">
    <div className="led-mast-row">
      <Brand/>
      {header}
    </div>
    <div className="led-mast-row is-nav">
      <p className="led-mast-title"><span className="led-mast-name">{workspace.startup.name}</span><span className="led-mast-meta mono">{workspace.startup.businessModel} · {t(`stage.${workspace.startup.stage}`)} · {workspace.startup.targetMarket}</span></p>
      <nav aria-label={t("nav.workspace")} className="led-tabs">
        {nav.map(({ key, label, href, shortcut }) => {
          const active = isActive(href);
          return <Link key={key} href={href} aria-current={active ? "page" : undefined} className={active ? "is-active" : ""} aria-keyshortcuts={`g ${shortcut}`}>
            {t(label)}{active && <motion.span layoutId="led-ink" className="led-ink" transition={spring}/>}
          </Link>;
        })}
      </nav>
    </div>
  </header>;
}

/* V3 — Flow: the Black Orbit loop as a stage bar; each stage shows its own state. */
function FlowChrome({ workspace, insights, nav, isActive, header }: ChromeProps) {
  const { t } = useDisplay();
  const state: Record<NavItem["key"], string> = {
    overview: workspace.startup.name, strategy: `${insights.counts.sectionsComplete}/5`, dashboard: `${insights.readiness.overall}`,
    roadmap: insights.counts.tasks ? `${insights.counts.done}/${insights.counts.tasks}` : "—", ai: "6",
  };
  return <header className="v4-topbar flow-top">
    <div className="flow-top-row">
      <Brand/>
      <span className="v4-crumb-sep" aria-hidden>/</span>
      <span className="v4-crumb" title={workspace.startup.name}>{workspace.startup.name}</span>
      {header}
    </div>
    <nav aria-label={t("nav.workspace")} className="flow-stages">
      {nav.map(({ key, label, href, Icon, shortcut }, i) => {
        const active = isActive(href);
        return <Link key={key} href={href} aria-current={active ? "page" : undefined} className={`flow-stage ${active ? "is-active" : ""}`} aria-keyshortcuts={`g ${shortcut}`}>
          {i > 0 && <span className="flow-stage-edge" aria-hidden/>}
          <span className="flow-stage-node">{active && <motion.span layoutId="flow-active" className="flow-stage-active" transition={spring}/>}<Icon size={16} aria-hidden strokeWidth={1.75}/></span>
          <span className="flow-stage-text"><span>{t(label)}</span><span className="mono flow-stage-state">{key === "overview" ? <UserRound size={12} aria-hidden/> : state[key]}</span></span>
        </Link>;
      })}
    </nav>
  </header>;
}

function SaveIndicator({ busy, savedAt }: { busy: boolean; savedAt: number | null }) {
  const { t } = useDisplay();
  const [expiredAt, setExpiredAt] = useState(0);
  useEffect(() => {
    if (busy || !savedAt) return;
    const timer = setTimeout(() => setExpiredAt(Date.now()), 2400);
    return () => clearTimeout(timer);
  }, [busy, savedAt]);
  const settled = !!savedAt && savedAt > expiredAt;
  const state = busy ? "busy" : settled ? "saved" : "idle";
  return <span className={`v4-save is-${state}`} aria-hidden="true">
    <span className="v4-save-dot"/>
    <AnimatePresence mode="wait" initial={false}>
      <motion.span key={state} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.16 }}>
        {state === "busy" ? t("chrome.saving") : state === "saved" ? t("chrome.saved") : t("chrome.allSaved")}
      </motion.span>
    </AnimatePresence>
  </span>;
}

function ShareMenu({ startupId, onCopy }: { startupId: string; onCopy: () => void }) {
  const { t } = useDisplay();
  const [open, setOpen] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  return <div className="v4-share" ref={ref}>
    <button type="button" className="v4-icon-button" aria-label={t("chrome.share")} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}><Share2 size={16}/></button>
    <AnimatePresence>{open && <motion.div role="menu" className="v4-popover v4-menu" initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ duration: 0.18, ease }}>
      <button type="button" role="menuitem" onClick={() => { setOpen(false); onCopy(); }}><Link2 size={15} aria-hidden/>{t("chrome.share")}</button>
      <a role="menuitem" href={`/api/startups/${startupId}/export`} download onClick={() => setOpen(false)}><ArrowDownToLine size={15} aria-hidden/>{t("chrome.export")}</a>
    </motion.div>}</AnimatePresence>
  </div>;
}
