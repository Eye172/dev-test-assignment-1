import { describe, expect, it } from "vitest";
import { calculateCompletion, calculateRoadmapProgress, emptySection } from "@/lib/domain/completion";
import { computeInsights, missingFields, parsePrice } from "@/lib/domain/insights";
import { generateRoadmap } from "@/lib/domain/roadmap";
import { sectionKeys, sectionSchemas } from "@/lib/domain/schemas";
import type { StrategySection, Task, Workspace } from "@/lib/domain/types";
import { en } from "@/ui/i18n/en";
import { dictionaryFor, missingKeys } from "@/ui/i18n/dictionaries";
import { negotiateLocale, resolvedTheme } from "@/ui/prefs";
import { demoProfile, demoStrategy } from "@/server/demo";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
const now = "2026-10-17T08:00:00.000Z";
function workspaceFrom(sections: StrategySection[], tasks: Task[] = []): Workspace {
  return { startup: { ...demoProfile, id: "11111111-1111-4111-8111-111111111111", revision: 1, createdAt: now, updatedAt: now }, sections,
    completion: calculateCompletion(sections), tasks, roadmapProgress: calculateRoadmapProgress(tasks), mode: "demo" };
}
const full = () => sectionKeys.map(key => ({ ...emptySection(key), data: sectionSchemas[key].parse(demoStrategy[key]), revision: 1, updatedAt: now }));
const tasksFor = (sections: StrategySection[], locale: "en" | "ru" | "kk" = "en") => generateRoadmap(demoProfile, sections, locale)
  .map((s, i) => ({ ...s, id: `t${i}`, startupId: "x", status: "todo" as const, notes: "", source: "generated" as const, archived: false, edited: false, revision: 1, createdAt: now, updatedAt: now }));

describe("dictionaries", () => {
  it("Russian and Kazakh translate every English key", () => {
    expect(missingKeys("ru")).toEqual([]);
    expect(missingKeys("kk")).toEqual([]);
  });
  it("keep the same placeholders in every language", () => {
    for (const locale of ["ru", "kk"] as const) {
      const dict = dictionaryFor(locale);
      const mismatched = (Object.keys(en) as (keyof typeof en)[]).filter(k => placeholders(en[k]).join() !== placeholders(dict[k]).join());
      expect(mismatched, locale).toEqual([]);
    }
  });
  it("negotiates language and resolves version themes", () => {
    expect(negotiateLocale("kk-KZ,ru;q=0.8")).toBe("kk");
    expect(negotiateLocale("ru-RU,ru;q=0.9,en;q=0.8")).toBe("ru");
    expect(negotiateLocale("de-DE")).toBe("en");
    expect(resolvedTheme({ version: "ledger", theme: null })).toBe("light");
    expect(resolvedTheme({ version: "observatory", theme: null })).toBe("dark");
    expect(resolvedTheme({ version: "observatory", theme: "system" })).toBeUndefined();
  });
});

describe("insight engine", () => {
  it("scores an empty strategy as a draft and lists every missing input", () => {
    const sections = sectionKeys.map(emptySection);
    const insights = computeInsights(workspaceFrom(sections), new Date(now));
    expect(insights.readiness.band).toBe("draft");
    expect(insights.missing.length).toBe(missingFields(sections).length);
    expect(insights.next.kind).toBe("section");
    expect(insights.assumptions).toEqual([]);
    expect(insights.ladder.reached).toBeNull();
  });
  it("explains every score with rules that sum to it", () => {
    const insights = computeInsights(workspaceFrom(full()), new Date(now));
    for (const axis of insights.readiness.axes) expect(axis.score).toBe(Math.min(100, axis.reasons.reduce((s, r) => s + r.points, 0)));
    expect(insights.readiness.overall).toBeGreaterThan(40);
  });
  it("maps stated and implied assumptions and never marks an untested one as tested", () => {
    const sections = full();
    const insights = computeInsights(workspaceFrom(sections, tasksFor(sections)), new Date(now));
    expect(insights.assumptions.filter(a => a.source === "stated")).toHaveLength(3);
    expect(insights.assumptions.some(a => a.id === "implied-pain")).toBe(true);
    expect(insights.assumptions.every(a => a.evidence < 0.5)).toBe(true);
    expect(insights.assumptions.filter(a => a.quadrant === "test_first").length).toBeGreaterThan(0);
  });
  it("only raises the evidence ladder from completed tests", () => {
    const sections = full();
    const tasks = tasksFor(sections).map(t => t.ruleKey === "icp-interviews" ? { ...t, status: "done" as const } : t);
    const insights = computeInsights(workspaceFrom(sections, tasks), new Date(now));
    expect(insights.ladder.reached).toBe("opinion");
    expect(insights.assumptions.find(a => a.id === "implied-pain")!.evidence).toBeGreaterThan(0.5);
  });
  it("puts chosen channels in the inner ring with an explainable ICE score", () => {
    const insights = computeInsights(workspaceFrom(full()), new Date(now));
    const inner = insights.channels.filter(c => c.ring === "inner");
    expect(inner.map(c => c.label)).toEqual(["Founder outreach", "Incubator partnerships"]);
    for (const c of inner) expect(c.ice).toBeCloseTo((c.impact + c.confidence + c.ease) / 3, 1);
    expect(insights.channels.filter(c => c.ring === "middle")).toHaveLength(4);
    expect(inner.find(c => c.key === "bizdev")?.localNote).toBe("astanahub");
  });
  it("parses prices without inventing missing parts", () => {
    expect(parsePrice("$29/month; two-week pilot at $15", "startup workspace", "Monthly subscription")).toMatchObject({ amount: 29, currency: "USD", period: "month", annual: 348 });
    expect(parsePrice("15 000 ₸ в месяц", "", "")).toMatchObject({ amount: 15000, currency: "KZT", period: "month" });
    expect(parsePrice("to be decided", "", "")).toMatchObject({ amount: null, currency: null, annual: null });
  });
});

describe("localised plan rules", () => {
  it("generate the same rule keys in every language", () => {
    const sections = full();
    const keys = (l: "en" | "ru" | "kk") => generateRoadmap(demoProfile, sections, l).map(t => [t.ruleKey, t.week]);
    expect(keys("ru")).toEqual(keys("en"));
    expect(keys("kk")).toEqual(keys("en"));
    expect(generateRoadmap(demoProfile, sections, "ru")[0].title).toMatch(/интервью/);
    expect(generateRoadmap(demoProfile, sections, "kk")[0].title).toMatch(/сұхбат/);
  });
});

import { extract } from "@/lib/domain/intake";
describe("rule extraction for Russian and Kazakh briefs", () => {
  it("reads a Russian brief without AI", () => {
    const d = extract("Тамақ — сервис для небольших кафе в Алматы: собирает заказы из Instagram и WhatsApp в одну очередь для кухни. Есть MVP и два пилотных кафе. Платят владельцы кафе, думаем о 12 000 тенге в месяц. Сейчас заказы теряются в переписках.");
    expect(d.profile.name).toBe("Тамақ");
    expect(d.profile.businessModel).toBe("B2B");
    expect(d.profile.stage).toBe("MVP");
    expect(d.profile.targetMarket).toBe("Алматы");
    expect(d.profile.customerSegment).toBe("небольших кафе");
    expect(d.hints.price).toMatch(/12 000 тенге/);
    expect(d.hints.channels).toEqual(["Instagram", "WhatsApp"]);
    expect(d.hints.painPoint).toMatch(/теряются/);
  });
  it("reads a Kazakh brief and keeps Kazakh names", () => {
    const d = extract("Сабақ — Шымкенттегі ата-аналар үшін репетитор табуға көмектеседі. Идея кезеңіндеміз. Telegram арқылы таратамыз, айына 5000 теңге.");
    expect(d.profile.name).toBe("Сабақ");
    expect(d.profile.businessModel).toBe("B2C");
    expect(d.profile.stage).toBe("Idea");
    expect(d.profile.targetMarket).toBe("Шымкент");
    expect(d.hints.channels).toEqual(["Қауымдастықтар және Telegram"]);
    expect(d.hints.price).toMatch(/5000 теңге/);
  });
});
