"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion, useDragControls } from "motion/react";
import { Archive, ArchiveRestore, Columns3, GripVertical, Info, List, Pencil, Plus, RefreshCw } from "lucide-react";
import { z } from "zod";
import { api, ClientError } from "@/lib/client-api";
import type { RoadmapProgress, Task, Workspace } from "@/lib/domain/types";
import { Badge, Dialog, ErrorNotice, Field, Spinner, useDirtyGuard, useHydrated, useMedia } from "./ui";
import { clearDraft, clearSubmittedDraft, useDraftRecovery, useHasDraft } from "./draft-recovery";
import { useTaskPending, useTaskUpdate } from "./task-actions";
import { spring, useWorkspace } from "./workspace";
import { useDevicePref } from "./device-prefs";
import { Counter, planDay, weekDone } from "./orbit";
import { StatusRing } from "./status-ring";

const statusLabels = { todo: "To do", in_progress: "In progress", done: "Done", skipped: "Skipped" } as const;
const weekDays = (w: number) => w === 4 ? "Days 22–30" : `Days ${(w - 1) * 7 + 1}–${w * 7}`;
const taskDraftSchema = z.object({ title: z.string(), deliverable: z.string(), week: z.number().int().min(1).max(4), notes: z.string() });

/** Human names for generation rules. Internal identifiers never reach the interface. */
export function ruleName(key: string | null): string | null {
  if (!key) return null;
  if (key.startsWith("channel:")) return "Channel experiment";
  return ({
    "icp-prepare": "Define the first buyer", "icp-interviews": "Customer interviews",
    "value-prepare": "Write a testable promise", "value-customer-test": "Test the promise with customers",
    "experiment-design": "Success criteria first", "channel-selection": "Choose one channel",
    "assumption-prepare": "Name the assumptions", "assumption-experiment": "Test the riskiest assumption",
    "pricing-prepare": "Pricing hypothesis", "pricing-offer-test": "Willingness-to-pay test",
    "evidence-review": "Evidence review", "founder-decision": "Founder decision",
  } as Record<string, string>)[key] ?? "Plan rule";
}
const rules: [string, string, string][] = [
  ["Week 1", "Buyer", "If your ideal customer profile is complete: interview five target buyers. If not: define the buyer, pain and trigger first."],
  ["Week 1", "Value", "If your value proposition is complete: test the promise with customers. If not: write one that can be tested."],
  ["Week 1", "Success criteria", "Always: set audience, sample, deadline and a pass/fail threshold before the first experiment."],
  ["Week 2", "Channels", "One small experiment per named channel, up to three. No channel yet: choose one."],
  ["Week 2", "Assumptions", "Test the highest-risk saved assumption. None saved: write three testable ones."],
  ["Week 3", "Pricing", "If pricing is complete: test willingness to pay with a real offer. If not: define the pricing hypothesis."],
  ["Week 4", "Evidence", "Always: separate opinions, interest and commitments, and name the bottleneck."],
  ["Week 4", "Decision", "Always: the founder decides to continue, change or stop, based on evidence."],
];

/** Canonical roadmap progress: done ÷ actionable (skipped excluded), with skipped shown separately. */
export function RoadmapBar({ progress }: { progress: RoadmapProgress }) {
  const actionable = progress.total - progress.skipped;
  return <div className="roadmap-bar">
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percentage}
      aria-label={`Roadmap ${progress.percentage}%: ${progress.done} of ${actionable} actionable tasks done${progress.skipped ? `, ${progress.skipped} skipped` : ""}`}>
      <span style={{ width: `${progress.percentage}%` }}/>
    </div>
    <p className="roadmap-bar-label num"><span>{progress.done} of {actionable} done · {progress.percentage}%</span>{progress.skipped > 0 && <span className="faint">{progress.skipped} skipped, not counted</span>}</p>
  </div>;
}

export function Roadmap() {
  const { workspace, setWorkspace, notify, track } = useWorkspace();
  const search = useSearchParams();
  const hydrated = useHydrated();
  const wide = useMedia("(min-width: 1100px)");
  const [view, setView] = useDevicePref<"board" | "list">("roadmap-view", "board");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [adding, setAdding] = useState(() => search.get("add") === "1");
  const [dropWeek, setDropWeek] = useState<number | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const { update } = useTaskUpdate();
  const active = workspace.tasks.filter(t => !t.archived);
  const archived = workspace.tasks.filter(t => t.archived);
  const p = workspace.roadmapProgress;
  const incomplete = workspace.completion.sections.filter(s => !s.complete);
  const board = view === "board";
  const canDrag = board && wide && hydrated;

  useEffect(() => {
    const id = location.hash.slice(1);
    if (id) { const el = document.getElementById(id); el?.scrollIntoView({ block: "center" }); el?.classList.add("flash"); }
  }, []);

  async function generate() {
    if (workspace.activePlan ? !window.confirm("Switch to the rule-based plan? Untouched pending AI suggestions move to history. Completed, edited, custom and in-progress work stays; review any overlaps after switching.") : active.length && !window.confirm("Refresh the plan from your current strategy? Completed tasks, your edits and custom tasks are kept. Tasks that no longer apply move to Archived.")) return;
    setGenerating(true); setError(null);
    try { const ws = await track(api<Workspace>(`/api/startups/${workspace.startup.id}/roadmap`, { method: "POST",...(workspace.activePlan?{body:JSON.stringify({replaceAiPlan:true,expectedPlanId:workspace.activePlan.id})}:{}) })); setWorkspace(ws); notify(active.length ? "Plan refreshed from your strategy" : "30-day plan generated"); }
    catch (e) { setError(e as Error); }
    finally { setGenerating(false); }
  }
  async function moveToWeek(task: Task, week: number) {
    if (task.week === week) return;
    setMoveError(null);
    try { await track(update(task, { week }, `Moved to week ${week}`)); }
    catch (e) { setMoveError(`Couldn't move “${task.title}”. ${(e as Error).message}`); }
  }

  return <div className="roadmap">
    <div className="page-heading">
      <div><p className="eyebrow">Thirty days</p><h1 tabIndex={-1}>30-day roadmap</h1><p className="lead">{workspace.activePlan?`Your reviewed AI plan${workspace.activePlan.conditional?", with disclosed resource uncertainties":""}. Superseded suggestions stay in history.`:"Built by visible rules from your saved strategy. Statuses, edits and moves are yours; refreshing never erases them."}</p></div>
      <div className="page-heading-actions">
        {active.length > 0 && <div className="view-switch" role="group" aria-label="Roadmap view">
          <button type="button" aria-pressed={board} disabled={!hydrated} onClick={() => setView("board")}>{board && <motion.span layoutId="view-active" className="view-active" transition={spring}/>}<Columns3 size={15} aria-hidden/><span>Board</span></button>
          <button type="button" aria-pressed={!board} disabled={!hydrated} onClick={() => setView("list")}>{!board && <motion.span layoutId="view-active" className="view-active" transition={spring}/>}<List size={15} aria-hidden/><span>List</span></button>
        </div>}
        <button className="button small ghost" onClick={() => setRulesOpen(true)}><Info size={15} aria-hidden/>How tasks are chosen</button>
        {active.length > 0 && <button className="button small" onClick={() => setAdding(true)}><Plus size={15} aria-hidden/>Add task</button>}
        <button className={`button small ${active.length ? "" : "primary"}`} onClick={generate} disabled={generating} aria-busy={generating}>{generating ? <><Spinner/>Working…</> : <><RefreshCw size={15} aria-hidden/>{workspace.activePlan?"Switch to rule plan":active.length ? "Refresh plan" : "Generate plan"}</>}</button>
      </div>
    </div>
    {error && <ErrorNotice error={`Couldn't generate the plan. ${error.message}`} onRetry={generate}/>}

    {!active.length ? <section className="roadmap-empty instrument">
      <div className="empty-track" aria-hidden>{Array.from({ length: 30 }, (_, i) => <span key={i} style={{ animationDelay: `${i * 40}ms` }}/>)}</div>
      <h2>No plan yet</h2>
      <p>The plan adapts to whatever you have saved. Generate it now and refresh after you complete more of your strategy.</p>
      {incomplete.length > 0 && <p className="field-help">Incomplete: {incomplete.map(s => s.title).join(", ")}. Those tasks will start with defining the missing inputs. <Link className="text-link" href={`/startups/${workspace.startup.id}/strategy?section=${incomplete[0].key}`}>Complete strategy</Link></p>}
      <button className="button primary" onClick={generate} disabled={generating}>{generating ? <><Spinner/>Generating…</> : "Generate 30-day plan"}</button>
    </section> : <>
      <ProgressTrack progress={p} tasks={workspace.tasks} activePlanCreatedAt={workspace.activePlan?.createdAt}/>
      {moveError && <p className="field-error" role="alert">{moveError}</p>}
      <LayoutGroup>
        <div className={`weeks ${board ? "board" : "list"} ${dropWeek ? "dragging" : ""}`}>{[1, 2, 3, 4].map(w => {
          const tasks = active.filter(t => t.week === w);
          const done = tasks.filter(t => t.status === "done").length;
          const actionable = tasks.filter(t => t.status !== "skipped").length;
          return <section key={w} className={`week-col ${dropWeek === w ? "drop" : ""}`} data-week={w} aria-labelledby={`week-${w}`}>
            <header className="week-head">
              <span className="week-num" aria-hidden>{w}</span>
              <div><h2 id={`week-${w}`}>Week {w}</h2><p className="week-days">{weekDays(w)}</p></div>
              <span className="week-count num">{done}/{actionable}</span>
              <span className="week-meter" aria-hidden><span style={{ transform: `scaleX(${actionable ? done / actionable : 0})` }}/></span>
            </header>
            <ul className="task-list">
              <AnimatePresence initial={false}>{tasks.map((t, i) => <motion.li layout layoutId={`task-${t.id}`} transition={spring} key={t.id} id={`task-${t.id}`}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { ...spring, delay: Math.min(i, 4) * 0.03 } }} exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.14 } }}>
                <TaskCard task={t} compact={!board} draggable={canDrag} onDropWeek={week => void moveToWeek(t, week)} onHoverWeek={setDropWeek}/>
              </motion.li>)}</AnimatePresence>
              {!tasks.length && <li className="week-empty">{canDrag ? "Drop a task here" : "No tasks this week."}</li>}
            </ul>
          </section>;
        })}</div>
      </LayoutGroup>
      {archived.length > 0 && <details className="disclosure archived">
        <summary>Archived ({archived.length})</summary>
        <ul className="archived-list">{archived.map(t => <ArchivedRow key={t.id} task={t}/>)}</ul>
      </details>}
    </>}

    <Dialog open={rulesOpen} onClose={() => setRulesOpen(false)} title="How tasks are chosen">
      <p className="muted">Fixed rules read your saved strategy, so the same inputs always produce the same plan. No AI is involved.</p>
      <ul className="rule-list">{rules.map(([week, name, text]) => <li key={name}><span className="rule-name"><span className="label">{week}</span>{name}</span><span>{text}</span></li>)}</ul>
      <p className="field-help">Refreshing keeps completed tasks, your edits, moves and custom tasks. Tasks that no longer apply are archived, not deleted.</p>
    </Dialog>
    <AddTaskDialog open={adding} onClose={() => setAdding(false)} onRecover={() => setAdding(true)}/>
  </div>;
}

/** 30 day cells in four weeks, lit by finished work, with a marker on today's plan day. */
function ProgressTrack({ progress: p, tasks, activePlanCreatedAt }: { progress: RoadmapProgress; tasks: Task[]; activePlanCreatedAt?:string }) {
  const hydrated = useHydrated();
  const weeks = weekDone(tasks);
  const day = hydrated ? planDay(tasks.filter(t => !t.archived),activePlanCreatedAt) : null;
  return <section className="roadmap-readout instrument" aria-label="Roadmap progress">
    <div className="readout-main">
      <p className="readout xl"><Counter value={p.percentage}/><small>%</small></p>
      <p className="inst-caption">of actionable tasks done</p>
    </div>
    <dl className="readout-stats">
      <div><dt>Done</dt><dd className="num">{p.done}/{p.total - p.skipped}</dd></div>
      <div><dt>Skipped</dt><dd className="num">{p.skipped}</dd></div>
      <div><dt>Plan day</dt><dd className="num">{day ?? "–"}<small>/30</small></dd></div>
    </dl>
    <div className="day-track" aria-hidden>
      {[1, 2, 3, 4].map(w => {
        const n = w === 4 ? 9 : 7; const lit = Math.round(weeks[w - 1] * n);
        return <div className="day-week" key={w} style={{ flexGrow: n }}>
          <span className="day-week-label">W{w}</span>
          <div className="day-cells">{Array.from({ length: n }, (_, i) => {
            const d = (w - 1) * 7 + i + 1;
            return <span key={i} className={`day-cell ${i < lit ? "lit" : ""} ${day === d ? "today" : ""}`} style={{ transitionDelay: `${i * 30}ms` }}>{day === d && <motion.i layoutId="today" className="today-mark"/>}</span>;
          })}</div>
        </div>;
      })}
    </div>
    <p className="readout-note">Skipped tasks are not counted. Completing tasks is activity, not market validation.</p>
  </section>;
}

function TaskCard({ task, compact, draggable, onDropWeek, onHoverWeek }: { task: Task; compact: boolean; draggable: boolean; onDropWeek: (week: number) => void; onHoverWeek: (w: number | null) => void }) {
  const hydrated = useHydrated();
  const { update } = useTaskUpdate();
  const busy = useTaskPending(task.id);
  const { workspace } = useWorkspace();
  const controls = useDragControls();
  const draftKey = `task:${workspace.startup.id}:${task.id}`;
  const [editingOpen, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const lastWeek = useRef<number | null>(null);
  // A task draft left behind by Back/Forward or a reload reopens its editor.
  const draftWaiting = useHasDraft(draftKey);
  const editing = editingOpen || draftWaiting;
  async function run(patch: Parameters<typeof update>[1], message?: string) {
    setError(null);
    try { await update(task, patch, message); } catch (e) { setError((e as Error).message); }
  }
  const weekAt = (x: number, y: number) => {
    const col = document.elementsFromPoint(x, y).map(el => el.closest<HTMLElement>("[data-week]")).find(Boolean);
    return col ? Number(col.dataset.week) : null;
  };
  const rule = task.source === "generated" ? ruleName(task.ruleKey) : null;
  return <motion.article className={`task-card status-${task.status} ${editing ? "is-editing" : ""} ${compact ? "compact" : ""} ${dragging ? "dragging" : ""}`}
    aria-label={editing ? "Edit task" : undefined} aria-labelledby={editing ? undefined : `t-${task.id}`} aria-busy={busy || undefined}
    drag={draggable && !editing && !busy} dragControls={controls} dragListener={false} dragSnapToOrigin dragElastic={0.9}
    whileDrag={{ scale: 1.04, rotate: 1.2, zIndex: 50, boxShadow: "var(--lift-shadow)" }}
    onDragStart={() => setDragging(true)}
    onDrag={(_, info) => { const w = weekAt(info.point.x - scrollX, info.point.y - scrollY); if (w !== lastWeek.current) { lastWeek.current = w; onHoverWeek(w); } }}
    onDragEnd={(_, info) => { setDragging(false); onHoverWeek(null); lastWeek.current = null; const w = weekAt(info.point.x - scrollX, info.point.y - scrollY); if (w && w !== task.week) onDropWeek(w); }}>
    <AnimatePresence mode="popLayout" initial={false}>
      {editing ? <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}>
        <TaskEditor task={task} onDone={() => setEditing(false)} onReloaded={() => setEditing(true)}/>
      </motion.div> : <motion.div key="view" className="task-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}>
        <div className="task-top">
          {draggable && <button type="button" className="task-grip" aria-hidden tabIndex={-1} onPointerDown={e => { e.preventDefault(); controls.start(e); }}><GripVertical size={15}/></button>}
          <StatusRing task={task} disabled={busy || !hydrated} label={`Done: ${task.title}`} onToggle={status => void run({ status })}/>
          <h3 id={`t-${task.id}`} className="task-title">{task.title}</h3>
        </div>
        {!compact && <p className="task-deliverable"><span className="label">Deliverable</span>{task.deliverable}</p>}
        {task.notes && !compact && <p className="task-notes">{task.notes}</p>}
        {task.experiment&&!compact&&<details className="task-experiment"><summary>Experiment decision criteria</summary><dl><dt>Success</dt><dd>{task.experiment.measurement.success}</dd><dt>Failure</dt><dd>{task.experiment.measurement.failure}</dd><dt>Inconclusive</dt><dd>{task.experiment.measurement.inconclusive}</dd><dt>Sample and deadline</dt><dd>{task.experiment.measurement.minimumSample??"Not specified"} {task.experiment.measurement.unit} · day {task.experiment.measurement.deadlineDay}</dd><dt>Resource estimate</dt><dd>{task.experiment.effortMinutes??"Unknown"} minutes · {task.experiment.costs.map(c=>`${c.currency} ${c.amount??"unknown"}`).join(" + ")||"No cash outlay proposed"}</dd></dl><p className="field-help">{task.edited?"Task scope or schedule was edited. These are the accepted experiment criteria; review their fit before executing.":"Completion records activity. Judge the outcome against these criteria and record an observation in Research & decisions."}</p></details>}
        {error && <p className="field-error" role="alert">{error} The change was undone.</p>}
        <div className="task-actions">
          <label className="sr-only" htmlFor={`s-${task.id}`}>Status for {task.title}</label>
          <select id={`s-${task.id}`} className={`status-select ${task.status}`} value={task.status} disabled={busy || !hydrated}
            onChange={e => void run({ status: e.target.value as Task["status"] })}>
            {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {busy && <Spinner/>}
          {task.source === "custom" && <Badge status="custom"/>}{task.edited && task.source !== "custom" && <span className="badge">Edited</span>}
          {task.source==="ai"&&<span className="badge">Reviewed AI proposal</span>}
          {rule && task.rationale && !compact && <details className="why"><summary>Why this task</summary><p>{task.rationale}</p><p className="faint rule-label">Rule: {rule}</p></details>}
          <span className="task-buttons">
            <button type="button" className="icon-button small" aria-label={`Edit ${task.title}`} disabled={busy || !hydrated} onClick={() => setEditing(true)}><Pencil size={15}/></button>
            <button type="button" className="icon-button small" aria-label={`Archive ${task.title}`} disabled={busy || !hydrated} onClick={() => void run({ archived: true }, "Task archived")}><Archive size={15}/></button>
          </span>
        </div>
      </motion.div>}
    </AnimatePresence>
  </motion.article>;
}

type TaskDraft = { title: string; deliverable: string; week: number; notes: string };
function TaskEditor({ task, onDone, onReloaded }: { task: Task; onDone: () => void; onReloaded: () => void }) {
  const { update } = useTaskUpdate();
  const { workspace, setWorkspace } = useWorkspace();
  const [d, setD] = useState({ title: task.title, deliverable: task.deliverable, week: task.week, notes: task.notes });
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(task.revision);
  const [baseline, setBaseline] = useState(JSON.stringify(d));
  const dirty = JSON.stringify(d) !== baseline;
  useDirtyGuard(dirty);
  const draftKey = `task:${task.startupId}:${task.id}`;
  useDraftRecovery(draftKey, { d, revision, baseline }, dirty, value => {
    const recovered = z.object({ d: taskDraftSchema, revision: z.number().int().nonnegative(), baseline: z.string() }).parse(value);
    setD(recovered.d); setRevision(recovered.revision); setBaseline(recovered.baseline);
  });
  function cancel() { if (!saving && (!dirty || window.confirm("Discard task edits?"))) { clearDraft(draftKey); onDone(); } }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (saving) return;
    if (!d.title.trim() || !d.deliverable.trim()) { setError(new Error("Title and deliverable are required.")); return; }
    if (!dirty) { onDone(); return; }
    setSaving(true); setError(null);
    try { await update({ ...task, revision }, d, "Task saved"); clearSubmittedDraft(draftKey, { d, revision, baseline }); onDone(); } catch (err) { setError(err as Error); setSaving(false); }
  }
  async function loadLatest() {
    if (!window.confirm("Replace your task edits with the latest saved version? Copy your draft first if you want to keep it.")) return;
    try {
      const latest = await api<Workspace>(`/api/startups/${workspace.startup.id}`);
      const saved = latest.tasks.find(next => next.id === task.id);
      if (!saved) throw new Error("This task is unavailable. Your draft is still here.");
      const next = { title: saved.title, deliverable: saved.deliverable, week: saved.week, notes: saved.notes };
      onReloaded();
      clearSubmittedDraft(draftKey, { d, revision, baseline }); setD(next); setBaseline(JSON.stringify(next)); setRevision(saved.revision); setError(null); setWorkspace(latest);
    } catch (err) { setError(err as Error); }
  }
  const conflict = error instanceof ClientError && error.status === 409;
  return <form className="task-editor" onSubmit={save} onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); cancel(); } }}>
    <ErrorNotice error={conflict ? "This task changed elsewhere. Load the latest version, or copy your draft first." : error}
      onReload={conflict ? () => void loadLatest() : undefined}
      onCopy={conflict ? () => void navigator.clipboard.writeText(JSON.stringify(d, null, 2)).catch(() => {}) : undefined}/>
    <fieldset disabled={saving}>
      <Field name={`edit-title-${task.id}`} label="Title" value={d.title} onChange={title => setD({ ...d, title })} required maxLength={240}/>
      <Field name={`edit-deliv-${task.id}`} label="Deliverable" value={d.deliverable} onChange={deliverable => setD({ ...d, deliverable })} required textarea/>
      <WeekSelect id={`edit-week-${task.id}`} value={d.week} onChange={week => setD({ ...d, week })}/>
      <Field name={`edit-notes-${task.id}`} label="Notes (optional)" value={d.notes} onChange={notes => setD({ ...d, notes })} textarea maxLength={5000}/>
      {task.source === "generated" && <p className="field-help">Your edits are kept when the plan is refreshed.</p>}
      <div className="form-footer"><button className="button small primary" aria-busy={saving}>{saving ? <><Spinner/>Saving…</> : "Save task"}</button><button type="button" className="button small ghost" onClick={cancel}>Cancel</button></div>
    </fieldset>
  </form>;
}

function WeekSelect({ id, value, onChange }: { id: string; value: number; onChange: (w: number) => void }) {
  return <div className="field"><label htmlFor={id}>Week</label><select id={id} value={value} onChange={e => onChange(Number(e.target.value))}>{[1, 2, 3, 4].map(w => <option key={w} value={w}>Week {w} · {weekDays(w)}</option>)}</select></div>;
}

function ArchivedRow({ task }: { task: Task }) {
  const { update } = useTaskUpdate(); const busy = useTaskPending(task.id); const [error, setError] = useState<string | null>(null);
  return <li><span>{task.title}</span><span className="label">W{task.week}</span>
    <button type="button" className="button small" disabled={busy} onClick={() => void update(task, { archived: false }, "Task restored").catch(e => setError((e as Error).message))}><ArchiveRestore size={14} aria-hidden/>Restore</button>
    {error && <span className="field-error" role="alert">{error}</span>}</li>;
}

const emptyTask: TaskDraft = { title: "", deliverable: "", week: 1, notes: "" };
function AddTaskDialog({ open, onClose, onRecover }: { open: boolean; onClose: () => void; onRecover: () => void }) {
  const { workspace, setWorkspace, refresh, notify, track } = useWorkspace();
  const [d, setD] = useState(emptyTask); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(d) !== JSON.stringify(emptyTask);
  const draftKey = `new-task:${workspace.startup.id}`;
  useDirtyGuard(open && dirty);
  useDraftRecovery(draftKey, d, dirty, value => { setD(taskDraftSchema.parse(value)); onRecover(); notify("Unsaved task draft restored."); });
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (saving) return;
    if (!d.title.trim() || !d.deliverable.trim()) { setError("Add a title and a deliverable."); return; }
    setSaving(true); setError(null);
    try {
      const task = await track(api<Task>(`/api/startups/${workspace.startup.id}/tasks`, { method: "POST", body: JSON.stringify(d) }));
      clearSubmittedDraft(draftKey, d);
      setWorkspace(ws => ({ ...ws, tasks: [...ws.tasks, task] })); void refresh().catch(() => {});
      notify("Custom task added"); setD(emptyTask); onClose();
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }
  return <Dialog open={open} onClose={() => { if (!saving && (!dirty || window.confirm("Discard this task?"))) { clearDraft(draftKey); setD(emptyTask); setError(null); onClose(); } }} title="Add a custom task" locked={saving}>
    <form onSubmit={save}>
      {error && <p className="field-error" role="alert">{error}</p>}
      <fieldset disabled={saving}>
        <Field name="new-title" label="Title" value={d.title} onChange={title => setD({ ...d, title })} required maxLength={240}/>
        <Field name="new-deliverable" label="Deliverable" value={d.deliverable} onChange={deliverable => setD({ ...d, deliverable })} required textarea help="What will exist when this is done?"/>
        <WeekSelect id="new-week" value={d.week} onChange={week => setD({ ...d, week })}/>
        <Field name="new-notes" label="Notes (optional)" value={d.notes} onChange={notes => setD({ ...d, notes })} textarea maxLength={5000}/>
        <p className="field-help">Custom tasks are never changed by a plan refresh.</p>
        <div className="form-footer"><button className="button primary" aria-busy={saving}>{saving ? <><Spinner/>Adding…</> : "Add task"}</button></div>
      </fieldset>
    </form>
  </Dialog>;
}
