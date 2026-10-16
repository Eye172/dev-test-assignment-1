"use client";
import { useEffect, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";
import type { SectionKey } from "@/lib/domain/schemas";
import type { Task, Workspace } from "@/lib/domain/types";
import { useHydrated } from "./ui";

export type SectionState = "complete" | "draft" | "empty";
export type OrbitSection = { key: SectionKey; title: string; state: SectionState; missing: number };
export type OrbitModel = { sections: OrbitSection[]; completion: number; weeks: [number, number, number, number]; planDay: number | null; plan: number; hasPlan: boolean };

const short: Record<SectionKey, string> = { icp: "Ideal customer", value: "Value", channels: "Channels", pricing: "Pricing", assumptions: "Assumptions" };
export const sectionShort = short;
const dayMs = 86_400_000;

/** Day of the 30-day plan, counted from when the plan was first generated. Client-only (uses the clock). */
export function planDay(tasks: Task[], activePlanCreatedAt?:string): number | null {
  const generated = activePlanCreatedAt?[Date.parse(activePlanCreatedAt)].filter(Number.isFinite):tasks.filter(t => t.source === "generated"||t.source==="ai").map(t => Date.parse(t.createdAt)).filter(Number.isFinite);
  if (!generated.length) return null;
  return Math.min(30, Math.max(1, Math.floor((Date.now() - Math.min(...generated)) / dayMs) + 1));
}

export function weekDone(tasks: Task[]): [number, number, number, number] {
  const active = tasks.filter(t => !t.archived && t.status !== "skipped");
  return [1, 2, 3, 4].map(w => {
    const week = active.filter(t => t.week === w);
    return week.length ? week.filter(t => t.status === "done").length / week.length : 0;
  }) as [number, number, number, number];
}

export function useOrbitModel(workspace: Workspace): OrbitModel {
  const hydrated = useHydrated();
  const sections = workspace.completion.sections.map(s => {
    const saved = workspace.sections.find(x => x.key === s.key)?.revision ?? 0;
    return { key: s.key, title: s.title, missing: s.missing.length, state: (s.complete ? "complete" : saved ? "draft" : "empty") as SectionState };
  });
  const active = workspace.tasks.filter(t => !t.archived);
  return { sections, completion: workspace.completion.percentage, weeks: weekDone(workspace.tasks), planDay: hydrated ? planDay(active,workspace.activePlan?.createdAt) : null,
    plan: workspace.roadmapProgress.percentage, hasPlan: active.length > 0 };
}

const C = 100;
// Rounded so server and browser serialize identical attribute strings (no hydration mismatch).
const round = (v: number) => Math.round(v * 100) / 100;
const polar = (r: number, deg: number) => { const a = (deg - 90) * Math.PI / 180; return [round(C + r * Math.cos(a)), round(C + r * Math.sin(a))] as const; };
function arc(r: number, from: number, to: number) {
  const [x1, y1] = polar(r, from); const [x2, y2] = polar(r, to);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}
// Day ticks: weeks 1–3 have seven days, week 4 has nine (days 22–30).
const weekOfDay = (day: number) => Math.min(4, Math.floor((day - 1) / 7) + 1);
const daysInWeek = (w: number) => w === 4 ? 9 : 7;

/** Counts toward a value when it changes. Server and first client render show the final value. */
export function Counter({ value, from, duration = 0.9, className }: { value: number; from?: number; duration?: number; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(from ?? value);
  const [shown, setShown] = useState(from ?? value);
  useMotionValueEvent(mv, "change", v => setShown(Math.round(v)));
  useEffect(() => {
    if (reduce || document.documentElement.dataset.motion === "reduced") { mv.jump(value); return; }
    const controls = animate(mv, value, { duration, ease: [0.23, 1, 0.32, 1] });
    return () => controls.stop();
  }, [value, duration, mv, reduce]);
  return <span className={className}>{shown}</span>;
}

type DialProps = {
  model: OrbitModel; size?: number; base?: string; interactive?: boolean; countFrom?: number;
  center?: ReactNode; label?: string; className?: string; idle?: boolean;
};

/**
 * The Orbit dial: inner ring = five strategy sections, outer ring = 30 plan days lit by finished work,
 * satellite = today's plan day. Interactive dials link each section to its editor.
 */
export function OrbitDial({ model, size = 280, base, interactive = false, countFrom, center, label, className = "", idle = false }: DialProps) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<OrbitSection | null>(null);
  const reduce = useReducedMotion();
  const gap = 7; const span = 72;
  const ticks = Array.from({ length: 30 }, (_, i) => {
    const day = i + 1; const w = weekOfDay(day);
    const firstDay = (w - 1) * 7 + 1; const lit = Math.round(model.weeks[w - 1] * daysInWeek(w));
    return { day, lit: day - firstDay < lit, major: day === 1 || day === 8 || day === 15 || day === 22, angle: i * 12 + 6 };
  });
  const satellite = model.planDay ? (model.planDay - 1) * 12 + 6 : null;
  const summary = label ?? `Strategy ${model.completion}% complete, ${model.sections.filter(s => s.state === "complete").length} of 5 sections. ${model.hasPlan ? `Plan ${model.plan}% done${model.planDay ? `, day ${model.planDay} of 30` : ""}.` : "No plan yet."}`;
  const segment = (s: OrbitSection, i: number) => {
    const from = i * span + gap / 2; const to = (i + 1) * span - gap / 2;
    const d = arc(60, from, to);
    const stroke = s.state === "complete" ? "var(--inst-accent)" : s.state === "draft" ? "var(--inst-mint)" : "var(--inst-line-strong)";
    // CSS-drawn (not JS) so the saved state is visible on first paint and without JavaScript.
    const path = <>
      <path d={d} className="dial-track" />
      <path d={d} pathLength={1} className={`dial-seg ${s.state}`} stroke={stroke} style={{ animationDelay: `${150 + i * 90}ms` }} />
    </>;
    if (!interactive || !base) return <g key={s.key}>{path}</g>;
    return <Link key={s.key} href={`${base}/strategy?section=${s.key}`} className="dial-link"
      aria-label={`${s.title}: ${s.state === "complete" ? "complete" : s.state === "draft" ? `draft, ${s.missing} missing` : "not started"}`}
      onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(s)} onBlur={() => setHover(null)}>
      <path d={d} className="dial-hit" />{path}
    </Link>;
  };
  const decorative = label === "";
  return <div className={`orbit-dial ${idle ? "idle" : ""} ${className}`} style={{ width: size, height: size }}
    role={decorative ? undefined : interactive ? "group" : "img"} aria-label={decorative ? undefined : summary} aria-hidden={decorative || undefined}>
    <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden={interactive ? undefined : true}>
      <defs>
        <radialGradient id={`${id}-glow`} cx="50%" cy="38%" r="70%">
          <stop offset="0%" stopColor="var(--inst-surface)" />
          <stop offset="100%" stopColor="var(--inst-body)" />
        </radialGradient>
        <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      <circle cx={C} cy={C} r={99} fill={`url(#${id}-glow)`} />
      <circle cx={C} cy={C} r={99} className="dial-rim" />
      <circle cx={C} cy={C} r={74} className="dial-guide" />
      <circle cx={C} cy={C} r={46} className="dial-guide" />
      <g className="dial-ticks">{ticks.map(t => {
        const [x1, y1] = polar(t.major ? 82 : 85, t.angle); const [x2, y2] = polar(92, t.angle);
        return <line key={t.day} x1={x1} y1={y1} x2={x2} y2={y2} className={t.lit ? "lit" : t.major ? "major" : ""} style={{ animationDelay: `${380 + t.day * 14}ms` }} />;
      })}</g>
      <g aria-hidden={interactive ? undefined : true}>{model.sections.map(segment)}</g>
      {satellite !== null && <motion.g initial={reduce ? false : { rotate: -150 }} animate={{ rotate: satellite }} style={{ originX: "100px", originY: "100px" }}
        transition={{ type: "spring", stiffness: 40, damping: 14, delay: 0.5 }}>
        <circle cx={C} cy={C - 74} r={7} fill="var(--inst-accent)" opacity={0.35} filter={`url(#${id}-blur)`} />
        <circle cx={C} cy={C - 74} r={3.6} fill="var(--inst-accent)" />
      </motion.g>}
    </svg>
    <div className="dial-center" aria-hidden="true">
      {hover ? <>
        <span className="dial-k">{hover.state === "complete" ? "Complete" : hover.state === "draft" ? `${hover.missing} missing` : "Not started"}</span>
        <span className="dial-hover-title">{short[hover.key]}</span>
      </> : center ?? <>
        <span className="dial-value"><Counter value={model.completion} from={countFrom}/><small>%</small></span>
        <span className="dial-k">Strategy</span>
      </>}
    </div>
  </div>;
}

/** Compact legend that names what the rings mean. */
export function DialLegend({ model }: { model: OrbitModel }) {
  return <dl className="dial-legend">
    <div><dt><span className="lg-swatch inner"/>Inner ring</dt><dd>{model.sections.filter(s => s.state === "complete").length}/5 sections complete</dd></div>
    <div><dt><span className="lg-swatch outer"/>Outer ring</dt><dd>{model.hasPlan ? `${model.plan}% of plan done` : "Plan not generated"}</dd></div>
    <div><dt><span className="lg-swatch sat"/>Satellite</dt><dd>{model.planDay ? `Day ${model.planDay} of 30` : model.hasPlan ? "Plan day" : "Starts with the plan"}</dd></div>
  </dl>;
}
