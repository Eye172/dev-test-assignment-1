import { emptySection, calculateCompletion, calculateRoadmapProgress } from "@/lib/domain/completion";
import { computeInsights } from "@/lib/domain/insights";
import { generateRoadmap } from "@/lib/domain/roadmap";
import { sectionKeys, sectionSchemas } from "@/lib/domain/schemas";
import type { Task, Workspace } from "@/lib/domain/types";
import { DEMO_ID, demoProfile, demoStrategy } from "@/server/demo";
import { Landing } from "@/ui/landing/landing";

// Live models on the welcome page are computed from the synthetic demo startup with the same engine the workspace uses.
function demoWorkspace(): Workspace {
  const now = new Date().toISOString();
  const sections = sectionKeys.map(key => ({ ...emptySection(key), data: sectionSchemas[key].parse(demoStrategy[key]), revision: 1, updatedAt: now }));
  const tasks: Task[] = generateRoadmap(demoProfile, sections).map((s, i) => ({ ...s, id: `demo-${i}`, startupId: DEMO_ID, status: "todo", notes: "", source: "generated", archived: false, edited: false, revision: 1, createdAt: now, updatedAt: now }));
  return { startup: { ...demoProfile, id: DEMO_ID, revision: 1, createdAt: now, updatedAt: now }, sections, completion: calculateCompletion(sections), tasks, roadmapProgress: calculateRoadmapProgress(tasks), mode: "demo" };
}

export default function Welcome() {
  const workspace = demoWorkspace();
  return <Landing data={{ insights: computeInsights(workspace), name: demoProfile.name, segment: demoProfile.customerSegment, model: demoProfile.businessModel, stage: demoProfile.stage, demoId: DEMO_ID }}/>;
}
