"use client";
import { motion } from "motion/react";
import { useHydrated } from "@/components/ui";

// Route continuity: the shell stays still while the incoming view rises briefly into place.
// Server-rendered first paint is never hidden: entrance motion only runs for in-app navigation after hydration.
// Short enough for repeated navigation; MotionConfig makes it an instant swap under reduced motion.
export default function WorkspaceTemplate({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  return <motion.div initial={hydrated ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}>{children}</motion.div>;
}
