"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/client-api";
import type { Workspace } from "@/lib/domain/types";
import { ErrorNotice, Spinner } from "./ui";

export function DemoButton({ className = "button" }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  async function open() {
    setPending(true); setError(null);
    try { const ws = await api<Workspace>("/api/demo", { method: "POST" }); router.push(`/startups/${ws.startup.id}`); }
    catch (e) { setError(e as Error); setPending(false); }
  }
  return <>
    <button type="button" className={className} onClick={open} disabled={pending} aria-busy={pending}>
      {pending ? <><Spinner/>Opening demo…</> : <>Explore the demo startup<ArrowRight size={17} aria-hidden/></>}
    </button>
    {error && <div className="welcome-error"><ErrorNotice error={`Couldn't open the demo. ${error.message}`} onRetry={open}/></div>}
  </>;
}

const plates = [
  { name: "Ideal customer", x: -150, y: -112, r: -5, done: true },
  { name: "Value", x: 150, y: -98, r: 4, done: true },
  { name: "Channels", x: 176, y: 54, r: -3, done: true },
  { name: "Pricing", x: -168, y: 70, r: 5, done: false },
  { name: "Assumptions", x: 0, y: 150, r: -2, done: false },
];

/* The app's one authored motion moment. Static under reduced motion. */
export function OrbitVisual() {
  const reduce = useReducedMotion();
  const settle = (i: number) => reduce ? {} : {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.08 + i * 0.045, duration: 0.5, ease: [0.23, 1, 0.32, 1] as const },
  };
  return <div className="orbit-visual" aria-hidden>
    <svg className="orbit-ring" viewBox="-260 -200 520 400">
      <path d="M 173.2 -75 A 200 150 0 1 1 100 -129.9" fill="none" stroke="var(--line-strong)" strokeWidth="1" strokeDasharray="2 6"/>
      <circle cx="0" cy="0" r="7" fill="var(--ink)"/>
      <motion.circle r="7" fill="var(--accent)"
        initial={reduce ? { cx: 228, cy: -160 } : { cx: -200, cy: 0, opacity: 0 }}
        animate={reduce ? undefined : { cx: [-200, -100, 0, 141, 228], cy: [0, -130, -150, -106, -160], opacity: [0, 1, 1, 1, 1] }}
        transition={{ duration: 1.1, delay: 0.35, ease: [0.23, 1, 0.32, 1] }}/>
    </svg>
    {plates.map((p, i) => <motion.div key={p.name} className="orbit-plate" style={{ left: `calc(50% + ${p.x}px)`, top: `calc(50% + ${p.y}px)`, rotate: p.r }} {...settle(i)}>
      <span className={`orbit-dot ${p.done ? "done" : ""}`}/>{p.name}
    </motion.div>)}
    <motion.div className="orbit-core plate instrument" {...settle(5)}>
      <span className="label" style={{ color: "var(--inst-muted)" }}>30-day plan</span>
      <span className="readout lg">8<small>tasks</small></span>
      <span className="inst-row"><span>Strategy</span><strong>60%</strong></span>
    </motion.div>
  </div>;
}
