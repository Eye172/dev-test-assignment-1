import { demoProfile, demoStrategy } from "../src/server/demo";
import { sectionKeys } from "../src/lib/domain/schemas";
import type { Startup, StrategySection, Workspace } from "../src/lib/domain/types";

const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
async function call<T>(route: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`${base}${route}`, { method, headers: { "content-type": "application/json" },...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${payload.error?.message ?? "Request failed"}`);
  return payload.data as T;
}
function check(condition: unknown,message: string): asserts condition { if (!condition) throw new Error(message); }
const health = await call<{ status: string;database: string }>("/api/health"); check(health.status === "ready","Database is not ready");
const startup = await call<Startup>("/api/startups","POST",{ ...demoProfile,name: "Orbit acceptance example" });
const route = `/api/startups/${startup.id}`;
for (const key of sectionKeys) {
  const section = await call<StrategySection>(`${route}/strategy/${key}`,"PUT",{ expectedRevision: 0,data: demoStrategy[key] });
  check(section.revision === 1,`Section ${key} was not saved`);
}
const saved = await call<Workspace>(route); check(saved.completion.percentage === 100,"Expected five complete sections");
const plan = await call<Workspace>(`${route}/roadmap`,"POST"); check(plan.tasks.length >= 6 && plan.tasks.length <= 10,"Invalid plan size");
const first = plan.tasks[0];
await call(`${route}/tasks/${first.id}`,"PATCH",{ expectedRevision: first.revision,patch: { status: "done",notes: "Synthetic acceptance check" } });
const regenerated = await call<Workspace>(`${route}/roadmap`,"POST");
check(regenerated.tasks.length === plan.tasks.length,"Regeneration duplicated tasks");
check(regenerated.tasks.find(t => t.id === first.id)?.status === "done","Regeneration lost completed work");
const reopened = await call<Workspace>(route); check(reopened.roadmapProgress.done === 1,"Status did not persist");
const exported = await fetch(`${base}${route}/export`); const backup = await exported.json();
check(exported.ok && backup.workspace.startup.id === startup.id,"Export failed");
console.log(`HTTP smoke passed: ${health.database}; 5 saved sections; ${plan.tasks.length} tasks; done status retained; regeneration idempotent; JSON export.`);
console.log(`Synthetic workspace: ${base}/startups/${startup.id}`);
