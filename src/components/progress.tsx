"use client";
import Link from "next/link";
import type { Workspace } from "@/lib/domain/types";

const short: Record<string, string> = { icp: "ICP", value: "Value", channels: "Channels", pricing: "Pricing", assumptions: "Assumptions" };

/** Five labelled segments, one per strategy section; each links to its editor. */
export function SectionSegments({ workspace, labels = true }: { workspace: Workspace; labels?: boolean }) {
  const base = `/startups/${workspace.startup.id}/strategy`;
  const summary = workspace.completion.sections.map(s => `${s.title} ${s.complete ? "complete" : "incomplete"}`).join(", ");
  return <div className="segments" role="group" aria-label={`${workspace.completion.completed} of 5 sections complete: ${summary}`}>
    {workspace.completion.sections.map(s => {
      const saved = workspace.sections.find(x => x.key === s.key)?.revision ?? 0;
      const state = s.complete ? "complete" : saved ? "draft" : "empty";
      return <Link key={s.key} href={`${base}?section=${s.key}`} className={state} aria-label={`${s.title}: ${s.complete ? "complete" : saved ? "draft" : "not started"}`}>
        <span className="bar"/>{labels && <span aria-hidden>{short[s.key]}</span>}
      </Link>;
    })}
  </div>;
}

export function RoadmapBar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round(done / total * 100) : 0;
  return <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`Roadmap ${done} of ${total} tasks done`}><span style={{ width: `${pct}%` }}/></div>;
}

/** The single most useful next move, derived from saved data. */
export function nextStep(ws: Workspace): { title: string; detail: string; href: string; cta: string } {
  const base = `/startups/${ws.startup.id}`;
  const gap = ws.completion.sections.find(s => !s.complete);
  if (gap) return { title: `Finish ${gap.title}`, detail: `Missing: ${gap.missing.slice(0, 3).join(", ")}${gap.missing.length > 3 ? ` and ${gap.missing.length - 3} more` : ""}.`, href: `${base}/strategy?section=${gap.key}`, cta: "Open section" };
  const active = ws.tasks.filter(t => !t.archived);
  if (!active.length) return { title: "Generate your 30-day roadmap", detail: "All five sections are complete. Turn them into a week-by-week plan.", href: `${base}/roadmap`, cta: "Open roadmap" };
  const open = active.filter(t => t.status === "todo" || t.status === "in_progress").sort((a, b) => a.week - b.week)[0];
  if (open) return { title: open.title, detail: `Week ${open.week} · ${open.deliverable}`, href: `${base}/roadmap#task-${open.id}`, cta: "Open task" };
  return { title: "Review your evidence", detail: "Every roadmap task is closed. Update your strategy with what you learned, then refresh the plan.", href: `${base}/strategy`, cta: "Open strategy" };
}
