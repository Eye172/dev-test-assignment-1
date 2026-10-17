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
import { useDisplay } from "@/ui/display";
import type { MessageKey } from "@/ui/i18n/en";

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

const statusKeys = ["todo", "in_progress", "done", "skipped"] as const;
const weekDays = (t: T, w: number) => t("rm.days", { from: (w - 1) * 7 + 1, to: w === 4 ? 30 : w * 7 });
const taskDraftSchema = z.object({ title: z.string(), deliverable: z.string(), week: z.number().int().min(1).max(4), notes: z.string() });

/** Human names for generation rules. Internal identifiers never reach the interface. */
export function ruleName(key: string | null, tk: (key: string, vars?: Record<string, string | number>, fallback?: string) => string): string | null {
  if (!key) return null;
  if (key.startsWith("channel:")) return tk("rule.channel");
  return tk(`rule.${key}`, undefined, tk("rule.default"));
}
const rules: [number, string][] = [[1, "buyer"], [1, "value"], [1, "criteria"], [2, "channels"], [2, "assumptions"], [3, "pricing"], [4, "evidence"], [4, "decision"]];

/** Canonical roadmap progress: done ÷ actionable (skipped excluded), with skipped shown separately. */
export function RoadmapBar({ progress }: { progress: RoadmapProgress }) {
  const { t } = useDisplay();
  const actionable = progress.total - progress.skipped;
  return <div className="roadmap-bar">
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percentage}
      aria-label={`${progress.percentage}%: ${t("ov.tasksDone", { done: progress.done, total: actionable })}`}>
      <span style={{ width: `${progress.percentage}%` }}/>
    </div>
    <p className="roadmap-bar-label num"><span>{t("ov.tasksDone", { done: progress.done, total: actionable })} · {progress.percentage}%</span>{progress.skipped > 0 && <span className="faint">{t("rm.skippedNote", { n: progress.skipped })}</span>}</p>
  </div>;
}

export function Roadmap() {
  const { workspace, setWorkspace, notify, track } = useWorkspace();
  const { t, locale } = useDisplay();
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
    if (workspace.activePlan ? !window.confirm(t("rm.confirmSwitch")) : active.length && !window.confirm(t("rm.confirmRefresh"))) return;
    setGenerating(true); setError(null);
    try { const ws = await track(api<Workspace>(`/api/startups/${workspace.startup.id}/roadmap`, { method: "POST", body: JSON.stringify(workspace.activePlan ? { replaceAiPlan: true, expectedPlanId: workspace.activePlan.id, locale } : { locale }) })); setWorkspace(ws); notify(active.length ? t("rm.refreshed") : t("rm.generated")); }
    catch (e) { setError(e as Error); }
    finally { setGenerating(false); }
  }
  async function moveToWeek(task: Task, week: number) {
    if (task.week === week) return;
    setMoveError(null);
    try { await track(update(task, { week }, t("rm.moved", { n: week }))); }
    catch (e) { setMoveError(`${t("rm.moveFailed", { title: task.title })} ${(e as Error).message}`); }
  }

  return <div className="roadmap">
    <div className="page-heading">
      <div><h1 tabIndex={-1}>{t("rm.title")}</h1><p className="lead">{workspace.activePlan ? t(workspace.activePlan.conditional ? "rm.ledeAiConditional" : "rm.ledeAi") : t("rm.lede")}</p></div>
      <div className="page-heading-actions">
        {active.length > 0 && <div className="view-switch" role="group" aria-label={t("rm.view")}>
          <button type="button" aria-pressed={board} disabled={!hydrated} onClick={() => setView("board")}>{board && <motion.span layoutId="view-active" className="view-active" transition={spring}/>}<Columns3 size={15} aria-hidden/><span>{t("rm.board")}</span></button>
          <button type="button" aria-pressed={!board} disabled={!hydrated} onClick={() => setView("list")}>{!board && <motion.span layoutId="view-active" className="view-active" transition={spring}/>}<List size={15} aria-hidden/><span>{t("rm.list")}</span></button>
        </div>}
        <button className="button small ghost" onClick={() => setRulesOpen(true)}><Info size={15} aria-hidden/>{t("rm.how")}</button>
        {active.length > 0 && <button className="button small" onClick={() => setAdding(true)}><Plus size={15} aria-hidden/>{t("rm.add")}</button>}
        <button className={`button small ${active.length ? "" : "primary"}`} onClick={generate} disabled={generating} aria-busy={generating}>{generating ? <><Spinner/>{t("rm.working")}</> : <><RefreshCw size={15} aria-hidden/>{workspace.activePlan ? t("rm.switch") : active.length ? t("rm.refresh") : t("rm.generate")}</>}</button>
      </div>
    </div>
    {error && <ErrorNotice error={`${t("rm.genFailed")} ${error.message}`} onRetry={generate}/>}

    {!active.length ? <section className="roadmap-empty instrument">
      <div className="empty-track" aria-hidden>{Array.from({ length: 30 }, (_, i) => <span key={i} style={{ animationDelay: `${i * 40}ms` }}/>)}</div>
      <h2>{t("ov.noTasks")}</h2>
      <p>{t("rm.emptyBody")}</p>
      {incomplete.length > 0 && <p className="field-help">{t("rm.incomplete", { list: incomplete.map(s => t(`section.${s.key}`)).join(", ") })} <Link className="text-link" href={`/startups/${workspace.startup.id}/strategy?section=${incomplete[0].key}`}>{t("ov.openStrategy")}</Link></p>}
      <button className="button primary" onClick={generate} disabled={generating}>{generating ? <><Spinner/>{t("rm.working")}</> : t("ov.generate")}</button>
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
              <div><h2 id={`week-${w}`}>{t("common.weekN", { n: w })}</h2><p className="week-days">{weekDays(t, w)}</p></div>
              <span className="week-count num">{done}/{actionable}</span>
              <span className="week-meter" aria-hidden><span style={{ transform: `scaleX(${actionable ? done / actionable : 0})` }}/></span>
            </header>
            <ul className="task-list">
              {/* No exit animation: a leaving card must never stay clickable with a stale revision. */}
              {tasks.map((t, i) => <motion.li layout="position" transition={spring} key={t.id} id={`task-${t.id}`}
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1, transition: { duration: 0.22, ease: [0.23, 1, 0.32, 1], delay: Math.min(i, 4) * 0.02 } }}>
                <TaskCard task={t} compact={!board} draggable={canDrag} onDropWeek={week => void moveToWeek(t, week)} onHoverWeek={setDropWeek}/>
              </motion.li>)}
              {!tasks.length && <li className="week-empty">{canDrag ? t("rm.dropHere") : t("rm.noWeekTasks")}</li>}
            </ul>
          </section>;
        })}</div>
      </LayoutGroup>
      {archived.length > 0 && <details className="disclosure archived">
        <summary>{t("rm.archived", { n: archived.length })}</summary>
        <ul className="archived-list">{archived.map(t => <ArchivedRow key={t.id} task={t}/>)}</ul>
      </details>}
    </>}

    <Dialog open={rulesOpen} onClose={() => setRulesOpen(false)} title={t("rm.how")}>
      <p className="muted">{t("rm.howLede")}</p>
      <ul className="rule-list">{rules.map(([week, name]) => <li key={name}><span className="rule-name"><span className="label">{t("common.weekN", { n: week })}</span>{t(`rm.rule.${name}` as MessageKey)}</span><span>{t(`rm.rule.${name}.t` as MessageKey)}</span></li>)}</ul>
      <p className="field-help">{t("rm.howFoot")}</p>
    </Dialog>
    <AddTaskDialog open={adding} onClose={() => setAdding(false)} onRecover={() => setAdding(true)}/>
  </div>;
}

/** 30 day cells in four weeks, lit by finished work, with a marker on today's plan day. */
function ProgressTrack({ progress: p, tasks, activePlanCreatedAt }: { progress: RoadmapProgress; tasks: Task[]; activePlanCreatedAt?:string }) {
  const hydrated = useHydrated();
  const { t } = useDisplay();
  const weeks = weekDone(tasks);
  const day = hydrated ? planDay(tasks.filter(t => !t.archived),activePlanCreatedAt) : null;
  return <section className="roadmap-readout instrument" aria-label={t("rm.progress")}>
    <div className="readout-main">
      <p className="readout xl"><Counter value={p.percentage}/><small>%</small></p>
      <p className="inst-caption">{t("rm.ofActionable")}</p>
    </div>
    <dl className="readout-stats">
      <div><dt>{t("status.done")}</dt><dd className="num">{p.done}/{p.total - p.skipped}</dd></div>
      <div><dt>{t("status.skipped")}</dt><dd className="num">{p.skipped}</dd></div>
      <div><dt>{t("common.day")}</dt><dd className="num">{day ?? "–"}<small>/30</small></dd></div>
    </dl>
    <div className="day-track" aria-hidden>
      {[1, 2, 3, 4].map(w => {
        const n = w === 4 ? 9 : 7; const lit = Math.round(weeks[w - 1] * n);
        return <div className="day-week" key={w} style={{ flexGrow: n }}>
          <span className="day-week-label">W{w}</span>
          <div className="day-cells">{Array.from({ length: n }, (_, i) => {
            const d = (w - 1) * 7 + i + 1;
            return <span key={i} className={`day-cell ${i < lit ? "lit" : ""} ${day === d ? "today" : ""}`} style={{ transitionDelay: `${i * 30}ms` }}>{day === d && <motion.i layoutId="today" className="today-mark" data-label={t("rm.today")}/>}</span>;
          })}</div>
        </div>;
      })}
    </div>
    <p className="readout-note">{t("rm.readoutNote")}</p>
  </section>;
}

function TaskCard({ task, compact, draggable, onDropWeek, onHoverWeek }: { task: Task; compact: boolean; draggable: boolean; onDropWeek: (week: number) => void; onHoverWeek: (w: number | null) => void }) {
  const hydrated = useHydrated();
  const { t, tk } = useDisplay();
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
  const rule = task.source === "generated" ? ruleName(task.ruleKey, tk) : null;
  return <motion.article className={`task-card status-${task.status} ${editing ? "is-editing" : ""} ${compact ? "compact" : ""} ${dragging ? "dragging" : ""}`}
    aria-label={editing ? t("rm.editTask") : undefined} aria-labelledby={editing ? undefined : `t-${task.id}`} aria-busy={busy || undefined}
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
          <StatusRing task={task} disabled={busy || !hydrated} label={`${t("status.done")}: ${task.title}`} onToggle={status => void run({ status })}/>
          <h3 id={`t-${task.id}`} className="task-title">{task.title}</h3>
        </div>
        {!compact && <p className="task-deliverable"><span className="label">{t("rm.deliverable")}</span>{task.deliverable}</p>}
        {task.notes && !compact && <p className="task-notes">{task.notes}</p>}
        {task.experiment&&!compact&&<details className="task-experiment"><summary>{t("rm.criteria")}</summary><dl><dt>{t("rm.success")}</dt><dd>{task.experiment.measurement.success}</dd><dt>{t("rm.failure")}</dt><dd>{task.experiment.measurement.failure}</dd><dt>{t("rm.inconclusive")}</dt><dd>{task.experiment.measurement.inconclusive}</dd><dt>{t("rm.sample")}</dt><dd>{task.experiment.measurement.minimumSample ?? t("common.unknown")} {task.experiment.measurement.unit} · {t("common.day")} {task.experiment.measurement.deadlineDay}</dd><dt>{t("rm.resources")}</dt><dd>{task.experiment.effortMinutes ?? t("common.unknown")} min · {task.experiment.costs.map(c => `${c.currency} ${c.amount ?? t("common.unknown")}`).join(" + ") || t("rm.noCash")}</dd></dl><p className="field-help">{task.edited ? t("rm.editedCriteria") : t("rm.judgeCriteria")}</p></details>}
        {error && <p className="field-error" role="alert">{error} {t("rm.undone")}</p>}
        <div className="task-actions">
          <label className="sr-only" htmlFor={`s-${task.id}`}>{t("rm.statusFor", { title: task.title })}</label>
          <select id={`s-${task.id}`} className={`status-select ${task.status}`} value={task.status} disabled={busy || !hydrated}
            onChange={e => void run({ status: e.target.value as Task["status"] })}>
            {statusKeys.map(v => <option key={v} value={v}>{t(`status.${v}`)}</option>)}
          </select>
          {busy && <Spinner/>}
          {task.source === "custom" && <Badge status="custom" label={t("rm.custom")}/>}{task.edited && task.source !== "custom" && <span className="badge">{t("rm.edited")}</span>}
          {task.source === "ai" && <span className="badge">{t("rm.aiReviewed")}</span>}
          {rule && task.rationale && !compact && <details className="why"><summary>{t("rm.whyTask")}</summary><p>{task.rationale}</p><p className="faint rule-label">{t("rm.rule")}: {rule}</p></details>}
          <span className="task-buttons">
            <button type="button" className="icon-button small" aria-label={`${t("common.edit")} ${task.title}`} disabled={busy || !hydrated} onClick={() => setEditing(true)}><Pencil size={15}/></button>
            <button type="button" className="icon-button small" aria-label={`${t("rm.archive")} ${task.title}`} disabled={busy || !hydrated} onClick={() => void run({ archived: true }, t("rm.archivedDone"))}><Archive size={15}/></button>
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
  const { t } = useDisplay();
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
  function cancel() { if (!saving && (!dirty || window.confirm(t("rm.discardEdits")))) { clearDraft(draftKey); onDone(); } }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (saving) return;
    if (!d.title.trim() || !d.deliverable.trim()) { setError(new Error(t("rm.required"))); return; }
    if (!dirty) { onDone(); return; }
    setSaving(true); setError(null);
    try { await update({ ...task, revision }, d, t("rm.taskSaved")); clearSubmittedDraft(draftKey, { d, revision, baseline }); onDone(); } catch (err) { setError(err as Error); setSaving(false); }
  }
  async function loadLatest() {
    if (!window.confirm(t("st.reloadConfirm"))) return;
    try {
      const latest = await api<Workspace>(`/api/startups/${workspace.startup.id}`);
      const saved = latest.tasks.find(next => next.id === task.id);
      if (!saved) throw new Error(t("rm.unavailable"));
      const next = { title: saved.title, deliverable: saved.deliverable, week: saved.week, notes: saved.notes };
      onReloaded();
      clearSubmittedDraft(draftKey, { d, revision, baseline }); setD(next); setBaseline(JSON.stringify(next)); setRevision(saved.revision); setError(null); setWorkspace(latest);
    } catch (err) { setError(err as Error); }
  }
  const conflict = error instanceof ClientError && error.status === 409;
  return <form className="task-editor" onSubmit={save} onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); cancel(); } }}>
    <ErrorNotice error={conflict ? t("rm.conflict") : error}
      onReload={conflict ? () => void loadLatest() : undefined}
      onCopy={conflict ? () => void navigator.clipboard.writeText(JSON.stringify(d, null, 2)).catch(() => {}) : undefined}/>
    <fieldset disabled={saving}>
      <Field name={`edit-title-${task.id}`} label={t("rm.titleField")} value={d.title} onChange={title => setD({ ...d, title })} required maxLength={240}/>
      <Field name={`edit-deliv-${task.id}`} label={t("rm.deliverable")} value={d.deliverable} onChange={deliverable => setD({ ...d, deliverable })} required textarea/>
      <WeekSelect id={`edit-week-${task.id}`} value={d.week} onChange={week => setD({ ...d, week })}/>
      <Field name={`edit-notes-${task.id}`} label={t("st.notes")} value={d.notes} onChange={notes => setD({ ...d, notes })} textarea maxLength={5000}/>
      {task.source === "generated" && <p className="field-help">{t("rm.editsKept")}</p>}
      <div className="form-footer"><button className="button small primary" aria-busy={saving}>{saving ? <><Spinner/>{t("chrome.saving")}</> : t("rm.saveTask")}</button><button type="button" className="button small ghost" onClick={cancel}>{t("common.cancel")}</button></div>
    </fieldset>
  </form>;
}

function WeekSelect({ id, value, onChange }: { id: string; value: number; onChange: (w: number) => void }) {
  const { t } = useDisplay();
  return <div className="field"><label htmlFor={id}>{t("common.week")}</label><select id={id} value={value} onChange={e => onChange(Number(e.target.value))}>{[1, 2, 3, 4].map(w => <option key={w} value={w}>{t("common.weekN", { n: w })} · {weekDays(t, w)}</option>)}</select></div>;
}

function ArchivedRow({ task }: { task: Task }) {
  const { update } = useTaskUpdate(); const busy = useTaskPending(task.id); const [error, setError] = useState<string | null>(null);
  const { t } = useDisplay();
  return <li><span>{task.title}</span><span className="label">{t("common.weekN", { n: task.week })}</span>
    <button type="button" className="button small" disabled={busy} onClick={() => void update(task, { archived: false }, t("rm.restored")).catch(e => setError((e as Error).message))}><ArchiveRestore size={14} aria-hidden/>{t("rm.restore")}</button>
    {error && <span className="field-error" role="alert">{error}</span>}</li>;
}

const emptyTask: TaskDraft = { title: "", deliverable: "", week: 1, notes: "" };
function AddTaskDialog({ open, onClose, onRecover }: { open: boolean; onClose: () => void; onRecover: () => void }) {
  const { workspace, setWorkspace, refresh, notify, track } = useWorkspace();
  const { t } = useDisplay();
  const [d, setD] = useState(emptyTask); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(d) !== JSON.stringify(emptyTask);
  const draftKey = `new-task:${workspace.startup.id}`;
  useDirtyGuard(open && dirty);
  useDraftRecovery(draftKey, d, dirty, value => { setD(taskDraftSchema.parse(value)); onRecover(); notify(t("rm.draftRestored")); });
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (saving) return;
    if (!d.title.trim() || !d.deliverable.trim()) { setError(t("rm.required")); return; }
    setSaving(true); setError(null);
    try {
      const task = await track(api<Task>(`/api/startups/${workspace.startup.id}/tasks`, { method: "POST", body: JSON.stringify(d) }));
      clearSubmittedDraft(draftKey, d);
      setWorkspace(ws => ({ ...ws, tasks: [...ws.tasks, task] })); void refresh().catch(() => {});
      notify(t("rm.added")); setD(emptyTask); onClose();
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }
  return <Dialog open={open} onClose={() => { if (!saving && (!dirty || window.confirm(t("rm.discardTask")))) { clearDraft(draftKey); setD(emptyTask); setError(null); onClose(); } }} title={t("rm.addTitle")} locked={saving}>
    <form onSubmit={save}>
      {error && <p className="field-error" role="alert">{error}</p>}
      <fieldset disabled={saving}>
        <Field name="new-title" label={t("rm.titleField")} value={d.title} onChange={title => setD({ ...d, title })} required maxLength={240}/>
        <Field name="new-deliverable" label={t("rm.deliverable")} value={d.deliverable} onChange={deliverable => setD({ ...d, deliverable })} required textarea help={t("rm.deliverableHelp")}/>
        <WeekSelect id="new-week" value={d.week} onChange={week => setD({ ...d, week })}/>
        <Field name="new-notes" label={t("st.notes")} value={d.notes} onChange={notes => setD({ ...d, notes })} textarea maxLength={5000}/>
        <p className="field-help">{t("rm.customKept")}</p>
        <div className="form-footer"><button className="button primary" aria-busy={saving}>{saving ? <><Spinner/>{t("chrome.saving")}</> : t("rm.add")}</button></div>
      </fieldset>
    </form>
  </Dialog>;
}
