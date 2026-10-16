"use client";
import { motion } from "motion/react";
import { useHydrated } from "@/components/ui";

// Route continuity: the shell (rail, top bar, dial) stays put while the incoming view focuses into place.
// Server-rendered first paint is never hidden: entrance motion only runs for in-app navigation after hydration.
// MotionConfig in the shell makes it an instant swap under reduced motion.
export default function WorkspaceTemplate({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  return <motion.div initial={hydrated ? { opacity: 0, y: 14, filter: "blur(6px)" } : false} animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none", transform: "none" } }}
    transition={{ duration: 0.34, ease: [0.23, 1, 0.32, 1] }}>{children}</motion.div>;
}
