"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, FileEdit, Route, Sparkles, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { sectionKeys, type SectionKey } from "@/lib/domain/schemas";
import type { AiStudioState } from "@/lib/domain/ai";
import { useHasDraft } from "./draft-recovery";
import { useWorkspace, easeOut } from "./workspace";
import { useDisplay } from "@/ui/display";

/** First screen after onboarding: what exists now and what is waiting for the founder's decision. */
export function PreparedPanel() {
  const { workspace } = useWorkspace(); const router = useRouter();
  const { t } = useDisplay();
  const base = `/startups/${workspace.startup.id}`;
  const id = workspace.startup.id;
  const has: Record<SectionKey, boolean> = { icp: useHasDraft(`strategy:${id}:icp`), value: useHasDraft(`strategy:${id}:value`), channels: useHasDraft(`strategy:${id}:channels`), pricing: useHasDraft(`strategy:${id}:pricing`), assumptions: useHasDraft(`strategy:${id}:assumptions`) };
  const drafts = sectionKeys.filter(k => has[k]);
  const [ai, setAi] = useState<AiStudioState | null>(null);
  useEffect(() => { let alive = true; api<AiStudioState>(`/api/startups/${id}/ai`).then(s => { if (alive) setAi(s); }).catch(() => {}); return () => { alive = false; }; }, [id]);
  const tasks = workspace.tasks.filter(task => !task.archived).length;
  const run = ai?.runs[0];
  const ready = !!run && ["completed", "needs_attention"].includes(run.status);
  const aiTitle = !ai ? t("ln.ai") : !ai.configured ? t("pp.aiOff") : !ai.authorized ? t("pp.aiLocked") : run ? (ready ? t("pp.aiReady") : run.status === "failed" ? t("ln.t.stopped") : t("ln.t.working")) : t("pp.aiIdle");
  const aiText = !ai?.configured ? t("pp.aiOffText") : !ai.authorized ? t("pp.aiLockedText") : run ? t("pp.aiReadyText") : t("pp.aiIdleText");
  return <motion.section className="prepared" aria-labelledby="prepared-title" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: easeOut }}>
    <div className="prepared-head"><h2 id="prepared-title">{t("pp.title")}</h2>
      <button type="button" className="icon-button small" aria-label={t("chrome.close")} onClick={() => router.replace(base, { scroll: false })}><X size={16}/></button></div>
    <div className="prepared-grid">
      <article><FileEdit size={18} aria-hidden/>
        <h3>{drafts.length ? t("ln.draftsReady", { n: drafts.length }) : t("pp.strategyEmpty")}</h3>
        <p className="muted">{drafts.length ? t("pp.draftsText", { list: drafts.map(k => t(`section.${k}`)).join(", ") }) : t("pp.strategyEmptyText")}</p>
        <Link className="plate-link" href={`${base}/strategy?section=${drafts[0] ?? "icp"}`}>{drafts.length ? t("pp.reviewDrafts") : t("ov.openStrategy")}<ArrowRight size={14} aria-hidden/></Link></article>
      <article><Route size={18} aria-hidden/>
        <h3>{tasks ? t("pp.tasks", { n: tasks }) : t("rm.title")}</h3>
        <p className="muted">{tasks ? t("pp.tasksText") : t("pp.noTasksText")}</p>
        <Link className="plate-link" href={`${base}/roadmap`}>{t("ov.openRoadmap")}<ArrowRight size={14} aria-hidden/></Link></article>
      <article className={run ? "ai-on" : ""}><Sparkles size={18} aria-hidden/>
        <h3>{aiTitle}</h3>
        <p className="muted">{aiText}</p>
        {ai?.configured && <Link className="plate-link" href={`${base}/ai`}>{ready ? t("ai.review") : t("nav.ai")}<ArrowRight size={14} aria-hidden/></Link>}</article>
    </div>
  </motion.section>;
}
