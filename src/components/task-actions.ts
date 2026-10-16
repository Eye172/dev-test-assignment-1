"use client";
import { useCallback, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { calculateRoadmapProgress } from "@/lib/domain/completion";
import type { Task } from "@/lib/domain/types";
import { useWorkspace } from "./workspace";

/** Edit mutations wait for acknowledgment. Locked status toggles can respond immediately. */
export function useTaskUpdate() {
  const { workspace, setWorkspace, notify } = useWorkspace();
  const pending = useRef(new Set<string>());
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const update = useCallback(async (task: Task, patch: Partial<Pick<Task, "status" | "title" | "deliverable" | "week" | "notes" | "archived">>, message?: string) => {
    if (pending.current.has(task.id)) return;
    pending.current.add(task.id); setBusy(new Set(pending.current));
    const apply = (next: Task) => setWorkspace(ws => {
      const tasks = ws.tasks.map(t => t.id === next.id && t.revision <= next.revision ? next : t);
      return { ...ws, tasks, roadmapProgress: calculateRoadmapProgress(tasks) };
    });
    const optimisticStatus = Object.keys(patch).length === 1 && patch.status !== undefined;
    if (optimisticStatus) apply({ ...task,status: patch.status! });
    try {
      const saved = await api<Task>(`/api/startups/${workspace.startup.id}/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ expectedRevision: task.revision, patch }) });
      apply(saved);
      if (message) notify(message);
      return saved;
    } catch (error) {
      if (optimisticStatus) setWorkspace(ws => {
        const tasks = ws.tasks.map(current => current.id === task.id && current.revision === task.revision && current.status === patch.status ? task : current);
        return { ...ws,tasks,roadmapProgress: calculateRoadmapProgress(tasks) };
      });
      throw error;
    } finally { pending.current.delete(task.id); setBusy(new Set(pending.current)); }
  }, [workspace.startup.id, setWorkspace, notify]);
  return { update,isPending: (id: string) => busy.has(id) };
}
