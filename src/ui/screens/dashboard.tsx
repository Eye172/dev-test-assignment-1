"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import type { AxisKey } from "@/lib/domain/insights";
import type { SectionKey } from "@/lib/domain/schemas";
import { useWorkspace } from "@/components/workspace";
import { useDisplay } from "../display";
import { Provenance, Readout, SectionMeter, ease } from "../kit";
import { AssumptionMap, ChannelBullseye, EvidenceLadder, LoadStrip, PositioningStatement, ReadinessRadar, SizingCalculator, useSectionStates } from "../viz";
import { GoLink, TaskRow, digests, savedAccounts, useFieldLabel, useNextUp, useSaveSizing } from "./shared";

const axisSection: Record<AxisKey, SectionKey | "roadmap"> = { customer: "icp", value: "value", channels: "channels", pricing: "pricing", risk: "assumptions", execution: "roadmap" };

function useDashboardData() {
  const { workspace, insights, base } = useWorkspace();
  const label = useFieldLabel();
  const active = workspace.tasks.filter(t => !t.archived);
  const open = active.filter(t => t.status === "todo" || t.status === "in_progress").sort((a, b) => a.week - b.week).slice(0, 4);
  const improvements = insights.readiness.axes.flatMap(a => a.reasons.filter(r => !r.ok && a.key !== "execution").map(r => ({ axis: a.key, code: r.code, gain: r.code === "planProgress" ? 0 : maxPoints[r.code] ?? 10 })))
    .sort((a, b) => b.gain - a.gain).slice(0, 5);
  const gaps = (["icp", "value", "channels", "pricing", "assumptions"] as const).map(key => ({ key, fields: insights.missing.filter(m => m.section === key).map(label) })).filter(g => g.fields.length);
  return { workspace, insights, base, active, open, improvements, gaps, sections: digests(workspace), next: useNextUp(insights, base, active) };
}
// Points each unmet rule would add (mirrors the insight engine) so suggestions are ranked by impact.
const maxPoints: Record<string, number> = { buyerNamed: 15, buyerRole: 15, segmentSized: 15, painSpecific: 20, triggerTimed: 20, notVague: 15, problemStated: 15, outcomeStated: 15, outcomeMeasurable: 15, differentiated: 15, againstAlternative: 20, proofTyped: 20,
  channelChosen: 20, channelReasoned: 20, channelFocused: 15, experimentDefined: 20, experimentThreshold: 25, modelChosen: 15, priceNumber: 20, priceCurrency: 10, unitDefined: 15, rationaleValue: 20, commitmentTest: 20,
  threeAssumptions: 25, methodsDefined: 25, riskiestNamed: 15, assumptionsMeasurable: 20, lensesCovered: 15 };

export function DashboardScreen() {
  const { version } = useDisplay();
  return version === "observatory" ? <ObservatoryDashboard/> : version === "ledger" ? <LedgerDashboard/> : <FlowDashboard/>;
}

function Panel({ id, title, prov = "rules", wide = false, explain, children, className = "" }: { id: string; title: string; prov?: "rules" | "ai" | "founder"; wide?: boolean; explain?: string; children: ReactNode; className?: string }) {
  return <motion.section id={id} className={`v4-panel ${wide ? "is-wide" : ""} ${className}`} aria-labelledby={`${id}-title`}
    initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.5, ease }}>
    <div className="v4-panel-head"><h2 id={`${id}-title`}>{title}</h2><Provenance kind={prov}/></div>
    {explain && <p className="v4-panel-explain">{explain}</p>}
    {children}
  </motion.section>;
}

function SuggestedSteps({ data }: { data: ReturnType<typeof useDashboardData> }) {
  const { t, tk } = useDisplay();
  return <div className="v4-steps">
    <ol className="v4-step-list">
      {data.improvements.map(i => {
        const target = axisSection[i.axis];
        return <li key={i.code}><Link href={target === "roadmap" ? `${data.base}/roadmap` : `${data.base}/strategy?section=${target}`}>
          <span className="v4-step-gain mono">+{i.gain}</span><span>{tk(`reason.${i.code}`)}</span><span className="v4-step-axis">{t(`axis.${i.axis}`)}</span></Link></li>;
      })}
    </ol>
    {data.open.length > 0 && <ul className="v4-task-list">{data.open.map(task => <TaskRow key={task.id} task={task} base={data.base} showWeek/>)}</ul>}
  </div>;
}

function Gaps({ data }: { data: ReturnType<typeof useDashboardData> }) {
  const { t } = useDisplay();
  if (!data.gaps.length) return <p className="v4-muted">{t("ov.gapsNone")}</p>;
  return <dl className="v4-gaps">{data.gaps.map(g => <div key={g.key}><dt><Link href={`${data.base}/strategy?section=${g.key}`}>{t(`section.${g.key}`)}</Link><span className="num mono">{g.fields.length}</span></dt>
    <dd>{g.fields.map(f => <span key={f} className="v4-gap">{f}</span>)}</dd></div>)}</dl>;
}

function Decisions({ data, rich = false }: { data: ReturnType<typeof useDashboardData>; rich?: boolean }) {
  const { t } = useDisplay();
  return <ol className={`v4-decisions ${rich ? "is-rich" : ""}`}>{data.sections.map(s => <li key={s.key} className={`is-${s.state}`}>
    <Link href={`${data.base}/strategy?section=${s.key}`} className="v4-decision-term">{t(`section.${s.key}`)}</Link>
    <div className="v4-decision-text"><p className={s.headline ? "" : "is-empty"}>{s.headline || t("common.notSet")}</p>{rich && s.detail && <p className="v4-muted">{s.detail}</p>}</div>
    <span className={`v4-state is-${s.state}`}>{s.state === "complete" ? t("common.complete") : t("dash.sectionMissing", { n: s.missing })}</span>
  </li>)}</ol>;
}

/* ───────── V1 Observatory ───────── */
function ObservatoryDashboard() {
  const { t } = useDisplay();
  const data = useDashboardData();
  const { workspace, insights } = data;
  const states = useSectionStates(workspace);
  const saveSizing = useSaveSizing();
  return <div className="obs-page obs-dashboard">
    <header className="v4-page-head">
      <h1 tabIndex={-1}>{t("dash.title")}</h1>
      <p className="v4-lede">{t("dash.lede")}</p>
    </header>
    <section className="obs-telemetry is-dash" aria-label={t("dash.completion")}>
      <Readout className="is-hero" label={t("dash.completion")} value={`${workspace.completion.percentage}%`} meaning={<span className="mono">{t("dash.completionFormula")}</span>}>
        <SectionMeter states={states} labels={data.sections.map(s => t(`section.${s.key}`))}/>
      </Readout>
      <Readout label={t("readiness.overall")} value={insights.readiness.overall} unit="/100" meaning={t(`band.${insights.readiness.band}`)}/>
      <Readout label={t("ov.planProgress")} value={`${workspace.roadmapProgress.percentage}%`} meaning={t("ov.tasksDone", { done: workspace.roadmapProgress.done, total: workspace.roadmapProgress.total - workspace.roadmapProgress.skipped })}/>
      <Readout label={t("ov.gaps")} value={insights.missing.length} meaning={t("ov.sectionsDone", { n: workspace.completion.completed })}/>
    </section>
    <div className="v4-grid">
      <Panel id="decisions" title={t("dash.saved")} prov="founder"><Decisions data={data}/></Panel>
      <Panel id="gaps" title={t("ov.gaps")}><Gaps data={data}/></Panel>
      <Panel id="next" title={t("dash.nextActions")} wide><SuggestedSteps data={data}/></Panel>
      <Panel id="readiness" title={t("readiness.overall")} explain={t("readiness.explain")}><ReadinessRadar axes={insights.readiness.axes} size={300}/></Panel>
      <Panel id="assumptions" title={t("amap.title")} explain={t("amap.explain")}><AssumptionMap items={insights.assumptions}/></Panel>
      <Panel id="channels" title={t("bull.title")} explain={t("bull.explain")} wide><ChannelBullseye channels={insights.channels} model={workspace.startup.businessModel} stage={workspace.startup.stage}/></Panel>
      <Panel id="evidence" title={t("ladder.title")} explain={t("ladder.explain")}><EvidenceLadder ladder={insights.ladder}/></Panel>
      <Panel id="positioning" title={t("pos.title")} explain={t("pos.explain")}><PositioningStatement slots={insights.positioning.slots} name={workspace.startup.name}/><p className="v4-footnote">{t("pos.filled", { n: insights.positioning.filled })}</p></Panel>
      <Panel id="sizing" title={t("size.title")} explain={t("size.explain")} prov="founder" wide><SizingCalculator price={insights.price} market={workspace.startup.targetMarket} initial={savedAccounts(workspace.startup)} onSave={saveSizing}/></Panel>
      <Panel id="load" title={t("load.title")} explain={t("load.explain")} wide><LoadStrip load={insights.load}/></Panel>
    </div>
    <p className="v4-honest">{t("ov.honest")}</p>
  </div>;
}

/* ───────── V2 Ledger ───────── */
function LedgerDashboard() {
  const { t } = useDisplay();
  const data = useDashboardData();
  const { workspace, insights } = data;
  const states = useSectionStates(workspace);
  const saveSizing = useSaveSizing();
  const chapters = [
    ["completion", t("dash.completion")], ["decisions", t("dash.saved")], ["gaps", t("ov.gaps")], ["next", t("dash.nextActions")],
    ["readiness", t("readiness.overall")], ["assumptions", t("amap.title")], ["channels", t("bull.title")], ["evidence", t("ladder.title")],
    ["positioning", t("pos.title")], ["sizing", t("size.title")], ["load", t("load.title")],
  ] as const;
  const [current, setCurrent] = useState<string>("completion");
  useEffect(() => {
    const io = new IntersectionObserver(entries => { const v = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (v) setCurrent(v.target.id); }, { rootMargin: "-20% 0px -60% 0px" });
    chapters.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const Chapter = ({ id, n, title, explain, prov = "rules", children }: { id: string; n: number; title: string; explain?: string; prov?: "rules" | "founder"; children: ReactNode }) =>
    <section id={id} className="led-chapter" aria-labelledby={`${id}-title`}>
      <header className="led-chapter-head"><span className="led-chapter-n mono">§{n}</span><h2 id={`${id}-title`}>{title}</h2><Provenance kind={prov}/></header>
      {explain && <p className="led-chapter-explain">{explain}</p>}
      <div className="led-chapter-body">{children}</div>
    </section>;
  return <div className="led-page led-dashboard">
    <aside className="led-toc" aria-label={t("nav.contents")}>
      <p className="led-toc-title">{t("nav.contents")}</p>
      <ol>{chapters.map(([id, label], i) => <li key={id}><a href={`#${id}`} className={current === id ? "is-current" : ""}><span className="mono">§{i + 1}</span>{label}</a></li>)}</ol>
    </aside>
    <article className="led-doc">
      <header className="led-doc-head"><h1 tabIndex={-1}>{t("dash.title")}</h1><p className="led-lede">{t("dash.lede")}</p></header>
      <Chapter id="completion" n={1} title={t("dash.completion")}>
        <p className="led-figure"><span className="num">{workspace.completion.percentage}%</span><span className="mono">{t("dash.completionFormula")} · {t("ov.sectionsDone", { n: workspace.completion.completed })}</span></p>
        <SectionMeter states={states} labels={data.sections.map(s => t(`section.${s.key}`))}/>
        <p className="led-figure is-small"><span className="num">{workspace.roadmapProgress.percentage}%</span><span className="mono">{t("ov.planProgress")} · {t("ov.tasksDone", { done: workspace.roadmapProgress.done, total: workspace.roadmapProgress.total - workspace.roadmapProgress.skipped })}</span></p>
      </Chapter>
      <Chapter id="decisions" n={2} title={t("dash.saved")} prov="founder"><Decisions data={data} rich/></Chapter>
      <Chapter id="gaps" n={3} title={t("ov.gaps")}><Gaps data={data}/></Chapter>
      <Chapter id="next" n={4} title={t("dash.nextActions")}><SuggestedSteps data={data}/></Chapter>
      <Chapter id="readiness" n={5} title={t("readiness.overall")} explain={t("readiness.explain")}>
        <div className="led-multiples">{insights.readiness.axes.map(a => <div key={a.key} className="led-multiple">
          <div className="led-multiple-head"><span>{t(`axis.${a.key}`)}</span><span className="num mono">{a.score}</span></div>
          <span className="led-bar" style={{ "--v": a.score / 100 } as React.CSSProperties}/>
          <ul className="led-mini-reasons">{a.reasons.filter(r => !r.ok).slice(0, 2).map(r => <li key={r.code}>{t("common.incomplete")}: <ReasonText code={r.code}/></li>)}</ul>
        </div>)}</div>
      </Chapter>
      <Chapter id="assumptions" n={6} title={t("amap.title")} explain={t("amap.explain")}><AssumptionMap items={insights.assumptions}/></Chapter>
      <Chapter id="channels" n={7} title={t("bull.title")} explain={t("bull.explain")}><ChannelBullseye channels={insights.channels} model={workspace.startup.businessModel} stage={workspace.startup.stage}/></Chapter>
      <Chapter id="evidence" n={8} title={t("ladder.title")} explain={t("ladder.explain")}><EvidenceLadder ladder={insights.ladder}/></Chapter>
      <Chapter id="positioning" n={9} title={t("pos.title")} explain={t("pos.explain")}><PositioningStatement slots={insights.positioning.slots} name={workspace.startup.name}/><p className="v4-footnote">{t("pos.filled", { n: insights.positioning.filled })}</p></Chapter>
      <Chapter id="sizing" n={10} title={t("size.title")} explain={t("size.explain")} prov="founder"><SizingCalculator price={insights.price} market={workspace.startup.targetMarket} initial={savedAccounts(workspace.startup)} onSave={saveSizing}/></Chapter>
      <Chapter id="load" n={11} title={t("load.title")} explain={t("load.explain")}><LoadStrip load={insights.load}/></Chapter>
      <p className="v4-honest">{t("ov.honest")}</p>
    </article>
  </div>;
}
function ReasonText({ code }: { code: string }) { const { tk } = useDisplay(); return <>{tk(`reason.${code}`)}</>; }

/* ───────── V3 Flow ───────── */
function FlowDashboard() {
  const { t } = useDisplay();
  const data = useDashboardData();
  const { workspace, insights, base, next } = data;
  const saveSizing = useSaveSizing();
  return <div className="flow-page flow-dashboard">
    <header className="v4-page-head flow-dash-head">
      <div><h1 tabIndex={-1}>{t("dash.title")}</h1><p className="v4-lede">{t("dash.lede")}</p></div>
      <Link className="flow-next-chip" href={next.href}><span className="mono">{t("ov.nextUp")}</span><strong>{next.title}</strong><ArrowUpRight size={16} aria-hidden/></Link>
    </header>
    <ol className="flow-pipeline" aria-label={t("ov.decisions")}>{data.sections.map((s, i) => <li key={s.key} className={`is-${s.state}`}>
      {i > 0 && <span className="flow-pipe-edge" aria-hidden/>}
      <Link href={`${base}/strategy?section=${s.key}`}><span className="flow-pipe-dot" aria-hidden/><span className="mono">{t(`section.short.${s.key}`)}</span><strong>{s.state === "complete" ? t("common.complete") : t("dash.sectionMissing", { n: s.missing })}</strong></Link>
    </li>)}<li className="flow-pipe-total"><span className="num">{workspace.completion.percentage}%</span><span className="mono">{t("dash.completionFormula")}</span></li></ol>
    <div className="flow-board">
      <div className="flow-board-main">
        <Panel id="assumptions" title={t("amap.title")} explain={t("amap.explain")}><AssumptionMap items={insights.assumptions}/></Panel>
        <Panel id="channels" title={t("bull.title")} explain={t("bull.explain")}><ChannelBullseye channels={insights.channels} model={workspace.startup.businessModel} stage={workspace.startup.stage}/></Panel>
        <Panel id="evidence" title={t("ladder.title")} explain={t("ladder.explain")}><EvidenceLadder ladder={insights.ladder}/></Panel>
        <Panel id="load" title={t("load.title")} explain={t("load.explain")}><LoadStrip load={insights.load}/></Panel>
      </div>
      <aside className="flow-inspector" aria-label={t("dash.nextActions")}>
        <Panel id="readiness" title={`${t("readiness.overall")} · ${insights.readiness.overall}`}><ReadinessRadar axes={insights.readiness.axes} size={230} compact/></Panel>
        <Panel id="next" title={t("dash.nextActions")}><SuggestedSteps data={data}/></Panel>
        <Panel id="gaps" title={t("ov.gaps")}><Gaps data={data}/></Panel>
        <Panel id="decisions" title={t("dash.saved")} prov="founder"><Decisions data={data}/></Panel>
        <Panel id="positioning" title={t("pos.title")}><PositioningStatement slots={insights.positioning.slots} name={workspace.startup.name}/></Panel>
        <Panel id="sizing" title={t("size.title")} prov="founder"><SizingCalculator price={insights.price} market={workspace.startup.targetMarket} initial={savedAccounts(workspace.startup)} onSave={saveSizing}/></Panel>
        <GoLink href={`${base}/roadmap`}>{t("ov.openRoadmap")}</GoLink>
      </aside>
    </div>
    <p className="v4-honest">{t("ov.honest")}</p>
  </div>;
}
