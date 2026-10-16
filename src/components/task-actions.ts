"use client";
import { useCallback, useSyncExternalStore } from "react";
import { api, ClientError } from "@/lib/client-api";
import { calculateRoadmapProgress } from "@/lib/domain/completion";
import type { Task } from "@/lib/domain/types";
import { useWorkspace } from "./workspace";

type TaskPatch = Partial<Pick<Task, "status" | "title" | "deliverable" | "week" | "notes" | "archived">>;

/* One write per task at a time. A second write would carry a stale revision and its rollback could
   overwrite the first acknowledged result, so callers check `isTaskPending` and disable their controls. */
const pending = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export function useTaskPending(id: string) {
  return useSyncExternalStore(subscribe, () => pending.has(id), () => false);
}

/**
 * `optimistic: true` (status, archive) shows the change immediately and rolls back on failure.
 * `optimistic: false` (editor fields) leaves the card untouched until the server acknowledges,
 * so a failed save never unmounts the editor or loses the draft.
 * Every response is applied to the latest workspace state, never to a captured snapshot.
 */
export function useTaskUpdate() {
  const { workspace, setWorkspace, notify } = useWorkspace();
  return useCallback(async (task: Task, patch: TaskPatch, opts: { message?: string; optimistic?: boolean } = {}) => {
    if (pending.has(task.id)) throw new ClientError("This task is still saving. Try again in a moment.", 0, "PENDING");
    const optimistic = opts.optimistic ?? true;
    const apply = (next: (t: Task) => Task) => setWorkspace(ws => {
      const tasks = ws.tasks.map(t => t.id === task.id ? next(t) : t);
      return { ...ws, tasks, roadmapProgress: calculateRoadmapProgress(tasks) };
    });
    pending.add(task.id); emit();
    const before = workspace.tasks.find(t => t.id === task.id) ?? task;
    if (optimistic) apply(t => ({ ...t, ...patch }));
    try {
      const saved = await api<Task>(`/api/startups/${workspace.startup.id}/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ expectedRevision: before.revision, patch }) });
      apply(() => saved);
      if (opts.message) notify(opts.message);
      return saved;
    } catch (error) {
      if (optimistic) apply(t => ({ ...t, ...Object.fromEntries(Object.keys(patch).map(k => [k, before[k as keyof Task]])) }));
      throw error;
    } finally { pending.delete(task.id); emit(); }
  }, [workspace.startup.id, workspace.tasks, setWorkspace, notify]);
}
