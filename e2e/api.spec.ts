import { test, expect, type APIResponse } from "@playwright/test";
import type { Startup, StrategySection, Task, Workspace } from "../src/lib/domain/types";
import { defaultDashboardLayout } from "../src/lib/domain/dashboard";

// Different synthetic data from the public demo exercises the real HTTP boundary.
const profile = {
  name: "Routecraft acceptance example",description: "Delivery planning for independent neighborhood shops.",
  businessModel: "B2B",stage: "Idea",targetMarket: "Central Asia",customerSegment: "Shop owners arranging local deliveries",
  websiteUrl: "https://example.com",context: "Synthetic acceptance data",customFields: { "Weekly capacity": "Four interviews" },
};
const strategy = {
  icp: { buyerType: "Shop owner",industry: "Independent retail",painPoint: "Manual delivery coordination",buyingTrigger: "A growing number of missed deliveries" },
  value: { problem: "Missed deliveries take staff time",outcome: "Fewer coordination calls",differentiation: "A small shared delivery queue",proof: "Untested assumption; no commercial evidence yet" },
  channels: { channels: [{ name: "Merchant association",reason: "Reaches local shop owners" },{ name: "Founder visits",reason: "Observe the current workflow" }],firstExperiment: "Interview four shop owners this week" },
  pricing: { model: "Paid pilot",initialPrice: "$10–20 for a two-week pilot",paymentUnit: "shop",rationale: "Test willingness to pay before a subscription" },
  assumptions: { assumptions: [
    { statement: "Two of four owners will try a paid pilot",risk: "high",validationMethod: "Offer the pilot and record commitments" },
    { statement: "An owner can add a delivery in one minute",risk: "medium",validationMethod: "Observe four task attempts" },
    { statement: "The association will introduce four owners",risk: "low",validationMethod: "Ask its coordinator and record introductions" },
  ] },
} as const;
async function data<T>(response: APIResponse, status = 200): Promise<T> {
  expect(response.status(),await response.text()).toBe(status);
  expect(response.headers()["cache-control"]).toContain("no-store");
  return (await response.json()).data as T;
}

test("real HTTP journey persists independent drafts, preferences and completed work", async ({ request }) => {
  const startup = await data<Startup>(await request.post("/api/startups",{ data: profile }),201);
  const route = `/api/startups/${startup.id}`;
  const draft = await data<StrategySection>(await request.put(`${route}/strategy/icp`,{ data: { expectedRevision: 0,data: { buyerType: "Shop owner" },notes: "Keep this note" } }));
  expect(draft.revision).toBe(1);
  expect((await data<Workspace>(await request.get(route))).completion.percentage).toBe(0);
  for (const [index,key] of (Object.keys(strategy) as (keyof typeof strategy)[]).entries()) {
    await data<StrategySection>(await request.put(`${route}/strategy/${key}`,{ data: { expectedRevision: key === "icp" ? 1 : 0,data: strategy[key] } }));
    expect((await data<Workspace>(await request.get(route))).completion.percentage).toBe((index + 1) * 20);
  }
  const layout = defaultDashboardLayout();
  layout.plates.reverse(); layout.plates.find(p => p.id === "profile")!.hidden = true;
  const customized = await data<Startup>(await request.patch(route,{ data: { expectedRevision: startup.revision,patch: { preferences: { density: "compact",motion: "reduced",dashboardLayout: layout } } } }));
  await data<Startup>(await request.patch(route,{ data: { expectedRevision: customized.revision,patch: { preferences: { theme: "light" } } } }));
  const reopened = await data<Workspace>(await request.get(route));
  expect(reopened.startup.preferences).toMatchObject({ theme: "light",density: "compact",motion: "reduced",dashboardLayout: layout });
  expect(reopened.startup.customFields).toEqual(profile.customFields);
  expect(reopened.sections.find(s => s.key === "icp")!.notes).toBe("Keep this note");
  const plan = await data<Workspace>(await request.post(`${route}/roadmap`));
  expect(plan.tasks).toHaveLength(9);
  const task = plan.tasks[0];
  const done = await data<Task>(await request.patch(`${route}/tasks/${task.id}`,{ data: { expectedRevision: task.revision,patch: { status: "done",title: "Completed research with four owners" } } }));
  const custom = await data<Task>(await request.post(`${route}/tasks`,{ data: { title: "Meet the merchant coordinator",deliverable: "Four introductions",week: 2 } }),201);
  const updated = await data<Workspace>(await request.post(`${route}/roadmap`));
  expect(updated.tasks.find(t => t.id === done.id)).toMatchObject({ status: "done",title: done.title,revision: done.revision });
  expect(updated.tasks.find(t => t.id === custom.id)?.source).toBe("custom");
  expect(updated.roadmapProgress.done).toBe(1);
  const repeat = await data<Workspace>(await request.post(`${route}/roadmap`));
  expect(repeat.tasks.map(t => [t.id,t.revision])).toEqual(updated.tasks.map(t => [t.id,t.revision]));
  const exported = await request.get(`${route}/export`);
  expect(exported.ok()).toBe(true);
  expect(exported.headers()["content-disposition"]).toContain("attachment");
  expect((await exported.json()).workspace.startup.preferences.dashboardLayout).toEqual(layout);
});

test("competing HTTP writes return a conflict and retain the winning data", async ({ request }) => {
  const startup = await data<Startup>(await request.post("/api/startups",{ data: profile }),201);
  const route = `/api/startups/${startup.id}`;
  const responses = await Promise.all(["First draft","Second draft"].map(name => request.patch(route,{ data: { expectedRevision: startup.revision,patch: { name } } })));
  expect(responses.map(r => r.status()).sort()).toEqual([200,409]);
  const winner = await data<Startup>(responses.find(r => r.status() === 200)!);
  expect((await data<Workspace>(await request.get(route))).startup.name).toBe(winner.name);
  const loser = await responses.find(r => r.status() === 409)!.json();
  expect(loser.error.code).toBe("REVISION_CONFLICT");
});

test("HTTP boundary returns safe actionable errors", async ({ request }) => {
  const invalid = await request.post("/api/startups",{ data: { ...profile,websiteUrl: "javascript:alert(1)",name: " " } });
  expect(invalid.status()).toBe(422);
  expect((await invalid.json()).error.fields).toHaveProperty("name");
  expect((await request.post("/api/startups",{ data: profile,headers: { origin: "https://unrelated.example" } })).status()).toBe(403);
  expect((await request.post("/api/startups",{ data: Buffer.from("{"),headers: { "content-type": "application/json" } })).status()).toBe(400);
  expect((await request.post("/api/startups",{ data: "plain",headers: { "content-type": "text/plain" } })).status()).toBe(415);
  expect((await request.post("/api/startups",{ data: { context: "x".repeat(70000) } })).status()).toBe(413);
  const missing = await request.get("/api/startups/not-an-id");
  expect(missing.status()).toBe(404);
  const error = await missing.json();
  expect(error.error.message).toBeTruthy();
  expect(JSON.stringify(error)).not.toMatch(/postgres:\/\/|stack|password/i);
});

test("demo copies use independent database identities and do not reset the shared example", async ({ request }) => {
  const shared = await data<Workspace>(await request.get("/api/demo"));
  const copy = await data<Workspace>(await request.post("/api/demo"),201);
  expect(copy.startup.id).not.toBe(shared.startup.id);
  expect(copy.completion.percentage).toBe(100);
  const changed = await data<Startup>(await request.patch(`/api/startups/${copy.startup.id}`,{ data: { expectedRevision: copy.startup.revision,patch: { name: "Independent acceptance copy" } } }));
  expect(changed.name).toBe("Independent acceptance copy");
  const original = await data<Workspace>(await request.get("/api/demo"));
  expect(original.startup.id).toBe(shared.startup.id);
  expect(original.startup.name).toBe(shared.startup.name);
});
