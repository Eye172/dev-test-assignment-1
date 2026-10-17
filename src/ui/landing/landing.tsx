"use client";
import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Insights } from "@/lib/domain/insights";
import { aiRoles } from "@/lib/domain/ai";
import { useDisplay } from "../display";
import { Brand, DemoLink, DisplayMenu, ease } from "../kit";
import { AssumptionMap, ChannelBullseye, ReadinessRadar } from "../viz";
import { BlackHole } from "./black-hole";

export type LandingData = { insights: Insights; name: string; segment: string; model: string; stage: string; demoId: string };
const steps = ["describe", "decide", "model", "plan", "learn"] as const;

export function Landing({ data }: { data: LandingData }) {
  const { version } = useDisplay();
  return <div className={`v4-app v4-land is-${version}`}>
    <LandingHeader/>
    {version === "observatory" ? <ObservatoryHero/> : version === "ledger" ? <LedgerHero/> : <FlowHero/>}
    <main id="content">
      <Chain/>
      <Models data={data}/>
      <Team/>
      <Honest/>
    </main>
    <LandingFooter demoId={data.demoId}/>
  </div>;
}

function LandingHeader() {
  const { t } = useDisplay();
  return <header className="land-header">
    <Brand/>
    <nav aria-label="Primary" className="land-nav">
      <a href="#chain">{t("land.chain.title")}</a><a href="#models">{t("dash.models")}</a><a href="#team">{t("nav.ai")}</a>
    </nav>
    <div className="land-header-actions"><DisplayMenu/><Link href="/startups/new" className="v4-button is-primary is-small">{t("land.cta.create")}</Link></div>
  </header>;
}

function HeroCopy({ title, lede }: { title: string; lede: string }) {
  const { t } = useDisplay();
  const words = title.split(" ");
  return <div className="land-copy">
    <h1 id="hero-title" tabIndex={-1} aria-label={title}>{words.map((w, i) => <Fragment key={i}><span className="land-word" aria-hidden><span style={{ animationDelay: `${120 + i * 55}ms` }}>{w}</span></span>{i < words.length - 1 ? " " : ""}</Fragment>)}</h1>
    <p className="land-lede">{lede}</p>
    <div className="land-actions">
      <Link href="/startups/new" className="v4-button is-primary">{t("land.cta.create")}<ArrowRight size={16} aria-hidden className="v4-arrow"/></Link>
      <DemoLink className="v4-button"/>
    </div>
    <p className="land-note mono">{t("land.note")}</p>
  </div>;
}

/* V1 — the cinematic black hole, camera ~7° above the disk plane. */
function ObservatoryHero() {
  const { t } = useDisplay();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  return <section className="land-hero obs-hero-land" ref={ref} aria-labelledby="hero-title">
    <motion.div className="land-scene" style={{ y, opacity: fade }}><BlackHole variant="cinematic"/></motion.div>
    <HeroCopy title={t("land.obs.title")} lede={t("land.obs.lede")}/>
    <a className="land-scroll" href="#chain" aria-label={t("land.scroll")}><span/></a>
  </section>;
}

/* V2 — paper: an engraved orbit plate draws itself, the loop written on its rings. */
function LedgerHero() {
  const { t } = useDisplay();
  const labels = steps.map(s => t(`land.step.${s}`));
  return <section className="land-hero led-hero-land" aria-labelledby="hero-title">
    <HeroCopy title={t("land.led.title")} lede={t("land.led.lede")}/>
    <figure className="led-plate" aria-hidden>
      <svg viewBox="0 0 520 520">
        {[220, 176, 132, 88].map((r, i) => <ellipse key={r} cx="260" cy="260" rx={r} ry={r * 0.36} className="led-plate-orbit" style={{ animationDelay: `${200 + i * 140}ms`, transform: `rotate(${-14 + i * 6}deg)`, transformOrigin: "260px 260px" }} pathLength={1}/>)}
        <circle cx="260" cy="260" r="46" className="led-plate-core"/>
        <circle cx="260" cy="260" r="58" className="led-plate-halo" pathLength={1}/>
        {labels.map((l, i) => {
          const a = (-90 + i * 72) * Math.PI / 180, x = 260 + Math.cos(a) * 232, y = 260 + Math.sin(a) * 196;
          return <g key={l} className="led-plate-mark" style={{ animationDelay: `${900 + i * 120}ms` }}>
            <circle cx={x} cy={y} r="5"/><text x={x + (x > 260 ? 12 : -12)} y={y + 4} textAnchor={x > 262 ? "start" : x < 258 ? "end" : "middle"}>{`${i + 1} · ${l}`}</text>
          </g>;
        })}
      </svg>
      <figcaption className="mono">Fig. 1 — {t("land.chain.lede")}</figcaption>
    </figure>
  </section>;
}

/* V3 — a live graph over a higher-angle black hole: the loop as a system. */
function FlowHero() {
  const { t } = useDisplay();
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setActive(a => (a + 1) % steps.length), 1600);
    return () => clearInterval(id);
  }, []);
  return <section className="land-hero flow-hero-land" aria-labelledby="hero-title">
    <div className="land-scene"><BlackHole variant="high"/></div>
    <HeroCopy title={t("land.flow.title")} lede={t("land.flow.lede")}/>
    <ol className="flow-hero-chain" aria-label={t("land.chain.title")}>{steps.map((s, i) => <li key={s} className={i === active ? "is-active" : i < active ? "is-done" : ""}>
      {i > 0 && <span className="flow-hero-edge" aria-hidden><span/></span>}
      <span className="flow-hero-node"><span className="mono">{i + 1}</span>{t(`land.step.${s}`)}</span>
    </li>)}</ol>
  </section>;
}

function Chain() {
  const { t } = useDisplay();
  return <section className="land-section land-chain" id="chain" aria-labelledby="chain-title">
    <div className="land-section-head"><h2 id="chain-title">{t("land.chain.title")}</h2><p>{t("land.chain.lede")}</p></div>
    <ol className="land-steps">{steps.map((s, i) => <motion.li key={s} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, delay: i * 0.06, ease }}>
      <span className="land-step-n mono">{String(i + 1).padStart(2, "0")}</span>
      <h3>{t(`land.step.${s}`)}</h3>
      <p>{t(`land.step.${s}.t`)}</p>
    </motion.li>)}</ol>
  </section>;
}

function Models({ data }: { data: LandingData }) {
  const { t } = useDisplay();
  return <section className="land-section land-models" id="models" aria-labelledby="models-title">
    <div className="land-section-head"><h2 id="models-title">{t("land.models.title")}</h2><p>{t("land.models.lede")} <span className="mono">{t("land.demoName", { name: data.name })}</span></p></div>
    <div className="land-model-grid">
      <figure className="land-model"><figcaption>{t("readiness.overall")} · <span className="num">{data.insights.readiness.overall}</span></figcaption><ReadinessRadar axes={data.insights.readiness.axes} size={260} compact/></figure>
      <figure className="land-model"><figcaption>{t("amap.title")}</figcaption><AssumptionMap items={data.insights.assumptions} list={false}/></figure>
      <figure className="land-model is-wide"><figcaption>{t("bull.title")}</figcaption><ChannelBullseye channels={data.insights.channels} model={data.model} stage={data.stage}/></figure>
    </div>
  </section>;
}

function Team() {
  const { t } = useDisplay();
  return <section className="land-section land-team" id="team" aria-labelledby="team-title">
    <div className="land-section-head"><h2 id="team-title">{t("land.ai.title")}</h2><p>{t("land.ai.lede")}</p></div>
    <ol className="land-agents">{aiRoles.map((role, i) => <motion.li key={role} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.05 }} style={{ "--i": i } as CSSProperties}>
      <span className="land-agent-orbit" aria-hidden/>
      <h3>{t(`agent.${role}.name`)}</h3><p>{t(`agent.${role}.desc`)}</p>
    </motion.li>)}</ol>
  </section>;
}

function Honest() {
  const { t } = useDisplay();
  return <section className="land-section land-honest" aria-label={t("land.honest.is")}>
    <div><h2>{t("land.honest.is")}</h2><ul>{(["is1", "is2", "is3"] as const).map(k => <li key={k}>{t(`land.honest.${k}`)}</li>)}</ul></div>
    <div><h2>{t("land.honest.isnt")}</h2><ul className="is-not">{(["isnt1", "isnt2", "isnt3"] as const).map(k => <li key={k}>{t(`land.honest.${k}`)}</li>)}</ul></div>
  </section>;
}

function LandingFooter({ demoId }: { demoId: string }) {
  const { t } = useDisplay();
  return <footer className="land-footer">
    <div className="land-footer-cta">
      <p className="land-footer-title">{t("land.obs.title")}</p>
      <div className="land-actions"><Link href="/startups/new" className="v4-button is-primary">{t("land.cta.create")}<ArrowRight size={16} aria-hidden className="v4-arrow"/></Link>
        <Link href={`/startups/${demoId}`} className="v4-button">{t("land.demoName", { name: "Fieldnote" })}<ArrowUpRight size={16} aria-hidden/></Link></div>
    </div>
    <p className="land-footer-note mono">{t("land.footer")}</p>
  </footer>;
}
