import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { calculateCompletion, emptySection } from "@/lib/domain/completion";
import { generateRoadmap } from "@/lib/domain/roadmap";
import { sectionKeys, sectionSchemas, startupInputSchema } from "@/lib/domain/schemas";
import type { Startup, StrategySection } from "@/lib/domain/types";
import { getDatabase, type Database } from "@/server/database";
import { Store } from "@/server/store";
import { demoProfile, demoStrategy, ensureDemo, cloneDemo } from "@/server/demo";
import { POST as createRoute } from "@/app/api/startups/route";
import { GET as workspaceRoute, PATCH as profileRoute } from "@/app/api/startups/[id]/route";
import { PUT as sectionRoute } from "@/app/api/startups/[id]/strategy/[section]/route";
import { POST as roadmapRoute } from "@/app/api/startups/[id]/roadmap/route";
import { PATCH as taskRoute } from "@/app/api/startups/[id]/tasks/[taskId]/route";
import { GET as exportRoute } from "@/app/api/startups/[id]/export/route";

let db: Database; let store: Store;
const fullSections = (): StrategySection[] => sectionKeys.map(key => ({ ...emptySection(key),data: sectionSchemas[key].parse(demoStrategy[key]),revision: 1 }));
const startup = { ...demoProfile,id: "11111111-1111-4111-8111-111111111111",revision: 1,createdAt: "2026-10-16T00:00:00Z",updatedAt: "2026-10-16T00:00:00Z" } satisfies Startup;
const request = (method: string, body?: unknown, origin = "http://localhost") => new Request("http://localhost/api/startups", {
  method,headers: { "content-type": "application/json",origin }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});
beforeAll(async () => { process.env.PGLITE_DATA_DIR = "memory://"; db = await getDatabase(); store = new Store(db); });
afterAll(async () => { await db.close(); });

describe("strategy completeness and flexible validation", () => {
  it("counts sections exactly, excludes whitespace and allows partial drafts", () => {
    expect(calculateCompletion(sectionKeys.map(emptySection)).percentage).toBe(0);
    const sections = fullSections();
    expect(calculateCompletion(sections).percentage).toBe(100);
    sections[0].data = sectionSchemas.icp.parse({ buyerType: "  " });
    expect(calculateCompletion(sections)).toMatchObject({ completed: 4,percentage: 80 });
    expect(sectionSchemas.pricing.parse({ initialPrice: "$5–20, or a free pilot" }).initialPrice).toContain("free pilot");
  });
  it("requires exactly three fully described assumptions to complete", () => {
    const sections = fullSections();
    sections[4].data = { assumptions: [{ statement: "A hypothesis",risk: "high",validationMethod: "Interview" }] };
    const completion = calculateCompletion(sections);
    expect(completion.sections[4].complete).toBe(false);
    expect(completion.sections[4].missing).toHaveLength(4);
  });
  it("accepts custom channels but caps the number and requires reasons for completion", () => {
    expect(sectionSchemas.channels.safeParse({ channels: Array.from({ length: 4 }, () => ({ name: "Custom",reason: "Relevant" })) }).success).toBe(false);
    const sections = fullSections(); sections[2].data = { channels: [{ name: "A very specific founder community",reason: "" }],firstExperiment: "Run a test" };
    expect(calculateCompletion(sections).sections[2].complete).toBe(false);
  });
  it("validates profile enums, required values, URL protocol and custom context", () => {
    for (const patch of [{ name: " " }, { businessModel: "other" }, { stage: "scale" }, { websiteUrl: "javascript:alert(1)" }]) {
      expect(startupInputSchema.safeParse({ ...demoProfile,...patch }).success).toBe(false);
    }
    expect(startupInputSchema.parse({ ...demoProfile,websiteUrl: "",customFields: { "Sales cycle": "6 weeks" } }).customFields).toEqual({ "Sales cycle": "6 weeks" });
  });
});

describe("transparent roadmap rules", () => {
  it("generates 8–10 deterministic tasks from empty and selected inputs", () => {
    for (const count of [0,1,2,3]) {
      const sections = fullSections();
      sections[2].data = { channels: Array.from({ length: count }, (_,i) => ({ name: `Channel ${i}`,reason: "Target buyer access" })),firstExperiment: "Test" };
      const tasks = generateRoadmap(startup,sections);
      expect(tasks.length).toBe(count ? 7 + count : 8);
      expect(new Set(tasks.map(t => t.ruleKey)).size).toBe(tasks.length);
      expect(tasks.every(t => t.week >= 1 && t.week <= 4 && t.rationale && t.deliverable)).toBe(true);
      expect(generateRoadmap(startup,sections)).toEqual(tasks);
    }
  });
  it("adapts titles to missing fields, uses saved context and prioritizes risk", () => {
    const draft = generateRoadmap(startup,sectionKeys.map(emptySection));
    expect(draft[0].title).toMatch(/Refine/);
    expect(draft[0].deliverable).toContain(startup.targetMarket);
    const complete = generateRoadmap(startup,fullSections());
    expect(complete.find(t => t.ruleKey === "assumption-test")!.deliverable).toContain("3 of 10");
    expect(complete.find(t => t.ruleKey === "founder-decision")!.rationale).toContain("cannot validate");
  });
});

describe("database persistence and reconciliation", () => {
  it("saves drafts independently, reopens saved data, and detects stale saves", async () => {
    const p = await store.createStartup(demoProfile);
    const section = await store.saveSection(p.id,"icp",{ expectedRevision: 0,data: { buyerType: "Founder" },notes: "Our first draft" });
    expect(section.revision).toBe(1);
    const reopened = await new Store(db).workspace(p.id);
    expect(reopened.sections[0].data).toMatchObject({ buyerType: "Founder" });
    expect(reopened.sections[0].notes).toBe("Our first draft");
    expect(reopened.completion.percentage).toBe(0);
    await expect(store.saveSection(p.id,"icp",{ expectedRevision: 0,data: {} })).rejects.toMatchObject({ status: 409 });
    expect((await store.workspace(p.id)).sections[0].notes).toBe("Our first draft");
  });
  it("persists profile preferences and rejects competing revisions atomically", async () => {
    const p = await store.createStartup(demoProfile);
    const results = await Promise.allSettled([
      store.updateStartup(p.id,{ expectedRevision: 1,patch: { name: "First update" } }),
      store.updateStartup(p.id,{ expectedRevision: 1,patch: { name: "Competing update" } }),
    ]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
    const latest = (await store.workspace(p.id)).startup;
    await store.updateStartup(p.id,{ expectedRevision: latest.revision,patch: { preferences: { ...latest.preferences,density: "compact",motion: "reduced" } } });
    expect((await store.workspace(p.id)).startup.preferences).toMatchObject({ density: "compact",motion: "reduced" });
  });
  it("reconciles generation without duplicates, loss of status, edits or completed work", async () => {
    const workspace = await cloneDemo(store); const id = workspace.startup.id;
    const first = workspace.tasks[0];
    await store.updateTask(id,first.id,{ expectedRevision: first.revision,patch: { status: "done",title: "My completed customer research",notes: "Five conversations" } });
    const custom = await store.createTask(id,{ title: "Meet our industry mentor",deliverable: "One useful introduction",week: 2 });
    const twice = await store.generate(id);
    expect(twice.tasks.find(t => t.id === first.id)).toMatchObject({ status: "done",title: "My completed customer research",notes: "Five conversations" });
    expect(twice.tasks.find(t => t.id === custom.id)).toBeDefined();
    expect(twice.tasks.filter(t => t.source === "generated")).toHaveLength(9);
    const third = await store.generate(id);
    expect(third.tasks.map(t => [t.id,t.revision])).toEqual(twice.tasks.map(t => [t.id,t.revision]));
    expect(third.roadmapProgress.done).toBe(1);
  });
  it("retains superseded channel tasks in history and preserves completed content", async () => {
    const workspace = await cloneDemo(store); const id = workspace.startup.id;
    const channel = workspace.tasks.find(t => t.ruleKey?.startsWith("channel:"))!;
    await store.updateTask(id,channel.id,{ expectedRevision: channel.revision,patch: { status: "done" } });
    await store.saveSection(id,"channels",{ expectedRevision: 1,data: { channels: [{ name: "New channel",reason: "New evidence" }],firstExperiment: "Another test" } });
    const changed = await store.generate(id);
    expect(changed.tasks.find(t => t.id === channel.id)).toMatchObject({ status: "done",archived: true,title: channel.title });
    expect(changed.tasks.filter(t => !t.archived)).toHaveLength(8);
  });
  it("scopes tasks to their startup and initializes demo without resetting edits", async () => {
    const a = await cloneDemo(store); const b = await store.createStartup(demoProfile);
    await expect(store.updateTask(b.id,a.tasks[0].id,{ expectedRevision: 1,patch: { status: "done" } })).rejects.toMatchObject({ status: 404 });
    const demo = await ensureDemo(store);
    await store.updateStartup(demo.startup.id,{ expectedRevision: demo.startup.revision,patch: { name: "Edited demo" } });
    expect((await ensureDemo(store)).startup.name).toBe("Edited demo");
  });
});

describe("HTTP contract and complete API journey", () => {
  it("creates, edits all five sections, generates, persists task status and exports", async () => {
    const created = await createRoute(request("POST",demoProfile)); expect(created.status).toBe(201);
    const { data: p } = await created.json(); const context = { params: Promise.resolve({ id: p.id }) };
    for (const key of sectionKeys) {
      const response = await sectionRoute(request("PUT",{ expectedRevision: 0,data: demoStrategy[key] }),{ params: Promise.resolve({ id: p.id,section: key }) });
      expect(response.status).toBe(200);
    }
    const response = await workspaceRoute(request("GET"),context);
    const { data: workspace } = await response.json(); expect(workspace.completion.percentage).toBe(100);
    const generated = await roadmapRoute(request("POST"),context); const { data: plan } = await generated.json();
    const t = plan.tasks[0];
    const updated = await taskRoute(request("PATCH",{ expectedRevision: t.revision,patch: { status: "done" } }),{ params: Promise.resolve({ id: p.id,taskId: t.id }) });
    expect(updated.status).toBe(200);
    const reopened = await workspaceRoute(request("GET"),context);
    expect((await reopened.json()).data.roadmapProgress.done).toBe(1);
    const exported = await exportRoute(request("GET"),context);
    expect(exported.headers.get("content-disposition")).toContain("attachment");
    expect((await exported.json()).workspace.startup.id).toBe(p.id);
  });
  it("returns useful validation, missing-record, conflict and same-origin errors", async () => {
    const invalid = await createRoute(request("POST",{ ...demoProfile,name: "" }));
    expect(invalid.status).toBe(422); expect((await invalid.json()).error.fields.name).toBeDefined();
    expect((await createRoute(request("POST",demoProfile,"https://another.example"))).status).toBe(403);
    expect((await workspaceRoute(request("GET"),{ params: Promise.resolve({ id: "not-an-id" }) })).status).toBe(404);
    const p = await store.createStartup(demoProfile);
    const stale = await profileRoute(request("PATCH",{ expectedRevision: 0,patch: { name: "Stale" } }),{ params: Promise.resolve({ id: p.id }) });
    expect(stale.status).toBe(409);
  });
  it("rejects malformed JSON, wrong content types and oversized requests", async () => {
    const malformed = new Request("http://localhost/api/startups",{ method: "POST",headers: { "content-type": "application/json" },body: "{" });
    expect((await createRoute(malformed)).status).toBe(400);
    const wrongType = new Request("http://localhost/api/startups",{ method: "POST",body: "hello" });
    expect((await createRoute(wrongType)).status).toBe(415);
    expect((await createRoute(request("POST",{ context: "x".repeat(70000) }))).status).toBe(413);
  });
});
