"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ArrowDown, ArrowRight, ArrowUp, Eye, EyeOff, GripVertical, LayoutTemplate, RotateCcw } from "lucide-react";
import { dashboardLayoutSchema, sectionSchemas } from "@/lib/domain/schemas";
import { z } from "zod";
import { defaultDashboardLayout, plateCatalog, type DashboardLayout, type DashboardPlate, type DashboardPlateId, type PlateSize } from "@/lib/domain/dashboard";
import type { Task, Workspace } from "@/lib/domain/types";
import { Badge, ErrorNotice, formatTime, Spinner, useDirtyGuard } from "./ui";
import { nextStep, RoadmapBar, SectionSegments } from "./progress";
import { useTaskUpdate } from "./task-actions";
import { spring, useWorkspace } from "./workspace";
import { clearDraft, useDraftRecovery } from "./draft-recovery";

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
  const [draft, setDraft] = useState<DashboardLayout>(saved);
  const [draftRevision, setDraftRevision] = useState(workspace.startup.revision);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [lifted, setLifted] = useState<DashboardPlateId | null>(null);
  const layout = editing ? draft : saved;
  const visible = layout.plates.filter(p => !p.hidden);
  const hidden = layout.plates.filter(p => p.hidden);
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  useDirtyGuard(editing && changed);
  const draftKey = `layout:${workspace.startup.id}`;
  useDraftRecovery(draftKey,{ draft,revision: draftRevision },editing && changed,value => {
    const recovered = z.object({ draft: dashboardLayoutSchema,revision: z.number().int().nonnegative() }).parse(value);
    setDraft(recovered.draft); setDraftRevision(recovered.revision); setEditing(true);
    notify("Unsaved layout restored. Select Done to save it.");
  });

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

  function start() { setDraft(saved); setDraftRevision(workspace.startup.revision); setError(null); setEditing(true); setAnnouncement("Customizing dashboard. Use each plate's move buttons, or pick up a plate with its handle."); }
  function cancel() { if (saving || changed && !window.confirm("Discard your layout changes?")) return; clearDraft(draftKey); setDraft(saved); setEditing(false); setLifted(null); setAnnouncement("Layout changes discarded."); }
  function reset() { if (saving || !window.confirm("Reset the dashboard layout? Your data is not affected.")) return; setDraft(defaultDashboardLayout()); setAnnouncement("Layout reset to default. Select Done to save."); }
  async function done() {
    if (saving) return;
    if (!changed) { setEditing(false); setLifted(null); return; }
    setSaving(true); setError(null);
    const isDefault = JSON.stringify(draft) === JSON.stringify(defaultDashboardLayout());
    try { await savePreferences({ dashboardLayout: isDefault ? null : draft },draftRevision); clearDraft(draftKey); setEditing(false); setLifted(null); notify("Dashboard layout saved"); }
    catch (e) { setError(e as Error); }
    finally { setSaving(false); }
  }

  // Keyboard pick-up: Space/Enter on the handle lifts; arrows move; Space/Enter drops; Escape returns.
  const liftOrigin = useRef<DashboardPlate[] | null>(null);
  function handleKey(e: React.KeyboardEvent, id: DashboardPlateId) {
    if (saving) return;
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
    if (saving) return;
    if (e.button !== 0 || e.pointerType === "touch" && window.matchMedia("(max-width: 767px)").matches) return;
    e.preventDefault();
    const handle = e.currentTarget as HTMLElement; handle.setPointerCapture(e.pointerId);
    const origin = { x: e.clientX, y: e.clientY }; let active = false;
    const onMove = (ev: PointerEvent) => {
      if (!active && Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) < 4) return;
      if (!active) { active = true; setLifted(id); setAnnouncement(`Picked up ${title(id)}.`); }
      const over = document.elementsFromPoint(ev.clientX, ev.clientY).map(el => el.closest<HTMLElement>("[data-plate-id]")).find(el => el && el.dataset.plateId !== id);
      if (over) moveTo(id, over.dataset.plateId as DashboardPlateId);
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove); handle.removeEventListener("pointerup", onUp); handle.removeEventListener("pointercancel", onUp);
      if (active) { setLifted(null); setDraft(d => { setAnnouncement(`${title(id)} dropped at position ${position(d.plates, id)}.`); return d; }); }
    };
    handle.addEventListener("pointermove", onMove); handle.addEventListener("pointerup", onUp); handle.addEventListener("pointercancel", onUp);
  }

  useEffect(() => {
    if (!editing) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !lifted && !(e.target as Element)?.closest("dialog")) cancel(); };
    window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc);
  });

  return <div className={`dashboard ${editing ? "is-editing" : ""}`}>
    <div className="page-heading">
      <div><h1 tabIndex={-1}>Dashboard</h1><p className="lead">How far you are, what you decided, and what is missing.</p></div>
      {!editing && <div className="page-heading-actions"><button className="button small" onClick={start}><LayoutTemplate size={15} aria-hidden/>Customize</button></div>}
    </div>
    <Summary workspace={workspace}/>
    <AnimatePresence>{editing && <motion.div className="customize-bar" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}>
      <p>Customizing. Move plates with the arrows, or drag the handle. Sizes and hiding are saved with this startup.</p>
      <button className="button small ghost" onClick={reset} disabled={saving}><RotateCcw size={14} aria-hidden/>Reset</button>
      <button className="button small" onClick={cancel} disabled={saving}>Cancel</button>
      <button className="button small primary" onClick={done} disabled={saving} aria-busy={saving}>{saving ? <><Spinner/>Saving…</> : "Done"}</button>
    </motion.div>}</AnimatePresence>
    {error && <ErrorNotice error={`Couldn't save the layout. ${error.message}`} onRetry={done}/>}
    <p className="sr-only" aria-live="polite">{announcement}</p>
    <p className="sr-only" id="drag-help">Press Space to pick up the plate, arrow keys to move it, Space to drop it, Escape to cancel.</p>
    <LayoutGroup>
      <div className="plate-grid dashboard-grid">
        {visible.map((p, i) => <motion.div layout="position" transition={spring} key={p.id} data-plate-id={p.id} data-size={p.size}
          className={`plate-frame ${editing ? "editing" : ""} ${lifted === p.id ? "lifted" : ""}`}>
          <PlateBody id={p.id} workspace={workspace} toolbar={editing ? <div className="plate-toolbar" role="group" inert={saving} aria-label={`${plateCatalog[p.id].title} layout controls`}>
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

/** Mandatory summary. Lives outside the customizable plates so required information can never be hidden. */
function Summary({ workspace }: { workspace: Workspace }) {
  const missing = workspace.completion.sections.reduce((n, s) => n + s.missing.length, 0);
  const next = nextStep(workspace);
  return <section className="summary-strip" aria-label="Summary">
    <div><span className="label">Strategy</span><strong className="mono">{workspace.completion.percentage}%</strong><span className="faint">{workspace.completion.completed}/5 complete</span></div>
    <div><span className="label">Missing inputs</span><strong className="mono">{missing}</strong><span className="faint">{missing ? "across sections" : "none"}</span></div>
    <div><span className="label">Roadmap</span><strong className="mono">{workspace.roadmapProgress.done}/{workspace.roadmapProgress.total}</strong><span className="faint">tasks done</span></div>
    <div className="summary-next"><span className="label">Next</span><Link href={next.href} className="summary-next-link">{next.title}<ArrowRight size={15} aria-hidden/></Link></div>
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
function PaperPlate({ title, meta, toolbar, children, foot, id }: { title: string; meta?: ReactNode; toolbar: ReactNode; children: ReactNode; foot?: ReactNode; id: string }) {
  return <section className="plate" aria-labelledby={`plate-${id}`}>{toolbar}
    <div className="plate-head"><h2 id={`plate-${id}`}>{title}</h2>{meta && <span className="plate-meta">{meta}</span>}</div>
    {children}{foot && <div className="plate-foot">{foot}</div>}
  </section>;
}

function ReadoutPlate({ workspace, base, toolbar }: PlateProps) {
  const last = workspace.sections.map(s => s.updatedAt).filter(Boolean).sort().at(-1) ?? null;
  const missing = workspace.completion.sections.reduce((n, s) => n + s.missing.length, 0);
  return <section className="plate instrument" aria-labelledby="plate-readout">{toolbar}
    <span className="screw tl"/><span className="screw tr"/><span className="screw bl"/><span className="screw br"/>
    <div className="plate-head"><h2 id="plate-readout">Strategy readout</h2><span className="plate-meta">{last ? `Updated ${formatTime(last)}` : "Nothing saved yet"}</span></div>
    <div className="screen readout-screen">
      <div><p className="readout xl">{workspace.completion.percentage}<small>%</small></p><p className="muted">{workspace.completion.completed} of 5 sections complete</p></div>
      <div className="readout-segments"><SectionSegments workspace={workspace}/></div>
    </div>
    <div className="readout-rows">
      <p className="inst-row"><span><span className={`led ${missing ? "warn" : ""}`}/> Missing required inputs</span><strong>{missing}</strong></p>
      <p className="inst-row"><span><span className={`led ${workspace.roadmapProgress.total ? "" : "off"}`}/> Roadmap tasks done</span><strong>{workspace.roadmapProgress.done}/{workspace.roadmapProgress.total}</strong></p>
      <p className="inst-row"><span><span className="led off"/> Skipped</span><strong>{workspace.roadmapProgress.skipped}</strong></p>
    </div>
    {workspace.completion.completed === 0 && <div className="plate-foot"><Link className="plate-link" href={`${base}/strategy?section=icp`}>Start with Ideal Customer Profile<ArrowRight size={15} aria-hidden/></Link></div>}
  </section>;
}

function NextPlate({ workspace, base, toolbar }: PlateProps) {
  const fromGaps = workspace.completion.sections.filter(s => !s.complete).map(s => ({ key: s.key, title: s.suggestion, href: `${base}/strategy?section=${s.key}`, tag: s.title }));
  const fromTasks = workspace.tasks.filter(t => !t.archived && (t.status === "todo" || t.status === "in_progress")).sort((a, b) => a.week - b.week)
    .map(t => ({ key: t.id, title: t.title, href: `${base}/roadmap#task-${t.id}`, tag: `Week ${t.week}` }));
  const items = [...fromGaps, ...fromTasks].slice(0, 5);
  return <PaperPlate id="next" title="Next actions" meta={items.length ? `${items.length}` : undefined} toolbar={toolbar}>
    {items.length ? <ol className="action-list">{items.map(i => <li key={i.key}><Link href={i.href}><span className="action-title">{i.title}</span><span className="faint action-tag">{i.tag}</span></Link></li>)}</ol>
      : <p className="plate-empty">Everything required is in place. Review your roadmap progress.</p>}
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
  return <PaperPlate id="decisions" title="Decisions" meta={`${workspace.completion.completed}/5 complete`} toolbar={toolbar}>
    <ul className="decision-list">{workspace.completion.sections.map(s => {
      const saved = workspace.sections.find(x => x.key === s.key)?.revision ?? 0;
      const text = decision(workspace, s.key);
      return <li key={s.key}>
        <div className="decision-name"><span className="decision-title">{s.title}</span><Badge status={s.complete ? "complete" : saved ? "draft" : "empty"}/></div>
        <p className={text ? "decision-text" : "decision-text faint"}>{text || "No decision saved yet"}</p>
        <div className="decision-missing">{s.missing.length ? <><span className="faint">Missing: </span>{s.missing.slice(0, 3).join(", ")}{s.missing.length > 3 ? ` +${s.missing.length - 3}` : ""}</> : null}</div>
        <Link className="plate-link" href={`${base}/strategy?section=${s.key}`} aria-label={`Edit ${s.title}`}>Edit</Link>
      </li>;
    })}</ul>
  </PaperPlate>;
}
function GapsPlate({ workspace, base, toolbar }: PlateProps) {
  const groups = workspace.completion.sections.filter(s => s.missing.length);
  const total = groups.reduce((n, s) => n + s.missing.length, 0);
  return <PaperPlate id="gaps" title="Missing inputs" meta={total ? `${total}` : undefined} toolbar={toolbar}>
    {groups.length ? <div className="gap-groups">{groups.map(s => <div key={s.key}><Link className="gap-section" href={`${base}/strategy?section=${s.key}`}>{s.title}<ArrowRight size={14} aria-hidden/></Link>
      <ul>{s.missing.map(m => <li key={m}>{m}</li>)}</ul></div>)}</div>
      : <p className="plate-empty">All required inputs are filled.</p>}
  </PaperPlate>;
}
function WeekPlate({ workspace, base, toolbar }: PlateProps) {
  const { update,isPending } = useTaskUpdate(); const [error, setError] = useState<string | null>(null);
  const active = workspace.tasks.filter(t => !t.archived);
  const week = [1, 2, 3, 4].find(w => active.some(t => t.week === w && (t.status === "todo" || t.status === "in_progress")));
  const tasks = week ? active.filter(t => t.week === week) : [];
  const toggle = async (t: Task, done: boolean) => {
    setError(null);
    try { await update(t, { status: done ? "done" : "todo" }); } catch (e) { setError(`Couldn't update “${t.title}”. ${(e as Error).message}`); }
  };
  return <PaperPlate id="week" title={week ? `This week · Week ${week}` : "This week"} meta={`${workspace.roadmapProgress.done}/${workspace.roadmapProgress.total} done`} toolbar={toolbar}
    foot={<Link className="plate-link" href={`${base}/roadmap`}>Open roadmap<ArrowRight size={15} aria-hidden/></Link>}>
    <RoadmapBar progress={workspace.roadmapProgress}/>
    {error && <p className="field-error" role="alert">{error}</p>}
    {!active.length ? <p className="plate-empty">No roadmap yet.</p> : !week ? <p className="plate-empty">No open tasks left.</p> :
      <ul className="check-list">{tasks.map(t => <li key={t.id}><label className={t.status === "done" ? "is-done" : ""}><input type="checkbox" checked={t.status === "done"} disabled={t.status === "skipped" || isPending(t.id)} aria-busy={isPending(t.id)} onChange={e => void toggle(t, e.target.checked)}/><span>{t.title}</span></label></li>)}</ul>}
  </PaperPlate>;
}
function RisksPlate({ workspace, base, toolbar }: PlateProps) {
  const list = sectionSchemas.assumptions.parse(workspace.sections.find(s => s.key === "assumptions")?.data ?? {}).assumptions.filter(a => a.statement);
  const high = list.filter(a => a.risk === "high");
  const shown = high.length ? high : list.filter(a => a.risk === "medium").slice(0, 2);
  return <PaperPlate id="risks" title="Risk watch" meta={high.length ? `${high.length} high` : undefined} toolbar={toolbar}
    foot={<Link className="plate-link" href={`${base}/strategy?section=assumptions`}>Edit assumptions<ArrowRight size={15} aria-hidden/></Link>}>
    {shown.length ? <ul className="risk-list">{shown.map((a, i) => <li key={i}><div className="risk-tags"><Badge status={a.risk}/><Badge status="untested"/></div><p>{a.statement}</p>{a.validationMethod && <p className="faint">Test: {a.validationMethod}</p>}</li>)}</ul>
      : <p className="plate-empty">No assumptions recorded yet.</p>}
    {!high.length && shown.length > 0 && <p className="field-help">No high-risk assumptions; showing medium.</p>}
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
