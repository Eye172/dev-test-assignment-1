"use client";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Pencil, Sparkles } from "lucide-react";
import { useWorkspace } from "@/components/workspace";
import { OrbitDial, DialLegend, useOrbitModel } from "@/components/orbit";
import { PreparedPanel } from "@/components/prepared";
import { useHydrated } from "@/components/ui";
import { useDisplay } from "../display";
import { Readout, SectionMeter, ease } from "../kit";
import { LoadStrip, ReadinessRadar, useSectionStates } from "../viz";
import { RoadmapBar } from "@/components/roadmap";
import { GoLink, ProfileEditor, ProfileFacts, TaskRow, digests, useGeneratePlan, useNextUp } from "./shared";

export function OverviewScreen() {
  const { version } = useDisplay();
  const fromOnboarding = useSearchParams().get("from") === "onboarding";
  return <>
    {fromOnboarding && <PreparedPanel/>}
    {version === "observatory" ? <ObservatoryOverview/> : version === "ledger" ? <LedgerOverview/> : <FlowOverview/>}
  </>;
}

function useOverviewData() {
  const { workspace, insights, base } = useWorkspace();
  const active = workspace.tasks.filter(t => !t.archived);
  const week = insights.load.currentWeek ?? [1, 2, 3, 4].find(w => active.some(t => t.week === w && t.status !== "done" && t.status !== "skipped")) ?? 1;
  const weekTasks = active.filter(t => t.week === week);
  return { workspace, insights, base, active, week, weekTasks, next: useNextUp(insights, base, active), sections: digests(workspace) };
}

/* ───────── V1 Observatory ───────── */
function ObservatoryOverview() {
  const { t } = useDisplay();
  const { workspace, insights, base, active, week, weekTasks, next, sections } = useOverviewData();
  const { startup } = workspace;
  const model = useOrbitModel(workspace);
  const hydrated = useHydrated();
  const deviceReducedMotion = useReducedMotion();
  const reducedMotion = deviceReducedMotion !== false || startup.preferences.motion === "reduced";
  const animateEntry = hydrated && reducedMotion === false;
  const [editing, setEditing] = useState(false);
  const plan = useGeneratePlan();
  const enter = (i: number) => ({ initial: animateEntry ? { opacity: 0, y: 12 } : false as const, animate: { opacity: 1, y: 0 }, transition: { duration: reducedMotion ? 0 : 0.5, ease, delay: reducedMotion ? 0 : 0.06 * i } });
  const testFirst = insights.assumptions.filter(a => a.quadrant === "test_first").length;
  return <div className="obs-page obs-overview">
    <section className="obs-hero" aria-labelledby="startup-name">
      <motion.div className="obs-identity" {...enter(0)}>
        <h1 id="startup-name" tabIndex={-1}>{startup.name}</h1>
        <p className="obs-meta mono">{startup.businessModel} · {t(`stage.${startup.stage}`)} · {startup.targetMarket}</p>
        <p className="obs-desc">{startup.description}</p>
        <div className="obs-actions">
          <Link className="v4-button is-primary" href={next.href}>{next.cta}<ArrowUpRight size={16} aria-hidden className="v4-arrow"/></Link>
          <button type="button" className="v4-button" disabled={!hydrated} onClick={() => setEditing(true)}><Pencil size={15} aria-hidden/>{t("ov.editProfile")}</button>
        </div>
      </motion.div>
      <motion.div className="obs-dial" initial={animateEntry ? { opacity: 0, scale: 0.94, rotate: -6 } : false} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: "spring", duration: reducedMotion ? 0 : 1.1, bounce: 0.15 }}>
        <OrbitDial model={model} size={300} base={base} interactive/>
        <DialLegend model={model}/>
      </motion.div>
    </section>

    <motion.section className="obs-next" aria-labelledby="next-title" {...enter(1)}>
      <div><h2 id="next-title" className="obs-label">{t("ov.nextUp")}</h2><p className="obs-next-title">{next.title}</p>{next.detail && <p className="obs-next-detail">{next.detail}</p>}</div>
      <Link className="obs-next-go" href={next.href} aria-label={`${next.cta}: ${next.title}`}><ArrowUpRight size={26} aria-hidden/></Link>
    </motion.section>

    <motion.section className="obs-telemetry" aria-label={t("dash.models")} {...enter(2)}>
      <Readout label={t("dash.completion")} value={`${workspace.completion.percentage}%`} meaning={t("ov.sectionsDone", { n: workspace.completion.completed })}/>
      <Readout label={t("readiness.overall")} value={insights.readiness.overall} unit="/100" meaning={t(`band.${insights.readiness.band}`)}/>
      <Readout label={t("ov.planProgress")} value={`${workspace.roadmapProgress.percentage}%`} meaning={active.length ? undefined : t("ov.noTasks")}>{active.length > 0 && <RoadmapBar progress={workspace.roadmapProgress}/>}</Readout>
      <Readout label={t("common.day")} value={insights.load.planDay ?? "—"} unit="/30" meaning={insights.load.overdue ? t("load.overdue", { n: insights.load.overdue }) : t("ov.thisWeek") + ` · ${t("common.weekN", { n: week })}`}/>
      <Readout label={t("amap.test_first")} value={testFirst} meaning={t("amap.title")}/>
      <Readout label={t("ladder.title")} value={insights.ladder.reached ? insights.ladder.rungs.findIndex(r => r.rung === insights.ladder.reached) + 1 : 0} unit="/7" meaning={insights.ladder.reached ? t(`rung.${insights.ladder.reached}`) : t("ladder.none")}/>
    </motion.section>

    <motion.section className="obs-decisions" aria-labelledby="decisions-title" {...enter(3)}>
      <div className="obs-section-head"><h2 id="decisions-title">{t("ov.decisions")}</h2><GoLink href={`${base}/strategy`}>{t("ov.openStrategy")}</GoLink></div>
      <ol className="obs-decision-grid">{sections.map(s => <li key={s.key} className={`obs-decision is-${s.state}`}>
        <Link href={`${base}/strategy?section=${s.key}`}>
          <span className="obs-label">{t(`section.short.${s.key}`)}</span>
          <span className={`v4-state is-${s.state}`}>{s.state === "complete" ? t("common.complete") : t("dash.sectionMissing", { n: s.missing })}</span>
          <span className="obs-decision-head">{s.headline || t("common.notSet")}</span>
        </Link>
      </li>)}</ol>
    </motion.section>

    <div className="obs-pair">
      <motion.section className="obs-panel" aria-labelledby="radar-title" {...enter(4)}>
        <div className="obs-section-head"><h2 id="radar-title">{t("readiness.overall")}</h2><span className="v4-prov is-rules">{t("common.rules")}</span></div>
        <ReadinessRadar axes={insights.readiness.axes} size={280}/>
      </motion.section>
      <motion.section className="obs-panel" aria-labelledby="week-title" {...enter(5)}>
        <div className="obs-section-head"><h2 id="week-title">{t("ov.thisWeek")} · {t("common.weekN", { n: week })}</h2>{active.length > 0 && <GoLink href={`${base}/roadmap`}>{t("ov.openRoadmap")}</GoLink>}</div>
        {active.length ? <ul className="v4-task-list">{weekTasks.map(task => <TaskRow key={task.id} task={task} base={base}/>)}</ul>
          : <div className="v4-empty-block"><p>{t("load.noPlan")}</p><button type="button" className="v4-button is-primary" onClick={() => void plan.run()} disabled={plan.busy}>{t("ov.generate")}</button>{plan.error && <p className="v4-error" role="alert">{plan.error}</p>}</div>}
        <LoadStrip load={insights.load}/>
      </motion.section>
    </div>

    <motion.section className="obs-panel obs-profile" aria-labelledby="profile-title" {...enter(6)}>
      <div className="obs-section-head"><h2 id="profile-title">{t("ov.profile")}</h2><button type="button" className="v4-link" onClick={() => setEditing(true)}>{t("common.edit")}</button></div>
      <ProfileFacts startup={startup}/>
      {startup.context && <p className="obs-context">{startup.context}</p>}
    </motion.section>
    <ProfileEditor open={editing} onClose={() => setEditing(false)}/>
  </div>;
}

/* ───────── V2 Ledger ───────── */
function LedgerOverview() {
  const { t, date } = useDisplay();
  const { workspace, insights, base, active, week, weekTasks, next, sections } = useOverviewData();
  const { startup } = workspace;
  const [editing, setEditing] = useState(false);
  const states = useSectionStates(workspace);
  const plan = useGeneratePlan();
  const hydrated = useHydrated();
  return <article className="led-page led-cover">
    <header className="led-cover-head">
      <h1 id="startup-name" tabIndex={-1} className="led-reveal">{startup.name}</h1>
      <p className="led-lede led-reveal" style={{ "--d": "80ms" } as CSSProperties}>{startup.description}</p>
      <div className="led-cover-actions led-reveal" style={{ "--d": "140ms" } as CSSProperties}>
        <Link className="v4-button is-primary" href={next.href}>{next.cta}<ArrowUpRight size={16} aria-hidden className="v4-arrow"/></Link>
        <button type="button" className="v4-button is-quiet" disabled={!hydrated} onClick={() => setEditing(true)}><Pencil size={15} aria-hidden/>{t("ov.editProfile")}</button>
      </div>
    </header>

    <section className="led-block" aria-labelledby="profile-title">
      <div className="led-block-head"><h2 id="profile-title">{t("ov.profile")}</h2></div>
      <div className="led-ruled"><ProfileFacts startup={startup}/>{startup.context && <p className="led-note">{startup.context}</p>}</div>
    </section>

    <section className="led-block" aria-labelledby="decisions-title">
      <div className="led-block-head"><h2 id="decisions-title">{t("ov.decisions")}</h2>
        <aside className="led-margin mono">{t("dash.completion")} {workspace.completion.percentage}%<br/>{t("dash.completionFormula")}</aside></div>
      <SectionMeter states={states} labels={sections.map(s => t(`section.${s.key}`))}/>
      <ol className="led-entries">{sections.map((s, i) => <li key={s.key} className={`led-entry is-${s.state}`}>
        <span className="led-entry-n mono">{i + 1}</span>
        <div className="led-entry-term"><Link href={`${base}/strategy?section=${s.key}`}>{t(`section.${s.key}`)}</Link><span className="led-entry-q">{t(`section.question.${s.key}`)}</span></div>
        <p className={`led-entry-text ${s.headline ? "" : "is-empty"}`}>{s.headline || t("common.notSet")}</p>
        <aside className="led-margin mono"><span className={`v4-state is-${s.state}`}>{s.state === "complete" ? t("common.complete") : t("dash.sectionMissing", { n: s.missing })}</span>{s.updatedAt && <time dateTime={s.updatedAt} title={s.updatedAt}>{date(s.updatedAt)}</time>}</aside>
      </li>)}</ol>
    </section>

    <section className="led-block led-next" aria-labelledby="next-title">
      <div className="led-block-head"><h2 id="next-title">{t("ov.nextUp")}</h2><aside className="led-margin mono">{t("readiness.overall")} {insights.readiness.overall}/100 · {t(`band.${insights.readiness.band}`)}</aside></div>
      <p className="led-next-text"><Link href={next.href}>{next.title}</Link>{next.detail && <> — {next.detail}</>}</p>
    </section>

    <section className="led-block" aria-labelledby="week-title">
      <div className="led-block-head"><h2 id="week-title">{t("ov.thisWeek")} · {t("common.weekN", { n: week })}</h2>
        {active.length > 0 && <aside className="led-margin mono">{t("ov.tasksDone", { done: workspace.roadmapProgress.done, total: workspace.roadmapProgress.total - workspace.roadmapProgress.skipped })}</aside>}</div>
      {active.length ? <ul className="v4-task-list">{weekTasks.map(task => <TaskRow key={task.id} task={task} base={base}/>)}</ul>
        : <p className="led-note">{t("load.noPlan")} <button type="button" className="v4-link" onClick={() => void plan.run()} disabled={plan.busy}>{t("ov.generate")}</button></p>}
      {active.length > 0 && <RoadmapBar progress={workspace.roadmapProgress}/>}
      <p className="led-more"><GoLink href={`${base}/dashboard`}>{t("ov.openDashboard")}</GoLink></p>
    </section>
    <ProfileEditor open={editing} onClose={() => setEditing(false)}/>
  </article>;
}

/* ───────── V3 Flow ───────── */
type Edge = [string, string];
function Node({ id, k, title, value, state, href, children }: { id: string; k?: string; title: string; value?: string; state?: string; href?: string; children?: React.ReactNode }) {
  const body = <><span className="flow-node-port" aria-hidden/><span className="flow-node-kicker">{k}</span><strong>{title}</strong>{value && <span className="flow-node-value">{value}</span>}{children}</>;
  return href ? <Link href={href} data-node={id} className={`flow-node is-${state ?? "idle"}`}>{body}</Link> : <div data-node={id} className={`flow-node is-${state ?? "idle"}`}>{body}</div>;
}
function FlowOverview() {
  const { t } = useDisplay();
  const { workspace, insights, base, active, week, weekTasks, next, sections } = useOverviewData();
  const { startup } = workspace;
  const [editing, setEditing] = useState(false);
  const plan = useGeneratePlan();
  const hydrated = useHydrated();
  const byKey = Object.fromEntries(sections.map(s => [s.key, s]));
  const graph = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<{ id: string; d: string; hot: boolean }[]>([]);
  const edges: Edge[] = [["profile", "icp"], ["profile", "value"], ["icp", "channels"], ["value", "pricing"], ["channels", "assumptions"], ["pricing", "assumptions"],
    ["assumptions", "w1"], ["assumptions", "w2"], ["assumptions", "w3"], ["assumptions", "w4"], ["w1", "evidence"], ["w2", "evidence"], ["w3", "evidence"], ["w4", "evidence"], ["evidence", "decision"]];
  useLayoutEffect(() => {
    const root = graph.current; if (!root) return;
    const draw = () => {
      const box = root.getBoundingClientRect();
      if (box.width < 860) { setPaths([]); return; }
      const rect = (id: string) => root.querySelector<HTMLElement>(`[data-node="${id}"]`)?.getBoundingClientRect();
      setPaths(edges.flatMap(([a, b]) => {
        const ra = rect(a), rb = rect(b); if (!ra || !rb) return [];
        const x1 = ra.right - box.left, y1 = ra.top + ra.height / 2 - box.top, x2 = rb.left - box.left, y2 = rb.top + rb.height / 2 - box.top, mx = (x1 + x2) / 2;
        const hot = (a === "assumptions" && b === `w${week}`) || (a === `w${week}` && b === "evidence");
        return [{ id: `${a}-${b}`, d: `M${x1.toFixed(1)},${y1.toFixed(1)} C${mx.toFixed(1)},${y1.toFixed(1)} ${mx.toFixed(1)},${y2.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`, hot }];
      }));
    };
    draw();
    const ro = new ResizeObserver(draw); ro.observe(root);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, workspace]);
  const sectionNode = (key: "icp" | "value" | "channels" | "pricing") => <Node id={key} k={t(`section.short.${key}`)} title={byKey[key].headline || t("common.notSet")} state={byKey[key].state}
    value={byKey[key].state === "complete" ? t("common.complete") : t("dash.sectionMissing", { n: byKey[key].missing })} href={`${base}/strategy?section=${key}`}/>;
  const assumptions = insights.assumptions.filter(a => a.source === "stated");
  return <div className="flow-page flow-overview">
    <header className="flow-head">
      <div>
        <h1 id="startup-name" tabIndex={-1}>{startup.name}</h1>
        <p className="flow-meta mono">{startup.businessModel} · {t(`stage.${startup.stage}`)} · {startup.targetMarket}</p>
      </div>
      <div className="flow-head-actions">
        <button type="button" className="v4-button" disabled={!hydrated} onClick={() => setEditing(true)}><Pencil size={15} aria-hidden/>{t("ov.editProfile")}</button>
        <Link className="v4-button is-primary" href={next.href}>{next.cta}<ArrowUpRight size={16} aria-hidden className="v4-arrow"/></Link>
      </div>
    </header>

    <section className="flow-graph-wrap" aria-label={t("land.chain.title")}>
      <div className="flow-graph" ref={graph}>
        <svg className="flow-edges" aria-hidden>{paths.map((p, i) => <path key={p.id} d={p.d} pathLength={1} className={p.hot ? "is-hot" : ""} style={{ animationDelay: `${120 + i * 35}ms` }}/>)}</svg>
        <div className="flow-col"><span className="flow-col-label">{t("land.step.describe")}</span>
          <Node id="profile" k={t("nav.profile")} title={startup.customerSegment} value={startup.targetMarket} state="complete"/></div>
        <div className="flow-col"><span className="flow-col-label">{t("land.step.decide")}</span>{sectionNode("icp")}{sectionNode("value")}</div>
        <div className="flow-col"><span className="flow-col-label">&nbsp;</span>{sectionNode("channels")}{sectionNode("pricing")}</div>
        <div className="flow-col"><span className="flow-col-label">{t("land.step.model")}</span>
          <Node id="assumptions" k={t("section.short.assumptions")} title={t("amap.title")} state={byKey.assumptions.state} href={`${base}/dashboard#assumptions`}
            value={`${insights.assumptions.filter(a => a.quadrant === "test_first").length} · ${t("amap.test_first")}`}>
            <ol className="flow-node-list">{(assumptions.length ? assumptions : insights.assumptions).slice(0, 3).map(a => <li key={a.id} className={`is-${a.quadrant}`}>{a.statement}</li>)}</ol>
          </Node></div>
        <div className="flow-col"><span className="flow-col-label">{t("land.step.plan")}</span>{insights.load.weeks.map(w =>
          <Node key={w.week} id={`w${w.week}`} k={t("common.weekN", { n: w.week })} title={w.total ? `${w.done}/${w.total}` : "—"} state={w.week === week ? "current" : w.total && w.done === w.total - w.skipped ? "complete" : "idle"} href={`${base}/roadmap`}>
            <span className="flow-node-bar" style={{ "--v": w.total ? w.done / Math.max(1, w.total - w.skipped) : 0 } as CSSProperties}/>
          </Node>)}</div>
        <div className="flow-col"><span className="flow-col-label">{t("land.step.learn")}</span>
          <Node id="evidence" k={t("ladder.title")} title={insights.ladder.reached ? t(`rung.${insights.ladder.reached}`) : t("ladder.none")} state={insights.ladder.reached ? "complete" : "idle"} href={`${base}/dashboard#evidence`}/>
          <Node id="decision" k={t("ov.nextUp")} title={next.title} state="current" href={next.href}/></div>
      </div>
    </section>

    <div className="flow-split">
      <section className="flow-panel" aria-labelledby="week-title">
        <div className="flow-panel-head"><h2 id="week-title">{t("ov.thisWeek")} · {t("common.weekN", { n: week })}</h2>{active.length > 0 && <GoLink href={`${base}/roadmap`}>{t("ov.openRoadmap")}</GoLink>}</div>
        {active.length ? <ul className="v4-task-list">{weekTasks.map(task => <TaskRow key={task.id} task={task} base={base}/>)}</ul>
          : <div className="v4-empty-block"><p>{t("load.noPlan")}</p><button type="button" className="v4-button is-primary" onClick={() => void plan.run()} disabled={plan.busy}>{t("ov.generate")}</button></div>}
        {active.length > 0 && <RoadmapBar progress={workspace.roadmapProgress}/>}
      </section>
      <section className="flow-panel" aria-labelledby="radar-title">
        <div className="flow-panel-head"><h2 id="radar-title">{t("readiness.overall")} <span className="num">{insights.readiness.overall}</span></h2><Link className="v4-link" href={`${base}/ai`}><Sparkles size={14} aria-hidden/>{t("nav.ai")}</Link></div>
        <ReadinessRadar axes={insights.readiness.axes} size={240} compact/>
      </section>
    </div>
    <ProfileEditor open={editing} onClose={() => setEditing(false)}/>
  </div>;
}
