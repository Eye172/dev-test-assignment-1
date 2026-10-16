"use client";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ExternalLink, Pencil } from "lucide-react";
import { Badge } from "./ui";
import { ProfileForm } from "./profile-form";
import { nextStep, RoadmapBar, SectionSegments } from "./progress";
import { useWorkspace } from "./workspace";
import { useHasDraft } from "./draft-recovery";

export function Overview() {
  const { workspace, setWorkspace, refresh, notify } = useWorkspace();
  const { startup, completion, roadmapProgress } = workspace;
  const [editing, setEditing] = useState(false);
  const recovered = useHasDraft(`profile:${startup.id}`);
  const base = `/startups/${startup.id}`;
  const next = nextStep(workspace);
  const openTasks = workspace.tasks.filter(t => !t.archived && (t.status === "todo" || t.status === "in_progress")).sort((a, b) => a.week - b.week).slice(0, 3);
  const firstGap = completion.sections.find(s => !s.complete)?.key ?? "icp";
  const facts: [string, string][] = [["Model", startup.businessModel], ["Stage", startup.stage], ["Market", startup.targetMarket], ["Segment", startup.customerSegment]];

  return <div className="overview">
    <div className="plate-grid">
      <section className="plate identity" data-size="L" aria-labelledby="startup-name">
        <h1 id="startup-name" tabIndex={-1}>{startup.name}</h1>
        <p className="identity-desc">{startup.description}</p>
        <dl className="facts">
          {facts.map(([k, v]) => <div key={k}><dt className="label">{k}</dt><dd>{v}</dd></div>)}
          {startup.websiteUrl && <div><dt className="label">Website</dt><dd><a className="text-link" href={startup.websiteUrl} target="_blank" rel="noopener noreferrer">{startup.websiteUrl.replace(/^https?:\/\//, "")}<ExternalLink size={13} aria-hidden style={{ display: "inline", marginLeft: 4 }}/><span className="sr-only"> (opens in a new tab)</span></a></dd></div>}
        </dl>
      </section>

      <section className="plate instrument readout-plate" data-size="S" aria-labelledby="readout-title">
        <span className="screw tl"/><span className="screw tr"/><span className="screw bl"/><span className="screw br"/>
        <div className="plate-head"><h2 id="readout-title">Strategy</h2><span className="plate-meta">{completion.completed}/5 complete</span></div>
        <div className="screen">
          <p className="readout xl" aria-label={`${completion.percentage} percent`}>{completion.percentage}<small>%</small></p>
          <SectionSegments workspace={workspace}/>
        </div>
        <p className="inst-row" style={{ marginTop: 12 }}><span><span className={`led ${roadmapProgress.total ? "" : "off"}`}/> Roadmap</span><strong>{roadmapProgress.done}/{roadmapProgress.total} done</strong></p>
        <div className="plate-foot"><Link className="plate-link" href={`${base}/strategy?section=${firstGap}`}>{completion.completed === 5 ? "Review strategy" : "Continue strategy"}<ArrowRight size={15} aria-hidden/></Link></div>
      </section>

      <section className="plate next-plate" data-size="M" aria-labelledby="next-title">
        <div className="plate-head"><h2 id="next-title">Next step</h2></div>
        <p className="next-title">{next.title}</p>
        <p className="muted next-detail">{next.detail}</p>
        <div className="plate-foot"><Link className="button primary small" href={next.href}>{next.cta}<ArrowRight size={15} aria-hidden/></Link></div>
      </section>

      <section className="plate" data-size="M" aria-labelledby="snapshot-title">
        <div className="plate-head"><h2 id="snapshot-title">Roadmap</h2><span className="plate-meta">{roadmapProgress.done} of {roadmapProgress.total} done{roadmapProgress.skipped ? ` · ${roadmapProgress.skipped} skipped` : ""}</span></div>
        {roadmapProgress.total ? <>
          <RoadmapBar progress={roadmapProgress}/>
          <ul className="task-mini">{openTasks.map(t => <li key={t.id}><span className="mono week-chip">W{t.week}</span><span>{t.title}</span><Badge status={t.status}/></li>)}</ul>
          {!openTasks.length && <p className="plate-empty">No open tasks. Nice work.</p>}
        </> : <p className="plate-empty">No roadmap yet. It adapts to whatever strategy you have saved, so you can generate it any time.</p>}
        <div className="plate-foot"><Link className="plate-link" href={`${base}/roadmap`}>{roadmapProgress.total ? "Open roadmap" : "Generate roadmap"}<ArrowRight size={15} aria-hidden/></Link></div>
      </section>

      <section className="plate profile-plate" data-size="L" aria-labelledby="profile-title">
        <div className="plate-head"><h2 id="profile-title">Profile</h2>
          {!editing && !recovered && <button className="button small" onClick={() => setEditing(true)}><Pencil size={15} aria-hidden/>Edit profile</button>}</div>
        <AnimatePresence mode="wait" initial={false}>
          {editing || recovered
            ? <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
                <ProfileForm initial={startup} onReloaded={latest => { setEditing(true); setWorkspace(latest); }} onCancel={() => setEditing(false)} onSaved={async () => { await refresh(); setEditing(false); notify("Profile saved"); }}/>
              </motion.div>
            : <motion.dl key="view" className="profile-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
                <div><dt className="label">Primary customer segment</dt><dd>{startup.customerSegment}</dd></div>
                <div><dt className="label">Target market</dt><dd>{startup.targetMarket}</dd></div>
                {startup.context && <div><dt className="label">Context</dt><dd>{startup.context}</dd></div>}
                {Object.entries(startup.customFields).map(([k, v]) => <div key={k}><dt className="label">{k}</dt><dd>{v}</dd></div>)}
              </motion.dl>}
        </AnimatePresence>
      </section>
    </div>
  </div>;
}
