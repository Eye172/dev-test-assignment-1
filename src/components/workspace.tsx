"use client";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { ArrowDownToLine, Check, Compass, LayoutGrid, Link2, Moon, Orbit, Route, Search, Settings2, Share2, Sparkles, Sun, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { mergeWorkspace } from "@/lib/client-workspace";
import type { Preferences, Startup, Workspace } from "@/lib/domain/types";
import { Brand, Choice, Dialog, ErrorNotice, confirmLeave, useMedia } from "./ui";
import { OrbitDial, useOrbitModel } from "./orbit";
import { CommandPalette } from "./command-palette";

type WorkspaceContext = {
  workspace: Workspace;
  setWorkspace: Dispatch<SetStateAction<Workspace>>;
  refresh: () => Promise<void>;
  notify: (message: string) => void;
  savePreferences: (patch: Partial<Preferences>, expectedRevision?: number) => Promise<void>;
  /** Report a write in flight so the top bar can show one honest save state for the whole workspace. */
  track: <T>(work: Promise<T>) => Promise<T>;
  openPalette: () => void;
};
const Context = createContext<WorkspaceContext | null>(null);
export function useWorkspace() { const value = useContext(Context); if (!value) throw new Error("Workspace provider missing"); return value; }

export const spring = { type: "spring", stiffness: 420, damping: 36, mass: 0.9 } as const;
export const softSpring = { type: "spring", stiffness: 260, damping: 30 } as const;
export const easeOut = [0.23, 1, 0.32, 1] as const;

export function themeAttributes(preferences: Pick<Preferences, "theme" | "accent" | "density" | "motion">) {
  return {
    "data-theme": preferences.theme === "system" ? undefined : preferences.theme,
    "data-theme-system": preferences.theme === "system" ? "" : undefined,
    "data-accent": preferences.accent, "data-density": preferences.density, "data-motion": preferences.motion,
  };
}

export function WorkspaceShell({ initial, children }: { initial: Workspace; children: ReactNode }) {
  const systemReducedMotion = useReducedMotion();
  const [workspace, setWorkspaceState] = useState(initial);
  const setWorkspace: Dispatch<SetStateAction<Workspace>> = useCallback(action => {
    setWorkspaceState(current => mergeWorkspace(current, typeof action === "function" ? action(current) : action));
  }, []);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [preferenceError, setPreferenceError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [inFlight, setInFlight] = useState(0);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const pathname = usePathname(); const router = useRouter();
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const base = `/startups/${workspace.startup.id}`;
  const preferences = workspace.startup.preferences;
  const model = useOrbitModel(workspace);

  const refresh = useCallback(async () => {
    const latest = await api<Workspace>(`/api/startups/${initial.startup.id}`);
    setWorkspace(latest);
  }, [initial.startup.id, setWorkspace]);
  const notify = useCallback((text: string) => {
    setNotice({ id: Date.now(), text });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5000);
  }, []);
  const track = useCallback(async <T,>(work: Promise<T>) => {
    setInFlight(n => n + 1);
    try { const result = await work; setLastSaved(Date.now()); return result; }
    finally { setInFlight(n => n - 1); }
  }, []);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);
  useEffect(() => { document.querySelector<HTMLElement>("main h1")?.focus({ preventScroll: true }); }, [pathname]);

  // Mirror preferences on <html> so the page background, scrollbars and overscroll match the theme.
  useEffect(() => {
    const root = document.documentElement;
    const attrs = themeAttributes(preferences);
    for (const [key, value] of Object.entries(attrs)) { if (value === undefined) root.removeAttribute(key); else root.setAttribute(key, value); }
    return () => { for (const key of Object.keys(attrs)) root.removeAttribute(key); };
  }, [preferences]);

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
      else if (e.key === "?") setPreferencesOpen(true);
      else if (e.key === "/") { e.preventDefault(); setPaletteOpen(true); }
    };
    window.addEventListener("keydown", keydown);
    return () => { window.removeEventListener("keydown", keydown); clearTimeout(timer); };
  }, [base, router]);

  const savePreferences = useCallback(async (patch: Partial<Preferences>, expectedRevision = workspace.startup.revision) => {
    setPreferenceError(null); setSaving(true);
    try {
      const startup = await track(api<Startup>(`/api/startups/${workspace.startup.id}`, { method: "PATCH",
        body: JSON.stringify({ expectedRevision, patch: { preferences: { ...workspace.startup.preferences, ...patch } } }) }));
      setWorkspace(current => ({ ...current, startup }));
    } catch (error) { setPreferenceError(error as Error); throw error; }
    finally { setSaving(false); }
  }, [workspace.startup, setWorkspace, track]);

  const nav = [
    { name: "Overview", href: base, Icon: Orbit, key: "O" },
    { name: "Strategy", href: `${base}/strategy`, Icon: Compass, key: "S" },
    { name: "Dashboard", href: `${base}/dashboard`, Icon: LayoutGrid, key: "D" },
    { name: "Roadmap", href: `${base}/roadmap`, Icon: Route, key: "R" },
    { name: "AI", href: `${base}/ai`, Icon: Sparkles, key: "A" },
  ];
  const isActive = (href: string) => href === base ? pathname === base : pathname.startsWith(href);
  const copyLink = useCallback(async () => {
    const url = `${location.origin}${base}`;
    try { await navigator.clipboard.writeText(url); notify("Workspace link copied"); } catch { setShareUrl(url); }
  }, [base, notify]);
  const prefersDark = useMedia("(prefers-color-scheme: dark)");
  const dark = preferences.theme === "dark" || preferences.theme === "system" && prefersDark;
  const toggleTheme = useCallback(() => { void savePreferences({ theme: dark ? "light" : "dark" }).catch(() => {}); }, [dark, savePreferences]);

  return <Context.Provider value={{ workspace, setWorkspace, refresh, notify, savePreferences, track, openPalette: () => setPaletteOpen(true) }}>
    <MotionConfig reducedMotion={preferences.motion === "reduced" ? "always" : "user"} skipAnimations={preferences.motion === "reduced" || !!systemReducedMotion} transition={spring}>
      <div className="app-surface workspace-surface" {...themeAttributes(preferences)}>
        <header className="topbar">
          <Brand/>
          <span className="topbar-slash" aria-hidden>/</span>
          <span className="header-context" title={workspace.startup.name}>{workspace.startup.name}</span>
          <SaveIndicator busy={inFlight > 0} savedAt={lastSaved}/>
          <div className="topbar-actions">
            <button type="button" className="search-trigger" onClick={() => setPaletteOpen(true)} aria-keyshortcuts="Control+K Meta+K">
              <Search size={16} aria-hidden/><span className="search-text">Jump to…</span><kbd aria-hidden>⌘K</kbd>
            </button>
            <details className="demo-details">
              <summary className="demo-tag" aria-label="Demo mode: about this data"><span className="demo-dot" aria-hidden/>Demo</summary>
              <p>No login. Data is synthetic and stored in the demo database. Anyone with this workspace link can view and edit it, so keep sensitive information out.</p>
            </details>
            <button type="button" className="icon-button theme-toggle" onClick={toggleTheme} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={dark ? "moon" : "sun"} initial={{ rotate: -90, opacity: 0, scale: 0.6 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 90, opacity: 0, scale: 0.6 }} transition={{ duration: 0.22, ease: easeOut }}>
                  {dark ? <Moon size={18}/> : <Sun size={18}/>}
                </motion.span>
              </AnimatePresence>
            </button>
            <ShareMenu startupId={workspace.startup.id} onCopy={copyLink}/>
            <button className="icon-button" onClick={() => setPreferencesOpen(true)} aria-label="Workspace preferences" aria-keyshortcuts="?"><Settings2 size={19}/></button>
          </div>
        </header>

        {/* One navigation landmark: a floating rail on wide screens, a thumb dock on phones. */}
        <nav className="workspace-nav" aria-label="Workspace">
          <Link href={base} className="rail-dial" aria-label={`Progress: strategy ${model.completion}%`} tabIndex={-1}>
            <OrbitDial model={model} size={52} label="" center={<span className="rail-dial-num num">{model.completion}</span>}/>
          </Link>
          {nav.map(({ name, href, Icon, key }) => {
            const active = isActive(href);
            return <Link href={href} key={name} aria-current={active ? "page" : undefined} className={active ? "active" : ""} aria-keyshortcuts={`g ${key.toLowerCase()}`}>
              {active && <motion.span layoutId="nav-active" className="nav-active" transition={spring}/>}
              <Icon size={20} aria-hidden strokeWidth={1.8}/><span className="nav-label">{name}</span>
            </Link>;
          })}
        </nav>

        <main id="content" className="workspace-main">{children}</main>

        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} workspace={workspace} base={base}
          actions={{ copyLink: () => void copyLink(), toggleTheme, preferences: () => setPreferencesOpen(true) }}/>

        <Dialog open={preferencesOpen} onClose={() => setPreferencesOpen(false)} title="Workspace preferences">
          <p className="muted">Saved with this startup, so every device opens it the same way. Your device’s reduced-motion setting is always respected.</p>
          <fieldset disabled={saving} className="preference-fields">
            <Choice label="Appearance" name="theme" value={preferences.theme} options={["dark", "light", "system"] as const} onChange={theme => void savePreferences({ theme }).catch(() => {})}/>
            <Choice label="Accent" name="accent" value={preferences.accent} options={["green", "lime", "blue"] as const} onChange={accent => void savePreferences({ accent }).catch(() => {})}/>
            <Choice label="Density" name="density" value={preferences.density} options={["comfortable", "compact"] as const} onChange={density => void savePreferences({ density }).catch(() => {})}/>
            <Choice label="Motion" name="motion" value={preferences.motion} options={["full", "reduced"] as const} onChange={motion => void savePreferences({ motion }).catch(() => {})}/>
          </fieldset>
          <ErrorNotice error={preferenceError} onReload={() => void refresh().then(() => setPreferenceError(null))}/>
          <div className="shortcuts">
            <h3>Keyboard</h3>
            <dl>
              <div><dt><kbd>Ctrl</kbd>/<kbd>⌘</kbd> <kbd>K</kbd></dt><dd>Jump to anything</dd></div>
              <div><dt><kbd>G</kbd> then <kbd>O</kbd> <kbd>S</kbd> <kbd>D</kbd> <kbd>R</kbd></dt><dd>Overview, Strategy, Dashboard, Roadmap</dd></div>
              <div><dt><kbd>Ctrl</kbd>/<kbd>⌘</kbd> <kbd>S</kbd></dt><dd>Save the open editor</dd></div>
              <div><dt><kbd>?</kbd></dt><dd>Open these preferences</dd></div>
            </dl>
          </div>
          <p role="status" className="field-help">{saving ? "Saving preferences…" : ""}</p>
        </Dialog>
        <Dialog open={!!shareUrl} onClose={() => setShareUrl("")} title="Share this workspace">
          <p className="muted">Copy the link below. Anyone with it can view and edit this synthetic demo.</p>
          <input className="input" value={shareUrl} readOnly onFocus={e => e.target.select()} aria-label="Workspace URL"/>
        </Dialog>
        <div className="toast-region" aria-live="polite">
          <AnimatePresence>{notice && <motion.div key={notice.id} className="toast" role="status" layout
            initial={{ opacity: 0, y: -20, scale: 0.9, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, scale: 0.96, transition: { duration: 0.16 } }} transition={{ type: "spring", stiffness: 500, damping: 32 }}>
            <span className="toast-check"><Check size={14} aria-hidden strokeWidth={3}/></span>{notice.text}
            <button className="icon-button small" aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={15}/></button>
          </motion.div>}</AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  </Context.Provider>;
}

/** Workspace-wide save state: a dot that pulses while any write is in flight and settles to a check. */
function SaveIndicator({ busy, savedAt }: { busy: boolean; savedAt: number | null }) {
  // "Saved" shows for a moment after the latest write settles, then quietly becomes "Synced".
  const [expiredAt, setExpiredAt] = useState(0);
  useEffect(() => {
    if (busy || !savedAt) return;
    const t = setTimeout(() => setExpiredAt(Date.now()), 2400);
    return () => clearTimeout(t);
  }, [busy, savedAt]);
  const settled = !!savedAt && savedAt > expiredAt;
  const state = busy ? "busy" : settled ? "saved" : "idle";
  return <span className={`save-indicator ${state}`} aria-hidden="true">
    <span className="save-dot"/>
    <AnimatePresence mode="wait" initial={false}>
      <motion.span key={state} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
        {state === "busy" ? "Saving" : state === "saved" ? "Saved" : "Synced"}
      </motion.span>
    </AnimatePresence>
  </span>;
}

/** Share and export live in one small header menu, out of the navigation's way. */
function ShareMenu({ startupId, onCopy }: { startupId: string; onCopy: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();
  function close() { setOpen(false); root.current?.querySelector<HTMLButtonElement>("button")?.focus(); }
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (!root.current?.contains(e.target as Node)) return;
      if (e.key === "Tab") { close(); return; }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      const items = Array.from(root.current.querySelectorAll<HTMLElement>("[role=menuitem]"));
      const current = items.indexOf(document.activeElement as HTMLElement);
      const index = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (current + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[index]?.focus();
    };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", key);
    root.current?.querySelector<HTMLElement>("[role=menu] a, [role=menu] button")?.focus();
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", key); };
  }, [open]);
  return <div className="share-menu" ref={root}>
    <button id={`${menuId}-trigger`} type="button" className="icon-button" aria-label="Share and export" aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(o => !o)}><Share2 size={18}/></button>
    <AnimatePresence>{open && <motion.div id={menuId} role="menu" aria-labelledby={`${menuId}-trigger`} className="menu-pop" initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }} transition={{ duration: 0.18, ease: easeOut }}>
      <button type="button" role="menuitem" tabIndex={-1} onClick={() => { close(); onCopy(); }}><Link2 size={16} aria-hidden/>Copy workspace link</button>
      <a role="menuitem" tabIndex={-1} href={`/api/startups/${startupId}/export`} download onClick={close}><ArrowDownToLine size={16} aria-hidden/>Export workspace as JSON</a>
    </motion.div>}</AnimatePresence>
  </div>;
}
