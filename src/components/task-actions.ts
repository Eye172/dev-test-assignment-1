"use client";
import { useCallback, useSyncExternalStore } from "react";
import { api, ClientError } from "@/lib/client-api";
import { calculateRoadmapProgress } from "@/lib/domain/completion";
import type { Task } from "@/lib/domain/types";
import { useWorkspace } from "./workspace";

const pending = new Set<string>();
const empty: ReadonlySet<string> = new Set();
let snapshot: ReadonlySet<string> = empty;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function emit() { snapshot = new Set(pending); listeners.forEach(listener => listener()); }
export function useTaskPending(id: string) { return useSyncExternalStore(subscribe,() => snapshot.has(id),() => false); }

/** Edit mutations wait for acknowledgment. Locked status toggles can respond immediately. */
export function useTaskUpdate() {
  const { workspace, setWorkspace, notify } = useWorkspace();
  const busy = useSyncExternalStore(subscribe,() => snapshot,() => empty);
  const update = useCallback(async (task: Task, patch: Partial<Pick<Task, "status" | "title" | "deliverable" | "week" | "notes" | "archived">>, message?: string) => {
    if (pending.has(task.id)) throw new ClientError("This task is still saving. Please wait a moment.",0,"PENDING");
    pending.add(task.id); emit();
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
    } finally { pending.delete(task.id); emit(); }
  }, [workspace.startup.id, setWorkspace, notify]);
  return { update,isPending: (id: string) => busy.has(id) };
}
