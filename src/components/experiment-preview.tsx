"use client";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { CircleDashed, Hand } from "lucide-react";
import type { TaskSuggestion } from "@/lib/domain/roadmap";
import { OrbitDial, type OrbitModel } from "./orbit";
import { useHydrated, useMedia } from "./ui";

const sample: OrbitModel = {
  sections: [
    { key: "icp", title: "Ideal Customer Profile", state: "complete", missing: 0 },
    { key: "value", title: "Value Proposition", state: "complete", missing: 0 },
    { key: "channels", title: "Acquisition Channels", state: "complete", missing: 0 },
    { key: "pricing", title: "Pricing & Revenue", state: "draft", missing: 2 },
    { key: "assumptions", title: "Market Assumptions", state: "empty", missing: 6 },
  ],
  completion: 60, weeks: [1, 0.43, 0, 0], planDay: 9, plan: 33, hasPlan: true,
};

/**
 * The welcome stage: an Orbit dial with three of the product's own plates around it. On wide screens the
 * plates can be picked up and thrown; they settle where they land. All copy is static and readable without JavaScript.
 */
export function ExperimentPreview({ name, buyer, pain, task }: { name: string; buyer: string; pain: string; task: TaskSuggestion }) {
  const [stageEl, setStageEl] = useState<HTMLElement | null>(null);
  const stage = useMemo(() => ({ current: stageEl }), [stageEl]);
  const hydrated = useHydrated();
  const free = useMedia("(min-width: 960px) and (pointer: fine)");
  const draggable = hydrated && free;
  const plate = (i: number) => ({
    drag: draggable, dragConstraints: stage, dragElastic: 0.18, dragMomentum: true, dragTransition: { power: 0.25, timeConstant: 220 },
    whileDrag: { scale: 1.05, rotate: i % 2 ? -2 : 2, zIndex: 20, cursor: "grabbing" }, whileHover: draggable ? { y: -4 } : undefined,
    // Entrance is CSS (visible without JavaScript); motion only owns the drag transform.
    style: { animationDelay: `${520 + i * 140}ms` },
  });
  return <figure className="stage" aria-labelledby="preview-caption" ref={setStageEl}>
    <figcaption id="preview-caption"><span>{name} example</span><span className="stage-tag">Synthetic · not validated</span></figcaption>
    <div className="stage-orbit" aria-hidden>
      <span className="stage-ring r1"/><span className="stage-ring r2"/>
      <OrbitDial model={sample} size={300} countFrom={0} label="" className="stage-dial"/>
    </div>
    <motion.div className="stage-plate plate-icp reveal-pop" {...plate(0)}>
      <div className="sp-head"><span className="label">Ideal customer</span><span className="preview-untested"><CircleDashed size={13} aria-hidden/>Untested</span></div>
      <blockquote>“{pain}”</blockquote>
      <p className="sp-buyer">{buyer}</p>
    </motion.div>
    <motion.div className="stage-plate plate-rule reveal-pop" {...plate(1)}>
      <span className="label">Rule fired</span>
      <p>{task.rationale}</p>
    </motion.div>
    <motion.div className="stage-plate plate-task reveal-pop" {...plate(2)}>
      <div className="sp-head"><span className="sp-week">Week {task.week}</span><span className="label">Suggested experiment</span></div>
      <h2>{task.title}</h2>
      <div className="sp-evidence"><span className="label">Evidence to collect</span><p>Five interview notes: who has the problem, when it happens, and what they use today.</p></div>
    </motion.div>
    {draggable && <motion.p className="stage-hint" aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}><Hand size={14}/>Plates are movable — try one</motion.p>}
  </figure>;
}
