"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { sectionKeys, sectionSchemas, type SectionKey } from "@/lib/domain/schemas";
import type { MissingField, Insights } from "@/lib/domain/insights";
import type { Task, Workspace } from "@/lib/domain/types";
import { api } from "@/lib/client-api";
import { Dialog, confirmLeave, useHydrated } from "@/components/ui";
import { ProfileForm } from "@/components/profile-form";
import { StatusRing } from "@/components/status-ring";
import { useTaskPending, useTaskUpdate } from "@/components/task-actions";
import { useWorkspace } from "@/components/workspace";
import { clearDraft, useHasDraft } from "@/components/draft-recovery";
import { useDisplay } from "../display";

export type Digest = { key: SectionKey; state: "complete" | "draft" | "empty"; missing: number; headline: string; detail: string; updatedAt: string | null };
export function digests(workspace: Workspace): Digest[] {
  return sectionKeys.map(key => {
    const section = workspace.sections.find(s => s.key === key);
    const completion = workspace.completion.sections.find(s => s.key === key)!;
    const state = completion.complete ? "complete" : (section?.revision ?? 0) > 0 ? "draft" : "empty";
    let headline = "", detail = "";
    if (key === "icp") { const d = sectionSchemas.icp.parse(section?.data ?? {}); headline = d.buyerType; detail = d.painPoint; }
    if (key === "value") { const d = sectionSchemas.value.parse(section?.data ?? {}); headline = d.outcome; detail = d.differentiation; }
    if (key === "channels") { const d = sectionSchemas.channels.parse(section?.data ?? {}); headline = d.channels.map(c => c.name).filter(Boolean).join(" · "); detail = d.firstExperiment; }
    if (key === "pricing") { const d = sectionSchemas.pricing.parse(section?.data ?? {}); headline = [d.initialPrice, d.paymentUnit].filter(Boolean).join(" / "); detail = d.model; }
    if (key === "assumptions") { const d = sectionSchemas.assumptions.parse(section?.data ?? {}); headline = d.assumptions[0]?.statement ?? ""; detail = d.assumptions.slice(1).map(a => a.statement).filter(Boolean).join(" · "); }
    return { key, state, missing: completion.missing.length, headline, detail, updatedAt: section?.updatedAt ?? null };
  });
}
export function useFieldLabel() {
  const { t, tk } = useDisplay();
  return (m: MissingField) => tk(`field.${m.field}`, { n: (m.index ?? 0) + 1 }, m.field) || t("common.notSet");
}

/** The one next move, localised from the insight engine's code. */
export function useNextUp(insights: Insights, base: string, tasks: Task[]) {
  const { t } = useDisplay();
  const label = useFieldLabel();
  const n = insights.next;
  if (n.kind === "section" && n.section) {
    const missing = insights.missing.filter(m => m.section === n.section);
    return { title: t("ov.next.section", { section: t(`section.${n.section}`) }), detail: t("ov.next.sectionDetail", { field: missing.slice(0, 3).map(label).join(", ") }), href: `${base}/strategy?section=${n.section}`, cta: t("ov.openStrategy") };
  }
  if (n.kind === "task") {
    const task = tasks.find(x => x.id === n.taskId);
    return { title: task?.title ?? t("ov.next.task"), detail: task?.deliverable ?? "", href: `${base}/roadmap#task-${n.taskId}`, cta: t("ov.openRoadmap") };
  }
  return { title: t("ov.next.review"), detail: t("ov.next.reviewDetail"), href: `${base}/dashboard`, cta: t("ov.openDashboard") };
}

export function useGeneratePlan() {
  const { workspace, setWorkspace, track, notify } = useWorkspace();
  const { t, locale } = useDisplay();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setError(null);
    try {
      const body = workspace.activePlan ? { replaceAiPlan: true, expectedPlanId: workspace.activePlan.id, locale } : { locale };
      const ws = await track(api<Workspace>(`/api/startups/${workspace.startup.id}/roadmap`, { method: "POST", body: JSON.stringify(body) }));
      setWorkspace(ws); notify(t("ov.generate"));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return { run, busy, error };
}

export function ProfileEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { workspace, setWorkspace, refresh, notify } = useWorkspace();
  const { t } = useDisplay();
  const { startup } = workspace;
  const recovered = useHasDraft(`profile:${startup.id}`);
  const close = () => { if (confirmLeave()) { clearDraft(`profile:${startup.id}`); onClose(); } };
  return <Dialog open={open || recovered} onClose={close} title={t("ov.editProfile")} className="sheet-dialog">
    <ProfileForm initial={startup} onReloaded={latest => setWorkspace(latest)} onCancel={onClose}
      onSaved={saved => { setWorkspace(ws => ({ ...ws, startup: saved })); onClose(); notify(t("chrome.saved")); void refresh().catch(() => {}); }}/>
  </Dialog>;
}

export function TaskRow({ task, base, showWeek = false }: { task: Task; base: string; showWeek?: boolean }) {
  const { update } = useTaskUpdate();
  const { t } = useDisplay();
  const busy = useTaskPending(task.id);
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);
  return <li className={`v4-task is-${task.status}`}>
    <StatusRing task={task} disabled={busy || !hydrated} label={task.title} onToggle={status => { setError(null); void update(task, { status }).catch(e => setError((e as Error).message)); }}/>
    <Link href={`${base}/roadmap#task-${task.id}`} className="v4-task-title">{task.title}</Link>
    <span className={`v4-status is-${task.status}`}>{showWeek ? `${t("common.weekN", { n: task.week })} · ` : ""}{t(`status.${task.status}`)}</span>
    {error && <span className="v4-error" role="alert">{error}</span>}
  </li>;
}

export function GoLink({ href, children, className = "v4-link" }: { href: string; children: React.ReactNode; className?: string }) {
  return <Link href={href} className={className}>{children}<ArrowRight size={15} aria-hidden className="v4-arrow"/></Link>;
}

/** Profile facts as a definition list, localised labels. */
export function ProfileFacts({ startup }: { startup: Workspace["startup"] }) {
  const { t } = useDisplay();
  const facts: [string, string][] = [
    [t("profile.businessModel"), startup.businessModel], [t("profile.stage"), t(`stage.${startup.stage}`)],
    [t("profile.targetMarket"), startup.targetMarket], [t("profile.customerSegment"), startup.customerSegment],
  ];
  return <dl className="v4-facts">
    {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
    {startup.websiteUrl && <div><dt>{t("profile.websiteUrl")}</dt><dd><a className="v4-link" href={startup.websiteUrl} target="_blank" rel="noopener noreferrer">{startup.websiteUrl.replace(/^https?:\/\//, "")}</a></dd></div>}
    {Object.entries(startup.customFields).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
  </dl>;
}

export const SIZING_FIELD = "Reachable accounts";
export function useSaveSizing() {
  const { workspace, setWorkspace, track, notify } = useWorkspace();
  const { t } = useDisplay();
  return async (accounts: number) => {
    const startup = await track(api<Workspace["startup"]>(`/api/startups/${workspace.startup.id}`, { method: "PATCH",
      body: JSON.stringify({ expectedRevision: workspace.startup.revision, patch: { customFields: { ...workspace.startup.customFields, [SIZING_FIELD]: String(accounts) } } }) }));
    setWorkspace(ws => ({ ...ws, startup })); notify(t("size.saved"));
  };
}
export function savedAccounts(startup: Workspace["startup"]) {
  const n = Number((startup.customFields[SIZING_FIELD] ?? "").replace(/\s/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}
