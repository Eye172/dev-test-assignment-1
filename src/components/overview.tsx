"use client";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ExternalLink, Pencil } from "lucide-react";
import { sectionSchemas } from "@/lib/domain/schemas";
import { Badge, useHydrated } from "./ui";
import { ProfileForm } from "./profile-form";
import { nextStep, SectionSegments } from "./progress";
import { RoadmapBar } from "./roadmap";
import { useWorkspace } from "./workspace";
import { useHasDraft } from "./draft-recovery";

const ease = [0.23, 1, 0.32, 1] as const;

/**
 * Asymmetric overview: a wide active-work column (identity → next decision → this week)
 * beside a narrow facts rail. One dark instrument per screen, at the top of the rail.
 */
export function Overview() {
  const { workspace, setWorkspace, refresh, notify } = useWorkspace();
  const { startup, completion, roadmapProgress } = workspace;
  const [editing, setEditing] = useState(false);
  const recovered = useHasDraft(`profile:${startup.id}`);
  const base = `/startups/${startup.id}`;
  const next = nextStep(workspace);
  const active = workspace.tasks.filter(t => !t.archived);
  const week = [1, 2, 3, 4].find(w => active.some(t => t.week === w && (t.status === "todo" || t.status === "in_progress")));
  const weekTasks = week ? active.filter(t => t.week === week) : [];
  const risks = sectionSchemas.assumptions.parse(workspace.sections.find(s => s.key === "assumptions")?.data ?? {}).assumptions.filter(a => a.statement);
  const topRisk = [...risks].sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.risk] - { high: 0, medium: 1, low: 2 }[b.risk]))[0];
  const firstGap = completion.sections.find(s => !s.complete)?.key ?? "icp";
  const facts: [string, string][] = [["Business model", startup.businessModel], ["Stage", startup.stage], ["Target market", startup.targetMarket], ["Customer segment", startup.customerSegment]];
  const hydrated = useHydrated();
  const enter = (i: number) => ({ initial: hydrated ? { opacity: 0, y: 10 } : false as const, animate: { opacity: 1, y: 0 }, transition: { duration: 0.32, ease, delay: i * 0.06 } });

  return <div className="overview-layout">
    <div className="work-col">
      <motion.header className="identity" {...enter(0)}>
        <h1 id="startup-name" tabIndex={-1}>{startup.name}</h1>
        <p className="identity-desc">{startup.description}</p>
      </motion.header>

      <AnimatePresence mode="wait" initial={false}>
        {editing || recovered ? <motion.section key="edit" className="plate profile-edit" aria-labelledby="edit-title"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }} transition={{ duration: 0.24, ease }}>
          <div className="plate-head"><h2 id="edit-title">Edit profile</h2></div>
          <ProfileForm initial={startup} onReloaded={latest => { setEditing(true); setWorkspace(latest); }} onCancel={() => setEditing(false)} onSaved={saved => { setWorkspace(ws => ({ ...ws,startup: saved })); setEditing(false); notify("Profile saved"); void refresh().catch(() => {}); }}/>
        </motion.section> : <motion.div key="work" className="work-stack" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
          <motion.section className="next-move" aria-labelledby="next-title" {...enter(1)}>
            <h2 id="next-title" className="label">Next move</h2>
            <p className="next-move-title">{next.title}</p>
            <p className="muted next-move-detail">{next.detail}</p>
            <Link className="button primary" href={next.href}>{next.cta}<ArrowRight size={16} aria-hidden/></Link>
          </motion.section>

          <motion.section className="this-week" aria-labelledby="week-title" {...enter(2)}>
            <div className="section-head"><h2 id="week-title">{week ? `Week ${week}` : "Roadmap"}</h2><Link className="plate-link" href={`${base}/roadmap`}>{active.length ? "Open roadmap" : "Generate roadmap"}<ArrowRight size={15} aria-hidden/></Link></div>
            {active.length ? <>
              <ul className="week-list">{weekTasks.map(t => <li key={t.id}><span className={`status-dot ${t.status}`} aria-hidden/><Link href={`${base}/roadmap#task-${t.id}`}>{t.title}</Link><Badge status={t.status}/></li>)}</ul>
              {!week && <p className="plate-empty">No open tasks. Review your evidence and refresh the plan.</p>}
              <RoadmapBar progress={roadmapProgress}/>
            </> : <p className="plate-empty">No roadmap yet. It adapts to whatever strategy you have saved, so you can generate it any time.</p>}
          </motion.section>

          {topRisk && <motion.section className="risk-strip" aria-labelledby="risk-title" {...enter(3)}>
            <h2 id="risk-title" className="label">Riskiest belief</h2>
            <p>{topRisk.statement}</p>
            <div className="risk-tags"><Badge status={topRisk.risk}/><Badge status="untested"/></div>
          </motion.section>}
        </motion.div>}
      </AnimatePresence>
    </div>

    <aside className="facts-rail" aria-label="Startup facts">
      <motion.section className="plate instrument rail-readout" aria-labelledby="readout-title" {...enter(1)}>
        <div className="plate-head"><h2 id="readout-title">Strategy inputs</h2><span className="plate-meta">{completion.completed}/5</span></div>
        <p className="readout lg">{completion.percentage}<small>%</small></p>
        <SectionSegments workspace={workspace} labels={false}/>
        <p className="inst-caption">Complete means the required fields are filled, not that the strategy is proven.</p>
        <Link className="plate-link" href={`${base}/strategy?section=${firstGap}`}>{completion.completed === 5 ? "Review strategy" : "Continue strategy"}<ArrowRight size={15} aria-hidden/></Link>
      </motion.section>
      <motion.dl className="rail-facts" {...enter(2)}>
        {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        {startup.websiteUrl && <div><dt>Website</dt><dd><a className="text-link" href={startup.websiteUrl} target="_blank" rel="noopener noreferrer">{startup.websiteUrl.replace(/^https?:\/\//, "")}<ExternalLink size={13} aria-hidden className="inline-icon"/><span className="sr-only"> (opens in a new tab)</span></a></dd></div>}
        {startup.context && <div><dt>Context</dt><dd>{startup.context}</dd></div>}
        {Object.entries(startup.customFields).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </motion.dl>
      {!editing && !recovered && <button className="button small rail-edit" onClick={() => setEditing(true)}><Pencil size={15} aria-hidden/>Edit profile</button>}
    </aside>
  </div>;
}
