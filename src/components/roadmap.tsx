"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Archive, ArchiveRestore, Info, Pencil, Plus, RefreshCw } from "lucide-react";
import { api } from "@/lib/client-api";
import type { Task, Workspace } from "@/lib/domain/types";
import { Badge, Dialog, ErrorNotice, Field, Spinner, useDirtyGuard } from "./ui";
import { useTaskUpdate } from "./task-actions";
import { spring, useWorkspace } from "./workspace";

const statusLabels = { todo: "To do", in_progress: "In progress", done: "Done", skipped: "Skipped" } as const;
const weekDays = (w: number) => w === 4 ? "Days 22–30" : `Days ${(w - 1) * 7 + 1}–${w * 7}`;
const rules: [string, string][] = [
  ["Week 1 · icp-focus", "Complete ICP → interview five target buyers. Incomplete → refine the buyer persona first."],
  ["Week 1 · value-test", "Complete value proposition → test the promise with customers. Incomplete → write a testable one."],
  ["Week 1 · experiment-design", "Always: set measurable success criteria before the first experiment."],
  ["Week 2 · channel:<name>", "One experiment per named channel (up to three). None saved → choose one channel."],
  ["Week 2 · assumption-test", "Test the highest-risk saved assumption, or define three if none exist."],
  ["Week 3 · pricing-test", "Complete pricing → test willingness to pay with a real offer. Incomplete → define the pricing hypothesis."],
  ["Week 4 · evidence-review", "Always: separate opinions, interest and commitments, and name the bottleneck."],
  ["Week 4 · founder-decision", "Always: continue, change or stop, decided by the founder from evidence."],
];

export function Roadmap() {
  const { workspace, setWorkspace, notify } = useWorkspace();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const active = workspace.tasks.filter(t => !t.archived);
  const archived = workspace.tasks.filter(t => t.archived);
  const p = workspace.roadmapProgress;
  const incomplete = workspace.completion.sections.filter(s => !s.complete);

  useEffect(() => {
    const id = location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ block: "center" });
  }, []);

  async function generate() {
    if (active.length && !window.confirm("Refresh the plan from your current strategy? Completed tasks, your edits and custom tasks are kept. Tasks that no longer apply move to Archived.")) return;
    setGenerating(true); setError(null);
    try { const ws = await api<Workspace>(`/api/startups/${workspace.startup.id}/roadmap`, { method: "POST" }); setWorkspace(ws); notify(active.length ? "Plan refreshed from your strategy" : "30-day plan generated"); }
    catch (e) { setError(e as Error); }
    finally { setGenerating(false); }
  }

  return <div className="roadmap">
    <div className="page-heading">
      <div><h1 tabIndex={-1}>30-day roadmap</h1><p className="lead">Built by visible rules from your saved strategy. Statuses and edits are yours; refreshing never erases them.</p></div>
      <div className="page-heading-actions">
        <button className="button small ghost" onClick={() => setRulesOpen(true)}><Info size={15} aria-hidden/>How tasks are chosen</button>
        {active.length > 0 && <button className="button small" onClick={() => setAdding(true)}><Plus size={15} aria-hidden/>Add task</button>}
        <button className={`button small ${active.length ? "" : "primary"}`} onClick={generate} disabled={generating} aria-busy={generating}>{generating ? <><Spinner/>Working…</> : <><RefreshCw size={15} aria-hidden/>{active.length ? "Refresh plan" : "Generate plan"}</>}</button>
      </div>
    </div>
    {error && <ErrorNotice error={`Couldn't generate the plan. ${error.message}`} onRetry={generate}/>}

    {!active.length ? <section className="plate roadmap-empty">
      <h2>No plan yet</h2>
      <p className="muted">The plan adapts to whatever you have saved. Generate it now and refresh after you complete more of your strategy.</p>
      {incomplete.length > 0 && <p className="field-help">Incomplete: {incomplete.map(s => s.title).join(", ")}. Those tasks will start with defining the missing inputs. <Link className="text-link" href={`/startups/${workspace.startup.id}/strategy?section=${incomplete[0].key}`}>Complete strategy</Link></p>}
      <button className="button primary" onClick={generate} disabled={generating}>{generating ? <><Spinner/>Generating…</> : "Generate 30-day plan"}</button>
    </section> : <>
      <section className="plate instrument roadmap-readout" aria-label="Roadmap progress">
        <span className="screw tl"/><span className="screw br"/>
        <div className="screen">
          <p className="readout lg">{p.percentage}<small>%</small></p>
          <div className="readout-stats">
            <p className="inst-row"><span>Done</span><strong>{p.done}/{p.total}</strong></p>
            <p className="inst-row"><span>Skipped</span><strong>{p.skipped}</strong></p>
          </div>
          <div className="day-ruler" aria-hidden>{Array.from({ length: 30 }, (_, i) => <span key={i} className={(i + 1) % 7 === 1 && i < 28 ? "major" : ""}>{((i + 1) % 7 === 1 && i < 28) || i === 29 ? i + 1 : ""}</span>)}</div>
        </div>
        <p className="muted readout-note">Progress = done ÷ active tasks. Completing tasks is activity, not market validation.</p>
      </section>
      <div className="weeks">{[1, 2, 3, 4].map(w => {
        const tasks = active.filter(t => t.week === w);
        const done = tasks.filter(t => t.status === "done").length;
        return <section key={w} className="week-band" aria-labelledby={`week-${w}`}>
          <header className="week-label">
            <span className="week-node mono" aria-hidden>{w}</span>
            <div><h2 id={`week-${w}`}>Week {w}</h2><p className="faint mono">{weekDays(w)}</p><p className="muted num">{done}/{tasks.length} done</p></div>
          </header>
          <ul className="task-grid">
            <AnimatePresence initial={false}>{tasks.map(t => <motion.li layout="position" transition={spring} key={t.id} id={`task-${t.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }}>
              <TaskCard task={t}/>
            </motion.li>)}</AnimatePresence>
            {!tasks.length && <li className="week-empty faint">No tasks this week.</li>}
          </ul>
        </section>;
      })}</div>
      {archived.length > 0 && <details className="disclosure archived">
        <summary>Archived ({archived.length})</summary>
        <ul className="archived-list">{archived.map(t => <ArchivedRow key={t.id} task={t}/>)}</ul>
      </details>}
    </>}

    <Dialog open={rulesOpen} onClose={() => setRulesOpen(false)} title="How tasks are chosen">
      <p className="muted">Deterministic rules read your saved strategy. The same inputs always give the same plan. No AI is involved.</p>
      <ul className="rule-list">{rules.map(([k, v]) => <li key={k}><span className="mono rule-key">{k}</span><span>{v}</span></li>)}</ul>
      <p className="field-help">Refreshing keeps completed tasks, your edits and custom tasks. Superseded tasks are archived, not deleted.</p>
    </Dialog>
    <AddTaskDialog open={adding} onClose={() => setAdding(false)}/>
  </div>;
}

function TaskCard({ task }: { task: Task }) {
  const update = useTaskUpdate();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(patch: Parameters<typeof update>[1], message?: string) {
    setError(null); setBusy(true);
    try { await update(task, patch, message); return true; }
    catch (e) { setError((e as Error).message); return false; }
    finally { setBusy(false); }
  }
  if (editing) return <TaskEditor task={task} onDone={() => setEditing(false)}/>;
  return <article className={`task-card status-${task.status}`} aria-labelledby={`t-${task.id}`}>
    <div className="task-top">
      <label className="sr-only" htmlFor={`s-${task.id}`}>Status for {task.title}</label>
      <select id={`s-${task.id}`} className={`status-select ${task.status}`} value={task.status} disabled={busy}
        onChange={e => void run({ status: e.target.value as Task["status"] })}>
        {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <div className="task-tags">{task.source === "custom" && <Badge status="custom"/>}{task.edited && task.source !== "custom" && <span className="badge">Edited</span>}</div>
    </div>
    <h3 id={`t-${task.id}`} className="task-title">{task.title}</h3>
    <p className="task-deliverable"><span className="faint">Deliverable · </span>{task.deliverable}</p>
    {task.notes && <p className="task-notes">{task.notes}</p>}
    {error && <p className="field-error" role="alert">{error} The change was undone.</p>}
    <div className="task-actions">
      {task.source === "generated" && task.rationale && <details className="why"><summary>Why this task</summary><p>{task.rationale}</p>{task.ruleKey && <p className="mono faint rule-key">rule: {task.ruleKey}</p>}</details>}
      <span className="task-buttons">
        <button type="button" className="icon-button" aria-label={`Edit ${task.title}`} onClick={() => setEditing(true)}><Pencil size={16}/></button>
        <button type="button" className="icon-button" aria-label={`Archive ${task.title}`} disabled={busy} onClick={() => void run({ archived: true }, "Task archived")}><Archive size={16}/></button>
      </span>
    </div>
  </article>;
}

function TaskEditor({ task, onDone }: { task: Task; onDone: () => void }) {
  const update = useTaskUpdate();
  const [d, setD] = useState({ title: task.title, deliverable: task.deliverable, week: task.week, notes: task.notes });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = d.title !== task.title || d.deliverable !== task.deliverable || d.week !== task.week || d.notes !== task.notes;
  useDirtyGuard(dirty && !saving);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!d.title.trim() || !d.deliverable.trim()) { setError("Title and deliverable are required."); return; }
    if (!dirty) { onDone(); return; }
    setSaving(true); setError(null);
    try { await update(task, d, "Task saved"); onDone(); } catch (err) { setError((err as Error).message); setSaving(false); }
  }
  return <form className="task-card editing" onSubmit={save} onKeyDown={e => { if (e.key === "Escape" && (!dirty || window.confirm("Discard task edits?"))) onDone(); }}>
    {error && <p className="field-error" role="alert">{error}</p>}
    <fieldset disabled={saving}>
      <Field name={`edit-title-${task.id}`} label="Title" value={d.title} onChange={title => setD({ ...d, title })} required maxLength={240}/>
      <Field name={`edit-deliv-${task.id}`} label="Deliverable" value={d.deliverable} onChange={deliverable => setD({ ...d, deliverable })} required textarea/>
      <WeekSelect id={`edit-week-${task.id}`} value={d.week} onChange={week => setD({ ...d, week })}/>
      <Field name={`edit-notes-${task.id}`} label="Notes (optional)" value={d.notes} onChange={notes => setD({ ...d, notes })} textarea maxLength={5000}/>
      {task.source === "generated" && <p className="field-help">Your edits are kept when the plan is refreshed.</p>}
      <div className="form-footer"><button className="button small primary" aria-busy={saving}>{saving ? <><Spinner/>Saving…</> : "Save task"}</button><button type="button" className="button small ghost" onClick={() => { if (!dirty || window.confirm("Discard task edits?")) onDone(); }}>Cancel</button></div>
    </fieldset>
  </form>;
}

function WeekSelect({ id, value, onChange }: { id: string; value: number; onChange: (w: number) => void }) {
  return <div className="field"><label htmlFor={id}>Week</label><select id={id} value={value} onChange={e => onChange(Number(e.target.value))}>{[1, 2, 3, 4].map(w => <option key={w} value={w}>Week {w} · {weekDays(w)}</option>)}</select></div>;
}

function ArchivedRow({ task }: { task: Task }) {
  const update = useTaskUpdate(); const [error, setError] = useState<string | null>(null);
  return <li><span>{task.title}</span><span className="faint mono">W{task.week}</span>
    <button type="button" className="button small" onClick={() => void update(task, { archived: false }, "Task restored").catch(e => setError((e as Error).message))}><ArchiveRestore size={14} aria-hidden/>Restore</button>
    {error && <span className="field-error" role="alert">{error}</span>}</li>;
}

function AddTaskDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { workspace, setWorkspace, refresh, notify } = useWorkspace();
  const empty = { title: "", deliverable: "", week: 1, notes: "" };
  const [d, setD] = useState(empty); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!d.title.trim() || !d.deliverable.trim()) { setError("Add a title and a deliverable."); return; }
    setSaving(true); setError(null);
    try {
      const task = await api<Task>(`/api/startups/${workspace.startup.id}/tasks`, { method: "POST", body: JSON.stringify(d) });
      setWorkspace(ws => ({ ...ws, tasks: [...ws.tasks, task] })); await refresh().catch(() => {});
      notify("Custom task added"); setD(empty); onClose();
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }
  return <Dialog open={open} onClose={() => { if (!(d.title || d.deliverable) || window.confirm("Discard this task?")) { setD(empty); onClose(); } }} title="Add a custom task">
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
