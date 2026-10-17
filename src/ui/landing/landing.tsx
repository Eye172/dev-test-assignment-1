"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowRight, ArrowUpRight, Pause, Play } from "lucide-react";
import type { Insights } from "@/lib/domain/insights";
import { useDisplay } from "../display";
import { Brand, DemoLink, DisplayMenu } from "../kit";
import { AssumptionMap, ChannelBullseye, ReadinessRadar } from "../viz";
import { SignalFlow } from "./signal-flow";
import { BlackHole } from "./black-hole";
import { exampleMap } from "./example-map";

export type LandingData = { insights: Insights; name: string; segment: string; model: string; stage: string; demoId: string };
const steps = ["describe", "decide", "model", "plan", "learn"] as const;

export function Landing({ data }: { data: LandingData }) {
  const { version } = useDisplay();
  const root = useRef<HTMLDivElement>(null);
  useSlideEntries(root, version);
  return <div ref={root} className={`v4-app v4-land is-${version}`}>
    <LandingHeader/>
    {version === "observatory" ? <ObservatoryHero/> : version === "ledger" ? <LedgerHero/> : <FlowHero/>}
    <main id="content">
      <Chain/>
      <Models data={data}/>
    </main>
    <LandingFooter demoId={data.demoId}/>
  </div>;
}

function LandingHeader() {
  const { t } = useDisplay();
  return <header className="land-header">
    <Brand/>
    <nav aria-label="Primary" className="land-nav">
      <a href="#chain">{t("land.chain.title")}</a><a href="#models">{t("dash.models")}</a>
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
  </div>;
}

/* V1 — the cinematic black hole, camera ~7° above the disk plane. */
function ObservatoryHero() {
  const { t } = useDisplay();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const reduce = useReducedMotion();
  const y = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 60]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  return <section className="land-hero obs-hero-land" ref={ref} aria-labelledby="hero-title">
    <HeroScene variant="cinematic" y={y} opacity={fade}/>
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
          const side = x > 262 ? 1 : x < 258 ? -1 : 0;
          return <g key={l} className="led-plate-mark" style={{ animationDelay: `${900 + i * 120}ms` }}>
            <circle cx={x} cy={y} r="5"/><text x={x - side * 12} y={y > 360 ? y + (side > 0 ? 26 : -14) : side ? y + 4 : y - 14} textAnchor={side > 0 ? "end" : side < 0 ? "start" : "middle"}>{`${i + 1} · ${l}`}</text>
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
    const reduce=matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | undefined;
    let visible=true;
    const sync=()=>{clearInterval(timer);if(!reduce.matches&&!document.hidden&&visible)timer=setInterval(()=>setActive(a=>(a+1)%steps.length),1600);};
    const hero=document.querySelector(".flow-hero-land");
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();});
    if(hero)observer.observe(hero);sync();
    reduce.addEventListener("change",sync);document.addEventListener("visibilitychange",sync);
    return()=>{clearInterval(timer);observer.disconnect();reduce.removeEventListener("change",sync);document.removeEventListener("visibilitychange",sync);};
  }, []);
  return <section className="land-hero flow-hero-land" aria-labelledby="hero-title">
    <HeroScene variant="high"/>
    <HeroCopy title={t("land.flow.title")} lede={t("land.flow.lede")}/>
    <ol className="flow-hero-chain" aria-label={t("land.chain.title")}>{steps.map((s, i) => <li key={s} className={i === active ? "is-active" : i < active ? "is-done" : ""}>
      {i > 0 && <span className="flow-hero-edge" aria-hidden><span/></span>}
      <span className="flow-hero-node"><span className="mono">{i + 1}</span>{t(`land.step.${s}`)}</span>
    </li>)}</ol>
  </section>;
}

function Chain() {
  const { t } = useDisplay();
  return <section data-slide className="land-section land-chain" id="chain" aria-labelledby="chain-title">
    <div className="land-chain-head"><div className="land-section-head"><h2 id="chain-title">{t("land.chain.title")}</h2><p>{t("land.chain.lede")}</p></div><SignalFlow/></div>
    <ol className="land-steps">{steps.map((s, i) => <li key={s}>
      <span className="land-step-n mono">{String(i + 1).padStart(2, "0")}</span>
      <h3>{t(`land.step.${s}`)}</h3>
      <p>{t(`land.step.${s}.t`)}</p>
    </li>)}</ol>
  </section>;
}

function Models({ data }: { data: LandingData }) {
  const { t } = useDisplay();
  return <section className="land-section land-models" id="models" aria-labelledby="models-title">
    <div data-slide className="land-section-head"><h2 id="models-title">{t("land.models.title")}</h2><p>{t("land.models.lede")} <span className="mono">{t("land.demoName", { name: data.name })}</span></p></div>
    <div className="land-model-grid">
      <figure data-slide className="land-model">
        <figcaption><h3>{t("model.readiness")}</h3><p>{t("model.readiness.detail")}</p><span className="land-model-value"><strong className="num">{data.insights.readiness.overall}</strong><span>/100<br/>{t("readiness.overall")}</span></span></figcaption>
        <div className="land-model-art"><ReadinessRadar axes={data.insights.readiness.axes} size={320}/></div>
      </figure>
      <figure data-slide className="land-model">
        <figcaption><h3>{t("model.assumptions")}</h3><p>{t("model.assumptions.detail")}</p></figcaption>
        <div className="land-model-art"><AssumptionMap items={exampleMap(data.insights.assumptions)} list={false}/></div>
      </figure>
      <figure data-slide className="land-model">
        <figcaption><h3>{t("model.channels")}</h3><p>{t("model.channels.detail")}</p></figcaption>
        <div className="land-model-art"><ChannelBullseye channels={data.insights.channels} model={data.model} stage={data.stage}/></div>
      </figure>
    </div>
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

// Start only once a block approaches the viewport. SSR and no-JS remain visible;
// transforms do not change document flow, and quick scrolling never queues work.
function useSlideEntries(root: React.RefObject<HTMLDivElement | null>, version: string) {
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const nodes = [...(root.current?.querySelectorAll<HTMLElement>("[data-slide]") ?? [])];
    const running = new Set<Animation>();
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      const node = entry.target as HTMLElement;
      node.dataset.revealed = "true";
      if (reduce.matches || node.getBoundingClientRect().top < 0) return;
      const index = nodes.indexOf(node);
      const animation = node.animate([
        { transform: `translate3d(${index % 2 ? 64 : -64}px,0,0)`, opacity: 0.15 },
        { transform: "translate3d(0,0,0)", opacity: 1 },
      ], { duration: 650, easing: "cubic-bezier(0.23,1,0.32,1)" });
      running.add(animation); animation.onfinish = () => running.delete(animation);
    }), { rootMargin: "0px 0px -32px 0px", threshold: 0.08 });
    nodes.forEach(n => observer.observe(n));
    const stop = () => { if (reduce.matches) { running.forEach(a => a.cancel()); running.clear(); } };
    reduce.addEventListener("change", stop);
    return () => { observer.disconnect(); running.forEach(a => a.cancel()); reduce.removeEventListener("change",stop); };
  }, [root, version]);
}

function HeroScene({ variant, y, opacity }: { variant: "cinematic" | "high"; y?: import("motion/react").MotionValue<number>; opacity?: import("motion/react").MotionValue<number> }) {
  const { t } = useDisplay();
  const [paused, setPaused] = useState(false);
  return <>
    <motion.div className="land-scene" style={{ y, opacity }}><BlackHole variant={variant} paused={paused}/></motion.div>
    <div className="land-scene-controls">
      <button type="button" className="land-scene-pause" aria-label={t(paused ? "scene.play" : "scene.pause")} onClick={() => setPaused(p => !p)}>{paused ? <Play size={14} aria-hidden/> : <Pause size={14} aria-hidden/>}</button>
    </div>
  </>;
}
