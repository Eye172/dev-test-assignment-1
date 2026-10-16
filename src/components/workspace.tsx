"use client";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { ArrowDownToLine, Check, Compass, LayoutGrid, Link2, Orbit, Route, Settings2, Share2, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { mergeWorkspace } from "@/lib/client-workspace";
import type { Preferences, Startup, Workspace } from "@/lib/domain/types";
import { Brand, Choice, Dialog, ErrorNotice, confirmLeave } from "./ui";

type WorkspaceContext = {
  workspace: Workspace;
  setWorkspace: Dispatch<SetStateAction<Workspace>>;
  refresh: () => Promise<void>;
  notify: (message: string) => void;
  savePreferences: (patch: Partial<Preferences>, expectedRevision?: number) => Promise<void>;
};
const Context = createContext<WorkspaceContext | null>(null);
export function useWorkspace() { const value = useContext(Context); if (!value) throw new Error("Workspace provider missing"); return value; }

export const spring = { type: "spring", stiffness: 420, damping: 38, mass: 0.9 } as const;

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
    setWorkspaceState(current => mergeWorkspace(current,typeof action === "function" ? action(current) : action));
  }, []);
  const [notice, setNotice] = useState("");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [preferenceError, setPreferenceError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const pathname = usePathname(); const router = useRouter();
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const base = `/startups/${workspace.startup.id}`;
  const preferences = workspace.startup.preferences;

  const refresh = useCallback(async () => {
    const latest = await api<Workspace>(`/api/startups/${initial.startup.id}`);
    setWorkspace(latest);
  }, [initial.startup.id,setWorkspace]);
  const notify = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 5000);
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
      if ((e.target as Element)?.closest("input,textarea,select,[contenteditable],dialog") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (prefix) {
        prefix = false;
        const route = ({ o: base, s: `${base}/strategy`, d: `${base}/dashboard`, r: `${base}/roadmap` } as Record<string, string>)[e.key.toLowerCase()];
        if (route) { e.preventDefault(); if (confirmLeave()) router.push(route); }
      } else if (e.key === "g") { prefix = true; clearTimeout(timer); timer = setTimeout(() => { prefix = false; }, 1200); }
      else if (e.key === "?") setPreferencesOpen(true);
    };
    window.addEventListener("keydown", keydown);
    return () => { window.removeEventListener("keydown", keydown); clearTimeout(timer); };
  }, [base, router]);

  const savePreferences = useCallback(async (patch: Partial<Preferences>, expectedRevision = workspace.startup.revision) => {
    setPreferenceError(null); setSaving(true);
    try {
      const startup = await api<Startup>(`/api/startups/${workspace.startup.id}`, { method: "PATCH",
        body: JSON.stringify({ expectedRevision, patch: { preferences: { ...workspace.startup.preferences, ...patch } } }) });
      setWorkspace(current => ({ ...current, startup }));
    } catch (error) { setPreferenceError(error as Error); throw error; }
    finally { setSaving(false); }
  }, [workspace.startup,setWorkspace]);

  const nav = [
    { name: "Overview", href: base, Icon: Orbit, key: "O" },
    { name: "Strategy", href: `${base}/strategy`, Icon: Compass, key: "S" },
    { name: "Dashboard", href: `${base}/dashboard`, Icon: LayoutGrid, key: "D" },
    { name: "Roadmap", href: `${base}/roadmap`, Icon: Route, key: "R" },
  ];
  const isActive = (href: string) => href === base ? pathname === base : pathname.startsWith(href);
  async function copyLink() {
    const url = `${location.origin}${base}`;
    try { await navigator.clipboard.writeText(url); notify("Workspace link copied"); } catch { setShareUrl(url); }
  }

  return <Context.Provider value={{ workspace, setWorkspace, refresh, notify, savePreferences }}>
    <MotionConfig reducedMotion={preferences.motion === "reduced" ? "always" : "user"} skipAnimations={preferences.motion === "reduced" || !!systemReducedMotion} transition={spring}>
      <div className="app-surface" {...themeAttributes(preferences)}>
        <header className="site-header">
          <Brand/>
          <span className="header-context" title={workspace.startup.name}>{workspace.startup.name}</span>
          {/* One navigation landmark: inline in the header on wide screens, a fixed tab bar on phones. */}
          <nav className="workspace-nav" aria-label="Workspace">
            {nav.map(({ name, href, Icon, key }) => {
              const active = isActive(href);
              return <Link href={href} key={name} aria-current={active ? "page" : undefined} className={active ? "active" : ""} aria-keyshortcuts={`g ${key.toLowerCase()}`}>
                {active && <motion.span layoutId="nav-active" className="nav-active" transition={spring}/>}
                <Icon size={17} aria-hidden/><span>{name}</span>
              </Link>;
            })}
          </nav>
          <div className="header-actions">
            <details className="demo-details">
              <summary className="demo-tag" aria-label="Demo mode: about this data">Demo</summary>
              <p>No login. Data is synthetic and stored in the demo database. Anyone with this workspace link can view and edit it, so keep sensitive information out.</p>
            </details>
            <ShareMenu startupId={workspace.startup.id} onCopy={copyLink}/>
            <button className="icon-button" onClick={() => setPreferencesOpen(true)} aria-label="Workspace preferences" aria-keyshortcuts="?"><Settings2 size={19}/></button>
          </div>
        </header>
        <main id="content" className="workspace-main">{children}</main>
        <Dialog open={preferencesOpen} onClose={() => setPreferencesOpen(false)} title="Workspace preferences">
          <p className="muted">Saved with this startup. Your device’s reduced-motion setting is always respected.</p>
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
              <div><dt><kbd>G</kbd> then <kbd>O</kbd> <kbd>S</kbd> <kbd>D</kbd> <kbd>R</kbd></dt><dd>Overview, Strategy, Dashboard, Roadmap</dd></div>
              <div><dt><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>S</kbd></dt><dd>Save the open editor</dd></div>
              <div><dt><kbd>?</kbd></dt><dd>Open these preferences</dd></div>
            </dl>
          </div>
          <p role="status" className="field-help">{saving ? "Saving preferences…" : ""}</p>
        </Dialog>
        <Dialog open={!!shareUrl} onClose={() => setShareUrl("")} title="Share this workspace">
          <p className="muted">Copy the link below. Anyone with it can view and edit this synthetic demo.</p>
          <input className="input" value={shareUrl} readOnly onFocus={e => e.target.select()} aria-label="Workspace URL"/>
        </Dialog>
        <AnimatePresence>{notice && <motion.div className="toast" role="status" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6, transition: { duration: 0.14 } }}>
          <Check size={16} aria-hidden/>{notice}
          <button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={16}/></button>
        </motion.div>}</AnimatePresence>
      </div>
    </MotionConfig>
  </Context.Provider>;
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
    <AnimatePresence>{open && <motion.div id={menuId} role="menu" aria-labelledby={`${menuId}-trigger`} className="menu-pop" initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}>
      <button type="button" role="menuitem" tabIndex={-1} onClick={() => { close(); onCopy(); }}><Link2 size={16} aria-hidden/>Copy workspace link</button>
      <a role="menuitem" tabIndex={-1} href={`/api/startups/${startupId}/export`} download onClick={close}><ArrowDownToLine size={16} aria-hidden/>Export workspace as JSON</a>
    </motion.div>}</AnimatePresence>
  </div>;
}
