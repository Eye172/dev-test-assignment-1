import type { Preferences, SectionKey, StartupInput, StrategyData } from "./schemas";
export type { Preferences, SectionKey, StartupInput, StrategyData } from "./schemas";
export type Startup = StartupInput & { id: string; revision: number; createdAt: string; updatedAt: string };
export type StrategySection = { key: SectionKey; data: StrategyData; notes: string; revision: number; updatedAt: string | null };
export type CompletionSection = { key: SectionKey; title: string; complete: boolean; missing: string[]; suggestion: string };
export type Completion = { percentage: number; completed: number; total: 5; sections: CompletionSection[] };
export type Task = {
  id: string; startupId: string; ruleKey: string | null; title: string; deliverable: string; rationale: string;
  week: number; status: "todo" | "in_progress" | "done" | "skipped"; notes: string;
  source: "generated" | "custom"; archived: boolean; edited: boolean; revision: number; createdAt: string; updatedAt: string;
};
export type RoadmapProgress = { total: number; done: number; skipped: number; percentage: number };
export type Workspace = { startup: Startup; sections: StrategySection[]; completion: Completion; tasks: Task[]; roadmapProgress: RoadmapProgress; mode: "demo" };
export type ApiErrorShape = { error: { code: string; message: string; fields?: Record<string, string> } };
export type WorkspacePreferences = Preferences;
