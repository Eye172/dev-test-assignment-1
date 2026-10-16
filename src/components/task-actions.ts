"use client";
import { useCallback } from "react";
import { api } from "@/lib/client-api";
import { calculateRoadmapProgress } from "@/lib/domain/completion";
import type { Task } from "@/lib/domain/types";
import { useWorkspace } from "./workspace";

/** Optimistic task updates with rollback. Progress is recomputed with the shared domain rule. */
export function useTaskUpdate() {
  const { workspace, setWorkspace, notify } = useWorkspace();
  return useCallback(async (task: Task, patch: Partial<Pick<Task, "status" | "title" | "deliverable" | "week" | "notes" | "archived">>, message?: string) => {
    const apply = (next: Task) => setWorkspace(ws => {
      const tasks = ws.tasks.map(t => t.id === next.id ? next : t);
      return { ...ws, tasks, roadmapProgress: calculateRoadmapProgress(tasks) };
    });
    apply({ ...task, ...patch });
    try {
      const saved = await api<Task>(`/api/startups/${workspace.startup.id}/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ expectedRevision: task.revision, patch }) });
      apply(saved);
      if (message) notify(message);
      return saved;
    } catch (error) {
      apply(task);
      throw error;
    }
  }, [workspace.startup.id, setWorkspace, notify]);
}
