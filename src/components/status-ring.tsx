"use client";
import { useState } from "react";
import { motion } from "motion/react";
import type { Task } from "@/lib/domain/types";

/**
 * A checkbox drawn as a ring: done fills it and draws a check; in progress shows a half arc.
 * Toggling is always done ⇄ to do, so the control behaves exactly like a checkbox.
 */
export function StatusRing({ task, onToggle, disabled, label }: { task: Task; onToggle: (next: Task["status"]) => void; disabled?: boolean; label?: string }) {
  const done = task.status === "done";
  const [burst, setBurst] = useState(false);
  // Draw only after the person acts; a saved state renders complete on first paint (also without JavaScript).
  const [acted, setActed] = useState(false);
  const from = <T,>(value: T) => acted ? value : false as const;
  return <button type="button" role="checkbox" aria-checked={done} aria-label={label ?? task.title} disabled={disabled || task.status === "skipped"}
    className={`status-ring ${task.status} ${burst ? "burst" : ""}`} onAnimationEnd={() => setBurst(false)}
    onClick={() => { setActed(true); if (!done) setBurst(true); onToggle(done ? "todo" : "done"); }}>
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" className="ring-base"/>
      {task.status === "in_progress" && <motion.path d="M12 2 A10 10 0 0 1 12 22" className="ring-fill" initial={from({ pathLength: 0 })} animate={{ pathLength: 1 }} transition={{ duration: 0.5, ease: [0.65, 0, 0.35, 1] }}/>}
      {done && <>
        <motion.circle cx="12" cy="12" r="11" className="ring-done" initial={from({ scale: 0.3, opacity: 0 })} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 520, damping: 22 }} style={{ originX: "12px", originY: "12px" }}/>
        <motion.path d="M7.2 12.4l3.2 3.1 6.4-6.6" className="ring-check" initial={from({ pathLength: 0 })} animate={{ pathLength: 1 }} transition={{ duration: 0.32, delay: 0.08, ease: [0.65, 0, 0.35, 1] }}/>
      </>}
      {task.status === "skipped" && <path d="M7 12h10" className="ring-skip"/>}
    </svg>
  </button>;
}
