"use client";
import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, ArrowUpRight, ExternalLink, Pencil } from "lucide-react";
import { sectionSchemas } from "@/lib/domain/schemas";
import type { Task } from "@/lib/domain/types";
import { Badge, Dialog, confirmLeave, useHydrated } from "./ui";
import { ProfileForm } from "./profile-form";
import { nextStep } from "./progress";
import { RoadmapBar } from "./roadmap";
import { useWorkspace, easeOut } from "./workspace";
import { clearDraft, useHasDraft } from "./draft-recovery";
import { DialLegend, OrbitDial, useOrbitModel } from "./orbit";
import { StatusRing } from "./status-ring";
import { useTaskPending, useTaskUpdate } from "./task-actions";

/**
 * Overview answers two questions: who is this startup, and where does it stand?
 * Identity is set in large type beside the Orbit dial; one next move; this week's work; the riskiest belief; the facts.
 */
export function Overview() {
  const { workspace, setWorkspace, refresh, notify } = useWorkspace();
  const { startup } = workspace;
  const [editing, setEditing] = useState(false);
  const recovered = useHasDraft(`profile:${startup.id}`);
  const base = `/startups/${startup.id}`;
  const next = nextStep(workspace);
  const model = useOrbitModel(workspace);
  const active = workspace.tasks.filter(t => !t.archived);
  const week = [1, 2, 3, 4].find(w => active.some(t => t.week === w && (t.status === "todo" || t.status === "in_progress")));
  const weekTasks = week ? active.filter(t => t.week === week) : [];
  const risks = sectionSchemas.assumptions.parse(workspace.sections.find(s => s.key === "assumptions")?.data ?? {}).assumptions.filter(a => a.statement);
  const topRisk = [...risks].sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.risk] - { high: 0, medium: 1, low: 2 }[b.risk]))[0];
  const facts: [string, string][] = [["Business model", startup.businessModel], ["Stage", startup.stage], ["Target market", startup.targetMarket], ["Customer segment", startup.customerSegment]];
  const hydrated = useHydrated();
  const enter = (i: number) => ({ initial: hydrated ? { opacity: 0, y: 14 } : false as const, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, ease: easeOut, delay: i * 0.07 } });
  const open = editing || recovered;
  const closeEditor = () => { if (confirmLeave()) { clearDraft(`profile:${startup.id}`); setEditing(false); } };

  return <div className="overview">
    <section className="ov-hero" aria-labelledby="startup-name">
      <motion.div className="ov-identity" {...enter(0)}>
        <p className="eyebrow">{`${startup.businessModel} · ${startup.stage} · ${startup.targetMarket}`}</p>
        <h1 id="startup-name" tabIndex={-1}>{startup.name}</h1>
        <p className="ov-desc">{startup.description}</p>
        <div className="ov-actions">
          <Link className="button primary" href={next.href}>{next.cta}<ArrowRight size={17} aria-hidden className="arrow"/></Link>
          <button type="button" className="button" disabled={!hydrated} onClick={() => setEditing(true)}><Pencil size={15} aria-hidden/>Edit profile</button>
        </div>
      </motion.div>
      <motion.div className="ov-dial" initial={hydrated ? { opacity: 0, scale: 0.92, rotate: -8 } : false} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 120, damping: 18 }}>
        <OrbitDial model={model} size={320} base={base} interactive className="dial-hero"/>
        <DialLegend model={model}/>
      </motion.div>
    </section>

    <motion.section className="next-move instrument" aria-labelledby="next-title" {...enter(2)}>
      <div className="next-move-copy">
        <h2 id="next-title" className="label">Next move</h2>
        <p className="next-move-title">{next.title}</p>
        <p className="next-move-detail">{next.detail}</p>
      </div>
      <Link className="next-move-go" href={next.href} aria-label={`${next.cta}: ${next.title}`}><ArrowUpRight size={28} aria-hidden/></Link>
    </motion.section>

    <div className="ov-grid">
      <motion.section className="plate marks this-week" aria-labelledby="week-title" {...enter(3)}>
        <div className="plate-head"><h2 id="week-title">{week ? `Week ${week} · this week` : "Roadmap"}</h2>
          <Link className="plate-link" href={`${base}/roadmap`}>{active.length ? "Open roadmap" : "Generate roadmap"}<ArrowRight size={15} aria-hidden/></Link></div>
        {active.length ? <>
          <ul className="week-list">{weekTasks.map(t => <WeekRow key={t.id} task={t} base={base}/>)}</ul>
          {!week && <p className="plate-empty">No open tasks. Review your evidence and refresh the plan.</p>}
          <div className="plate-foot"><RoadmapBar progress={workspace.roadmapProgress}/></div>
        </> : <p className="plate-empty">No roadmap yet. It adapts to whatever strategy you have saved, so you can generate it any time.</p>}
      </motion.section>

      <motion.section className="plate marks risk-strip" aria-labelledby="risk-title" {...enter(4)}>
        <div className="plate-head"><h2 id="risk-title">Riskiest belief</h2>{risks.length > 0 && <span className="plate-meta">{risks.length} untested</span>}</div>
        {topRisk ? <>
          <p className="risk-statement">“{topRisk.statement}”</p>
          <div className="risk-tags"><Badge status={topRisk.risk}/><Badge status="untested"/></div>
          {topRisk.validationMethod && <p className="risk-method"><span className="label">Test</span>{topRisk.validationMethod}</p>}
        </> : <p className="plate-empty">No assumptions recorded yet. <Link className="text-link" href={`${base}/strategy?section=assumptions`}>Write three</Link>.</p>}
      </motion.section>

      <motion.aside className="facts-rail" aria-label="Startup facts" {...enter(5)}>
        <dl className="rail-facts">
          {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          {startup.websiteUrl && <div><dt>Website</dt><dd><a className="text-link" href={startup.websiteUrl} target="_blank" rel="noopener noreferrer">{startup.websiteUrl.replace(/^https?:\/\//, "")}<ExternalLink size={13} aria-hidden className="inline-icon"/><span className="sr-only"> (opens in a new tab)</span></a></dd></div>}
          {startup.context && <div className="wide"><dt>Context</dt><dd>{startup.context}</dd></div>}
          {Object.entries(startup.customFields).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      </motion.aside>
    </div>

    <Dialog open={open} onClose={closeEditor} title="Edit profile" className="sheet-dialog">
      <ProfileForm initial={startup} onReloaded={latest => { setEditing(true); setWorkspace(latest); }} onCancel={() => setEditing(false)}
        onSaved={saved => { setWorkspace(ws => ({ ...ws, startup: saved })); setEditing(false); notify("Profile saved"); void refresh().catch(() => {}); }}/>
    </Dialog>
  </div>;
}

function WeekRow({ task, base }: { task: Task; base: string }) {
  const { update } = useTaskUpdate();
  const busy = useTaskPending(task.id);
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);
  return <li className={`week-row ${task.status}`}>
    <StatusRing task={task} disabled={busy || !hydrated} label={`Done: ${task.title}`} onToggle={status => { setError(null); void update(task, { status }).catch(e => setError((e as Error).message)); }}/>
    <Link href={`${base}/roadmap#task-${task.id}`} className="week-row-title">{task.title}</Link>
    {task.status === "in_progress" && <Badge status="in_progress"/>}
    {error && <span className="field-error" role="alert">{error}</span>}
  </li>;
}
