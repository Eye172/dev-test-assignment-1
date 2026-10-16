import { calculateCompletion, calculateRoadmapProgress } from "./domain/completion";
import type { Workspace } from "./domain/types";

/** A delayed aggregate read must not replace a write already acknowledged locally. */
export function mergeWorkspace(current: Workspace, incoming: Workspace): Workspace {
  if (current.startup.id !== incoming.startup.id) return incoming;
  const startup = current.startup.revision > incoming.startup.revision ? current.startup : incoming.startup;
  const sections = incoming.sections.map(next => {
    const saved = current.sections.find(section => section.key === next.key);
    return saved && saved.revision > next.revision ? saved : next;
  });
  const tasks = incoming.tasks.map(next => {
    const saved = current.tasks.find(task => task.id === next.id);
    return saved && saved.revision > next.revision ? saved : next;
  });
  // There is no hard deletion: absent tasks may have been created after this read.
  tasks.push(...current.tasks.filter(task => !incoming.tasks.some(next => next.id === task.id)));
  return { ...incoming,startup,sections,tasks,completion: calculateCompletion(sections),roadmapProgress: calculateRoadmapProgress(tasks) };
}
