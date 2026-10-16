"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowDownToLine, ChartNoAxesCombined, Check, Copy, LayoutDashboard, Route, Settings2, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/client-api";
import type { Preferences, Startup, Workspace } from "@/lib/domain/types";
import { Brand, Choice, Dialog, ErrorNotice } from "./ui";

type WorkspaceContext = { workspace: Workspace;refresh: () => Promise<void>;notify: (message: string) => void;savePreferences: (patch: Partial<Preferences>) => Promise<void> };
const Context = createContext<WorkspaceContext | null>(null);
export function useWorkspace() { const value = useContext(Context); if (!value) throw new Error("Workspace provider missing"); return value; }
export function WorkspaceShell({ initial,children }: { initial: Workspace;children: ReactNode }) {
  const [workspace,setWorkspace] = useState(initial);
  const [notice,setNotice] = useState(""); const [preferencesOpen,setPreferencesOpen] = useState(false);
  const [preferenceError,setPreferenceError] = useState<Error | null>(null); const [saving,setSaving] = useState(false);
  const [shareUrl,setShareUrl] = useState("");
  const pathname = usePathname(); const router = useRouter(); const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const base = `/startups/${workspace.startup.id}`;
  const refresh = useCallback(async () => { setWorkspace(await api<Workspace>(`/api/startups/${initial.startup.id}`)); },[initial.startup.id]);
  const notify = useCallback((message: string) => { setNotice(message); if (noticeTimer.current) clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setNotice(""),5500); },[]);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); },[]);
  useEffect(() => { document.querySelector<HTMLElement>("main h1")?.focus({ preventScroll: true }); },[pathname]);
  useEffect(() => {
    let prefix = false;
    const keydown = (e: KeyboardEvent) => {
      if ((e.target as Element)?.closest("input,textarea,select,[contenteditable],dialog") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (prefix) { prefix = false; const route = { o: base,s: `${base}/strategy`,d: `${base}/dashboard`,r: `${base}/roadmap` }[e.key as "o"]; if (route) { e.preventDefault(); router.push(route); } }
      else if (e.key === "g") prefix = true;
      else if (e.key === "?") setPreferencesOpen(true);
    };
    window.addEventListener("keydown",keydown); return () => window.removeEventListener("keydown",keydown);
  },[base,router]);
  async function savePreferences(patch: Partial<Preferences>) {
    setPreferenceError(null); setSaving(true);
    try {
      const startup = await api<Startup>(`/api/startups/${workspace.startup.id}`,{ method: "PATCH",body: JSON.stringify({ expectedRevision: workspace.startup.revision,patch: { preferences: { ...workspace.startup.preferences,...patch } } }) });
      setWorkspace(current => ({ ...current,startup })); notify("Workspace preferences saved");
    } catch (error) { setPreferenceError(error as Error); throw error; } finally { setSaving(false); }
  }
  const preferences = workspace.startup.preferences;
  const nav = [{ name: "Overview",href: base,Icon: LayoutDashboard },{ name: "Strategy",href: `${base}/strategy`,Icon: SlidersHorizontal },{ name: "Dashboard",href: `${base}/dashboard`,Icon: ChartNoAxesCombined },{ name: "Roadmap",href: `${base}/roadmap`,Icon: Route }];
  async function copyLink() { const url = `${location.origin}${base}`; try { await navigator.clipboard.writeText(url); notify("Workspace link copied"); } catch { setShareUrl(url); } }
  return <Context.Provider value={{ workspace,refresh,notify,savePreferences }}><MotionConfig reducedMotion={preferences.motion === "reduced" ? "always" : "user"} transition={{ type: "spring",stiffness: 360,damping: 36 }}><div className="app-surface" data-theme={preferences.theme === "system" ? undefined : preferences.theme} data-accent={preferences.accent} data-density={preferences.density} data-motion={preferences.motion}>
    <header className="site-header"><Brand/><span className="header-context">{workspace.startup.name}</span><div className="header-actions"><details className="demo-details"><summary className="demo-tag">Demo mode</summary><p>Synthetic demonstration data. Anyone with this workspace link can view and edit it. Please keep sensitive information out.</p></details><button className="icon-button" onClick={() => setPreferencesOpen(true)} aria-label="Workspace preferences"><Settings2 size={19}/></button></div></header>
    <main id="content" className="workspace-main">{children}</main>
    <nav className="workspace-dock" aria-label="Workspace navigation">{nav.map(({ name,href,Icon }) => <Link href={href} key={name} aria-current={pathname === href ? "page" : undefined} className={pathname === href ? "active" : ""}>{pathname === href && <motion.span layoutId="nav-active" className="dock-active"/>}<Icon size={19}/><span>{name}</span></Link>)}<span className="dock-divider"/><button onClick={copyLink} aria-label="Copy workspace link"><Copy size={18}/></button><a href={`/api/startups/${workspace.startup.id}/export`} aria-label="Export workspace JSON" download><ArrowDownToLine size={18}/></a></nav>
    <Dialog open={preferencesOpen} onClose={() => setPreferencesOpen(false)} title="Make space for your way of working"><p className="muted">Saved with this startup. Your device's reduced-motion setting is always respected.</p><fieldset disabled={saving} className="preference-fields"><Choice label="Appearance" name="theme" value={preferences.theme} options={["dark","light","system"]} onChange={theme => void savePreferences({ theme }).catch(() => {})}/><Choice label="Accent" name="accent" value={preferences.accent} options={["green","lime","blue"]} onChange={accent => void savePreferences({ accent }).catch(() => {})}/><Choice label="Density" name="density" value={preferences.density} options={["comfortable","compact"]} onChange={density => void savePreferences({ density }).catch(() => {})}/><Choice label="Motion" name="motion" value={preferences.motion} options={["full","reduced"]} onChange={motion => void savePreferences({ motion }).catch(() => {})}/></fieldset><ErrorNotice error={preferenceError} onReload={() => void refresh().then(() => setPreferenceError(null))}/><p className="field-help">Keyboard: G then O / S / D / R to navigate. Ctrl/⌘ + S saves an open editor. ? opens this panel.</p><div role="status" className="muted">{saving ? "Saving preferences…" : ""}</div></Dialog>
    <Dialog open={!!shareUrl} onClose={() => setShareUrl("")} title="Share this workspace"><p className="muted">Anyone with the link can view and edit this synthetic demo.</p><input value={shareUrl} readOnly onFocus={e => e.target.select()} aria-label="Workspace URL"/></Dialog>
    <AnimatePresence>{notice && <motion.div className="toast" role="status" initial={{ opacity: 0,y: 8 }} animate={{ opacity: 1,y: 0 }} exit={{ opacity: 0,y: 5 }}><Check size={16}/>{notice}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice("")}>×</button></motion.div>}</AnimatePresence>
  </div></MotionConfig></Context.Provider>;
}
