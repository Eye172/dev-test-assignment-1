"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ArrowDown, ArrowRight, ArrowUp, Check, Eye, EyeOff, GripVertical, LayoutTemplate, RotateCcw } from "lucide-react";
import { sectionSchemas } from "@/lib/domain/schemas";
import { defaultDashboardLayout, plateCatalog, type DashboardLayout, type DashboardPlate, type DashboardPlateId, type PlateSize } from "@/lib/domain/dashboard";
import type { Task, Workspace } from "@/lib/domain/types";
import { Badge, ErrorNotice, Spinner, useDirtyGuard, useHydrated } from "./ui";
import { nextStep, SectionSegments } from "./progress";
import { RoadmapBar } from "./roadmap";
import { useTaskPending, useTaskUpdate } from "./task-actions";
import { spring, useWorkspace } from "./workspace";

const weekDays = (w: number) => w === 4 ? "Days 22–30" : `Days ${(w - 1) * 7 + 1}–${w * 7}`;
const sizeNames: Record<PlateSize, string> = { S: "One third", M: "Half", L: "Two thirds", XL: "Full width" };

function normalize(layout: DashboardLayout | null | undefined): DashboardLayout {
  const base = defaultDashboardLayout();
  if (!layout) return base;
  const known = layout.plates.filter(p => p.id in plateCatalog);
  const missing = base.plates.filter(p => !known.some(k => k.id === p.id));
  return { version: 1, plates: [...known, ...missing] };
}

export function Dashboard() {
  const { workspace, savePreferences, notify } = useWorkspace();
  const saved = useMemo(() => normalize(workspace.startup.preferences.dashboardLayout), [workspace.startup.preferences.dashboardLayout]);
  const [editing, setEditing] = useState(false);
  const hydrated = useHydrated();
  const [draft, setDraft] = useState<DashboardLayout>(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [lifted, setLifted] = useState<DashboardPlateId | null>(null);
  const layout = editing ? draft : saved;
  const visible = layout.plates.filter(p => !p.hidden);
  const hidden = layout.plates.filter(p => p.hidden);
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  useDirtyGuard(editing && changed);

  const title = (id: DashboardPlateId) => plateCatalog[id].title;
  const position = (plates: DashboardPlate[], id: DashboardPlateId) => plates.filter(p => !p.hidden).findIndex(p => p.id === id) + 1;

  const move = useCallback((id: DashboardPlateId, delta: number, announce = true) => {
    setDraft(d => {
      const vis = d.plates.filter(p => !p.hidden);
      const from = vis.findIndex(p => p.id === id); const to = from + delta;
      if (from < 0 || to < 0 || to >= vis.length) return d;
      const nextVis = [...vis]; const [item] = nextVis.splice(from, 1); nextVis.splice(to, 0, item);
      const plates = [...nextVis, ...d.plates.filter(p => p.hidden)];
      if (announce) setAnnouncement(`${title(id)} moved to position ${to + 1} of ${vis.length}.`);
      return { ...d, plates };
    });
  }, []);
  const moveTo = useCallback((id: DashboardPlateId, targetId: DashboardPlateId) => {
    setDraft(d => {
      const vis = d.plates.filter(p => !p.hidden);
      const from = vis.findIndex(p => p.id === id); const to = vis.findIndex(p => p.id === targetId);
      if (from < 0 || to < 0 || from === to) return d;
      const nextVis = [...vis]; const [item] = nextVis.splice(from, 1); nextVis.splice(to, 0, item);
      return { ...d, plates: [...nextVis, ...d.plates.filter(p => p.hidden)] };
    });
  }, []);
  const patch = (id: DashboardPlateId, change: Partial<DashboardPlate>) => setDraft(d => {
    let plates = d.plates.map(p => p.id === id ? { ...p, ...change } : p);
    if (change.hidden !== undefined) plates = [...plates.filter(p => !p.hidden), ...plates.filter(p => p.hidden)];
    return { ...d, plates };
  });

  function start() { setDraft(saved); setError(null); setEditing(true); setAnnouncement("Customizing dashboard. Use each plate's move buttons, or pick up a plate with its handle."); }
  function cancel() { if (changed && !window.confirm("Discard your layout changes?")) return; setDraft(saved); setEditing(false); setLifted(null); setAnnouncement("Layout changes discarded."); }
  function reset() { if (!window.confirm("Reset the dashboard layout? Your data is not affected.")) return; setDraft(defaultDashboardLayout()); setAnnouncement("Layout reset to default. Select Done to save."); }
  async function done() {
    if (!changed) { setEditing(false); setLifted(null); return; }
    setSaving(true); setError(null);
    const isDefault = JSON.stringify(draft) === JSON.stringify(defaultDashboardLayout());
    try { await savePreferences({ dashboardLayout: isDefault ? null : draft }); setEditing(false); setLifted(null); notify("Dashboard layout saved"); }
    catch (e) { setError(e as Error); }
    finally { setSaving(false); }
  }

  // Keyboard pick-up: Space/Enter on the handle lifts; arrows move; Space/Enter drops; Escape returns.
  const liftOrigin = useRef<DashboardPlate[] | null>(null);
  function handleKey(e: React.KeyboardEvent, id: DashboardPlateId) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (lifted === id) { setLifted(null); liftOrigin.current = null; setAnnouncement(`${title(id)} dropped at position ${position(draft.plates, id)} of ${visible.length}.`); }
      else { setLifted(id); liftOrigin.current = draft.plates; setAnnouncement(`Picked up ${title(id)}, position ${position(draft.plates, id)} of ${visible.length}. Use arrow keys to move, Space to drop, Escape to cancel.`); }
    } else if (lifted === id && ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(e.key)) {
      e.preventDefault(); move(id, e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 1);
    } else if (lifted === id && e.key === "Escape") {
      e.preventDefault(); e.stopPropagation();
      if (liftOrigin.current) setDraft(d => ({ ...d, plates: liftOrigin.current! }));
      setLifted(null); setAnnouncement(`Move cancelled. ${title(id)} returned to its position.`);
    }
  }
  // Pointer drag on the handle: the plate snaps into whichever slot the pointer is over.
  function handlePointerDown(e: React.PointerEvent, id: DashboardPlateId) {
    if (e.button !== 0 || e.pointerType === "touch" && window.matchMedia("(max-width: 767px)").matches) return;
    e.preventDefault();
    // Listen on window, not the handle: reordering moves the handle's DOM node, which drops pointer capture.
    const pointerId = e.pointerId;
    const origin = { x: e.clientX, y: e.clientY }; let active = false; let last = origin;
    // Hysteresis: after a swap the neighbour animates through the pointer; ignore it until the layout spring settles,
    // otherwise the two plates swap back and forth.
    let lastTarget: string | undefined; let settledAt = 0;
    const retarget = (x: number, y: number) => {
      const over = document.elementsFromPoint(x, y).map(el => el.closest<HTMLElement>("[data-plate-id]")).find(el => el && el.dataset.plateId !== id);
      const target = over?.dataset.plateId;
      const now = performance.now();
      if (!target || now < settledAt || target === lastTarget && now < settledAt + 250) return;
      lastTarget = target; settledAt = now + 280;
      moveTo(id, target as DashboardPlateId);
    };
    // Edge auto-scroll, so a plate can be dragged to a slot below or above the visible area.
    const edge = 72;
    const scroller = window.setInterval(() => {
      if (!active) return;
      const speed = last.y > window.innerHeight - edge ? 14 : last.y < edge + 64 ? -14 : 0;
      if (speed) { window.scrollBy(0, speed); retarget(last.x, last.y); }
    }, 16);
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      last = { x: ev.clientX, y: ev.clientY };
      if (!active && Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) < 4) return;
      if (!active) { active = true; setLifted(id); setAnnouncement(`Picked up ${title(id)}.`); }
      retarget(ev.clientX, ev.clientY);
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.clearInterval(scroller);
      window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); window.removeEventListener("pointercancel", onUp);
      if (!active) return;
      setLifted(null);
      const ids = [...document.querySelectorAll<HTMLElement>("[data-plate-id]")].map(el => el.dataset.plateId);
      setAnnouncement(`${title(id)} dropped at position ${ids.indexOf(id) + 1} of ${ids.length}.`);
    };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp); window.addEventListener("pointercancel", onUp);
  }

  useEffect(() => {
    if (!editing) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !lifted && !(e.target as Element)?.closest("dialog")) cancel(); };
    window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc);
  });

  return <div className={`dashboard ${editing ? "is-editing" : ""}`}>
    <div className="page-heading">
      <div><h1 tabIndex={-1}>Dashboard</h1><p className="lead">This week’s work first, then your riskiest belief, decisions and gaps.</p></div>
      {!editing && <div className="page-heading-actions"><button className="button small" onClick={start}><LayoutTemplate size={15} aria-hidden/>Customize</button></div>}
    </div>
    <Summary workspace={workspace}/>
    <AnimatePresence>{editing && <motion.div className="customize-bar" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}>
      <p>Customizing. Move plates with the arrows, or drag the handle. Sizes and hiding are saved with this startup.</p>
      <button className="button small ghost" onClick={reset}><RotateCcw size={14} aria-hidden/>Reset</button>
      <button className="button small" onClick={cancel} disabled={saving}>Cancel</button>
      <button className="button small primary" onClick={done} disabled={saving} aria-busy={saving}>{saving ? <><Spinner/>Saving…</> : "Done"}</button>
    </motion.div>}</AnimatePresence>
    {error && <ErrorNotice error={`Couldn't save the layout. ${error.message}`} onRetry={done}/>}
    <p className="sr-only" aria-live="polite">{announcement}</p>
    <p className="sr-only" id="drag-help">Press Space to pick up the plate, arrow keys to move it, Space to drop it, Escape to cancel.</p>
    <LayoutGroup>
      <div className="plate-grid dashboard-grid">
        {visible.map((p, i) => <motion.div layout="position" key={p.id} data-plate-id={p.id} data-size={p.size}
          initial={hydrated ? { opacity: 0, y: 10 } : false} animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, opacity: { duration: 0.24, delay: Math.min(i, 5) * 0.04 }, y: { duration: 0.32, ease: [0.23, 1, 0.32, 1], delay: Math.min(i, 5) * 0.04 } }}
          className={`plate-frame ${editing ? "editing" : ""} ${lifted === p.id ? "lifted" : ""}`}>
          <PlateBody id={p.id} workspace={workspace} toolbar={editing ? <div className="plate-toolbar" role="group" aria-label={`${plateCatalog[p.id].title} layout controls`}>
            <button type="button" className="icon-button drag-handle" aria-roledescription="sortable plate" aria-describedby="drag-help" aria-pressed={lifted === p.id}
              aria-label={`Move ${plateCatalog[p.id].title}, position ${i + 1} of ${visible.length}`} onKeyDown={e => handleKey(e, p.id)} onPointerDown={e => handlePointerDown(e, p.id)}><GripVertical size={16}/></button>
            <button type="button" className="icon-button" disabled={i === 0} aria-label={`Move ${plateCatalog[p.id].title} earlier`} onClick={() => move(p.id, -1)}><ArrowUp size={16}/></button>
            <button type="button" className="icon-button" disabled={i === visible.length - 1} aria-label={`Move ${plateCatalog[p.id].title} later`} onClick={() => move(p.id, 1)}><ArrowDown size={16}/></button>
            {p.id !== "readout" && <button type="button" className="icon-button" aria-label={`Hide ${plateCatalog[p.id].title}`} onClick={() => { patch(p.id, { hidden: true }); setAnnouncement(`${plateCatalog[p.id].title} hidden. Restore it from Hidden plates.`); }}><EyeOff size={16}/></button>}
            <div className="sizes" role="group" aria-label="Size">{plateCatalog[p.id].allowedSizes.map(s => <button type="button" key={s} aria-pressed={p.size === s} title={sizeNames[s]} aria-label={`${plateCatalog[p.id].title}: ${sizeNames[s]}`} onClick={() => patch(p.id, { size: s })}>{s}</button>)}</div>
          </div> : null}/>
        </motion.div>)}
      </div>
    </LayoutGroup>
    {editing && <section className="hidden-tray" aria-labelledby="tray-title">
      <h2 id="tray-title" className="label">Hidden plates ({hidden.length})</h2>
      {hidden.length ? <ul>{hidden.map(p => <li key={p.id}>{plateCatalog[p.id].title}<button type="button" className="button small" onClick={() => { patch(p.id, { hidden: false }); setAnnouncement(`${plateCatalog[p.id].title} shown at the end.`); }}><Eye size={14} aria-hidden/>Show</button></li>)}</ul>
        : <p className="field-help">Nothing hidden. Hidden plates stay here; they are never deleted.</p>}
    </section>}
  </div>;
}

/** Mandatory summary: one quiet line outside the hideable plates, so required information never disappears. */
function Summary({ workspace }: { workspace: Workspace }) {
  const missing = workspace.completion.sections.reduce((n, s) => n + s.missing.length, 0);
  const next = nextStep(workspace);
  const p = workspace.roadmapProgress;
  return <section className="summary-line" aria-label="Summary">
    <span className="summary-item"><span className="faint">Inputs</span> <strong className="num">{workspace.completion.percentage}%</strong></span>
    <span className="summary-item"><span className="faint">Missing</span> <strong className="num">{missing}</strong></span>
    <span className="summary-item"><span className="faint">Plan</span> <strong className="num">{p.done}/{p.total - p.skipped}</strong></span>
    <Link href={next.href} className="summary-next"><span className="faint">Next</span> <span className="summary-next-title">{next.title}</span><ArrowRight size={14} aria-hidden/></Link>
  </section>;
}

function PlateBody({ id, workspace, toolbar }: { id: DashboardPlateId; workspace: Workspace; toolbar: ReactNode }) {
  const base = `/startups/${workspace.startup.id}`;
  const props = { workspace, base, toolbar };
  switch (id) {
    case "readout": return <ReadoutPlate {...props}/>;
    case "next": return <NextPlate {...props}/>;
    case "decisions": return <DecisionsPlate {...props}/>;
    case "gaps": return <GapsPlate {...props}/>;
    case "week": return <WeekPlate {...props}/>;
    case "risks": return <RisksPlate {...props}/>;
    case "channels": return <ChannelsPlate {...props}/>;
    case "profile": return <ProfilePlate {...props}/>;
  }
}
type PlateProps = { workspace: Workspace; base: string; toolbar: ReactNode };
function PaperPlate({ title, meta, toolbar, children, foot, id, className = "" }: { title: string; meta?: ReactNode; toolbar: ReactNode; children: ReactNode; foot?: ReactNode; id: string; className?: string }) {
  // While customizing (toolbar present) the content is a preview: inert keeps Tab on the layout controls.
  return <section className={`plate ${className}`} aria-labelledby={`plate-${id}`}>{toolbar}
    <div className="plate-body" inert={toolbar ? true : undefined}>
      <div className="plate-head"><h2 id={`plate-${id}`}>{title}</h2>{meta && <span className="plate-meta">{meta}</span>}</div>
      {children}{foot && <div className="plate-foot">{foot}</div>}
    </div>
  </section>;
}

/** The current week's open work. Its first open task is the focus; the rest are a quick checklist. */
function currentWeek(workspace: Workspace) {
  const active = workspace.tasks.filter(t => !t.archived);
  const week = [1, 2, 3, 4].find(w => active.some(t => t.week === w && (t.status === "todo" || t.status === "in_progress")));
  return { week, tasks: week ? active.filter(t => t.week === week) : [] };
}

function ReadoutPlate({ workspace, toolbar }: PlateProps) {
  const c = workspace.completion; const p = workspace.roadmapProgress;
  const assumptions = sectionSchemas.assumptions.parse(workspace.sections.find(s => s.key === "assumptions")?.data ?? {}).assumptions.filter(a => a.statement);
  const high = assumptions.filter(a => a.risk === "high").length;
  const filled = c.completed === 5;
  // Filled inputs are a starting line, not the achievement: once complete, execution takes the large figure.
  return <section className={`plate instrument readout-plate ${filled ? "is-filled" : ""}`} aria-labelledby="plate-readout">{toolbar}
    <div className="plate-body" inert={toolbar ? true : undefined}>
    <div className="plate-head"><h2 id="plate-readout">Strategy readout</h2><span className="plate-meta">{filled ? "Inputs complete" : `${c.completed} of 5 inputs complete`}</span></div>
    {filled ? <>
      <p className="readout xl">{p.percentage}<small>%</small></p>
      <p className="inst-caption">of plan tasks done · {p.done} of {p.total - p.skipped}{p.skipped ? ` · ${p.skipped} skipped` : ""}</p>
      <div className="readout-inputs"><span className="inst-caption">Inputs 5/5</span><SectionSegments workspace={workspace} labels={false}/></div>
    </> : <>
      <p className="readout xl">{c.percentage}<small>%</small></p>
      <p className="inst-caption">inputs complete. Filled inputs make a plan possible; they do not prove it.</p>
      <div className="readout-inputs wide"><SectionSegments workspace={workspace}/></div>
    </>}
    <p className="inst-row"><span>Untested assumptions</span><strong>{assumptions.length}{high ? ` · ${high} high risk` : ""}</strong></p>
    </div>
  </section>;
}

function NextPlate({ workspace, base, toolbar }: PlateProps) {
  const { week } = currentWeek(workspace);
  const fromGaps = workspace.completion.sections.filter(s => !s.complete).map(s => ({ key: s.key, title: s.suggestion, href: `${base}/strategy?section=${s.key}`, tag: s.title }));
  // This week's tasks already live in the active-work plate; this list looks further ahead.
  const later = workspace.tasks.filter(t => !t.archived && t.week !== week && (t.status === "todo" || t.status === "in_progress")).sort((a, b) => a.week - b.week)
    .map(t => ({ key: t.id, title: t.title, href: `${base}/roadmap#task-${t.id}`, tag: `Week ${t.week}` }));
  const items = [...fromGaps, ...later].slice(0, 5);
  return <PaperPlate id="next" title="Coming up" meta={items.length ? `${items.length}` : undefined} toolbar={toolbar}>
    {items.length ? <ol className="action-list">{items.map(i => <li key={i.key}><Link href={i.href}><span className="action-title">{i.title}</span><span className="faint action-tag">{i.tag}</span></Link></li>)}</ol>
      : <p className="plate-empty">Nothing queued beyond this week.</p>}
  </PaperPlate>;
}

function decision(workspace: Workspace, key: string): string {
  const data = workspace.sections.find(s => s.key === key)?.data;
  if (!data) return "";
  switch (key) {
    case "icp": { const d = sectionSchemas.icp.parse(data); return [d.buyerType, d.industry].filter(Boolean).join(" · "); }
    case "value": { const d = sectionSchemas.value.parse(data); return d.outcome || d.problem; }
    case "channels": { const d = sectionSchemas.channels.parse(data); return d.channels.map(c => c.name).filter(Boolean).join(", "); }
    case "pricing": { const d = sectionSchemas.pricing.parse(data); return [d.initialPrice && d.paymentUnit ? `${d.initialPrice} per ${d.paymentUnit}` : d.initialPrice, d.model].filter(Boolean).join(" · "); }
    case "assumptions": { const d = sectionSchemas.assumptions.parse(data).assumptions.filter(a => a.statement); const high = d.filter(a => a.risk === "high").length; return d.length ? `${d.length} untested${high ? ` · ${high} high risk` : ""}` : ""; }
  }
  return "";
}
function DecisionsPlate({ workspace, base, toolbar }: PlateProps) {
  return <PaperPlate id="decisions" title="Decisions" meta={`${workspace.completion.completed}/5 inputs complete`} toolbar={toolbar}>
    <ul className="decision-list">{workspace.completion.sections.map(s => {
      const saved = workspace.sections.find(x => x.key === s.key)?.revision ?? 0;
      const text = decision(workspace, s.key);
      const state = s.complete ? "complete" : saved ? "draft" : "empty";
      return <li key={s.key} className={state}>
        <span className="decision-dot" aria-hidden/>
        <div className="decision-body">
          <span className="decision-title">{s.title}<span className="sr-only">: {state === "complete" ? "complete" : state === "draft" ? "draft" : "not started"}</span></span>
          <p className={text ? "decision-text" : "decision-text faint"}>{text || "No decision saved yet"}</p>
          {s.missing.length > 0 && <p className="decision-missing">Missing: {s.missing.slice(0, 2).join(", ")}{s.missing.length > 2 ? ` +${s.missing.length - 2}` : ""}</p>}
        </div>
        <Link className="plate-link" href={`${base}/strategy?section=${s.key}`} aria-label={`Edit ${s.title}`}>Edit</Link>
      </li>;
    })}</ul>
  </PaperPlate>;
}
function GapsPlate({ workspace, base, toolbar }: PlateProps) {
  const groups = workspace.completion.sections.filter(s => s.missing.length);
  const total = groups.reduce((n, s) => n + s.missing.length, 0);
  return <PaperPlate id="gaps" title="Missing inputs" meta={total ? `${total}` : undefined} toolbar={toolbar} className={total ? "" : "is-quiet"}>
    {groups.length ? <div className="gap-groups">{groups.map(s => <div key={s.key}><Link className="gap-section" href={`${base}/strategy?section=${s.key}`}>{s.title}<ArrowRight size={14} aria-hidden/></Link>
      <ul>{s.missing.map(m => <li key={m}>{m}</li>)}</ul></div>)}</div>
      : <p className="plate-empty with-icon"><Check size={15} aria-hidden/>All required inputs are filled.</p>}
  </PaperPlate>;
}
function WeekPlate({ workspace, base, toolbar }: PlateProps) {
  const update = useTaskUpdate(); const [error, setError] = useState<string | null>(null);
  const { week, tasks } = currentWeek(workspace);
  const active = workspace.tasks.filter(t => !t.archived);
  const focus = tasks.find(t => t.status === "in_progress") ?? tasks.find(t => t.status === "todo");
  const rest = tasks.filter(t => t !== focus);
  const set = async (t: Task, status: Task["status"]) => {
    setError(null);
    try { await update(t, { status }); } catch (e) { setError(`Couldn't update “${t.title}”. ${(e as Error).message}`); }
  };
  return <PaperPlate id="week" className="active-work" title={week ? `This week · Week ${week}` : "This week"} meta={week ? weekDays(week) : undefined} toolbar={toolbar}
    foot={<><RoadmapBar progress={workspace.roadmapProgress}/><Link className="plate-link" href={`${base}/roadmap`}>Open roadmap<ArrowRight size={15} aria-hidden/></Link></>}>
    {error && <p className="field-error" role="alert">{error}</p>}
    {!active.length ? <div className="focus-empty"><p className="focus-title">No plan yet.</p><p className="muted">Generate a 30-day plan from whatever strategy you have saved.</p><Link className="button small primary" href={`${base}/roadmap`}>Open roadmap</Link></div>
      : !focus ? <p className="plate-empty">Every open task is done or skipped. Review your evidence and refresh the plan.</p>
      : <>
        <div className="focus-task">
          <span className="label">{focus.status === "in_progress" ? "In progress" : "Focus"}</span>
          <p className="focus-title">{focus.title}</p>
          <p className="focus-deliverable">{focus.deliverable}</p>
          <FocusActions task={focus} onSet={set}/>
        </div>
        {rest.length > 0 && <ul className="check-list">{rest.map(t => <WeekCheck key={t.id} task={t} onSet={set}/>)}</ul>}
      </>}
  </PaperPlate>;
}
function FocusActions({ task, onSet }: { task: Task; onSet: (t: Task, s: Task["status"]) => Promise<void> }) {
  const busy = useTaskPending(task.id);
  return <div className="focus-actions">
    {task.status === "todo" && <button type="button" className="button small" disabled={busy} onClick={() => void onSet(task, "in_progress")}>Start</button>}
    <button type="button" className="button small primary" disabled={busy} aria-busy={busy} onClick={() => void onSet(task, "done")}>{busy ? <><Spinner/>Saving…</> : <><Check size={15} aria-hidden/>Mark done</>}</button>
  </div>;
}
function WeekCheck({ task, onSet }: { task: Task; onSet: (t: Task, s: Task["status"]) => Promise<void> }) {
  const busy = useTaskPending(task.id);
  return <li><label className={task.status === "done" ? "is-done" : ""}>
    <input type="checkbox" checked={task.status === "done"} disabled={busy || task.status === "skipped"} onChange={e => void onSet(task, e.target.checked ? "done" : "todo")}/>
    <span>{task.title}{task.status === "skipped" && <span className="faint"> · skipped</span>}</span>
  </label></li>;
}
function RisksPlate({ workspace, base, toolbar }: PlateProps) {
  const list = sectionSchemas.assumptions.parse(workspace.sections.find(s => s.key === "assumptions")?.data ?? {}).assumptions.filter(a => a.statement);
  const order = { high: 0, medium: 1, low: 2 } as const;
  const sorted = [...list].sort((a, b) => order[a.risk] - order[b.risk]);
  const top = sorted[0];
  return <PaperPlate id="risks" className="risk-inset" title="Riskiest belief" meta={list.length ? `${list.length} untested` : undefined} toolbar={toolbar}
    foot={<Link className="plate-link" href={`${base}/strategy?section=assumptions`}>Edit assumptions<ArrowRight size={15} aria-hidden/></Link>}>
    {top ? <div className="risk-top">
      <div className="risk-tags"><Badge status={top.risk}/><Badge status="untested"/></div>
      <p className="risk-statement">{top.statement}</p>
      {top.validationMethod && <p className="faint risk-method">Test: {top.validationMethod}</p>}
      {sorted.length > 1 && <p className="field-help">{sorted.length - 1} more untested.</p>}
    </div> : <p className="plate-empty">No assumptions recorded yet.</p>}
  </PaperPlate>;
}
function ChannelsPlate({ workspace, base, toolbar }: PlateProps) {
  const d = sectionSchemas.channels.parse(workspace.sections.find(s => s.key === "channels")?.data ?? {});
  const names = d.channels.filter(c => c.name);
  return <PaperPlate id="channels" title="Channel experiment" toolbar={toolbar} foot={<Link className="plate-link" href={`${base}/strategy?section=channels`}>Edit channels<ArrowRight size={15} aria-hidden/></Link>}>
    {names.length ? <ul className="chip-list">{names.map(c => <li key={c.name}>{c.name}</li>)}</ul> : <p className="plate-empty">No channels chosen yet.</p>}
    {d.firstExperiment && <p className="experiment">{d.firstExperiment}</p>}
  </PaperPlate>;
}
function ProfilePlate({ workspace, base, toolbar }: PlateProps) {
  const s = workspace.startup;
  return <PaperPlate id="profile" title="Profile snapshot" toolbar={toolbar} foot={<Link className="plate-link" href={base}>Open overview<ArrowRight size={15} aria-hidden/></Link>}>
    <dl className="mini-facts"><div><dt>Model</dt><dd>{s.businessModel}</dd></div><div><dt>Stage</dt><dd>{s.stage}</dd></div><div><dt>Market</dt><dd>{s.targetMarket}</dd></div><div><dt>Segment</dt><dd>{s.customerSegment}</dd></div></dl>
  </PaperPlate>;
}
