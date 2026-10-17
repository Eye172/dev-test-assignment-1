import { describe, expect, it } from "vitest";
import { emptySection, calculateCompletion, calculateRoadmapProgress } from "@/lib/domain/completion";
import { demoProfile, demoStrategy } from "@/lib/domain/demo-content";
import { computeInsights } from "@/lib/domain/insights";
import { localizeDemoValue, localizeWorkspace } from "@/lib/domain/localize-workspace";
import { generateRoadmap } from "@/lib/domain/roadmap";
import { sectionKeys, sectionSchemas } from "@/lib/domain/schemas";
import type { Workspace } from "@/lib/domain/types";

function sample(): Workspace {
  const now = "2026-10-17T00:00:00.000Z";
  const sections = sectionKeys.map(key => ({...emptySection(key),data:sectionSchemas[key].parse(demoStrategy[key]),revision:1,updatedAt:now}));
  const startup = {...demoProfile,id:"x",revision:1,createdAt:now,updatedAt:now};
  const tasks = generateRoadmap(startup,sections).map((t,i) => ({...t,id:`t${i}`,startupId:"x",source:"generated" as const,status:"todo" as const,notes:"",edited:false,archived:false,revision:1,createdAt:now,updatedAt:now}));
  return {startup,sections,tasks,completion:calculateCompletion(sections),roadmapProgress:calculateRoadmapProgress(tasks),mode:"demo"};
}
describe("language projections", () => {
  it("localizes existing English demo copies and their generated tasks without writing or changing scores", () => {
    const raw=sample(), before=JSON.stringify(raw), original=computeInsights(raw);
    for (const locale of ["ru","kk"] as const) {
      const view=localizeWorkspace(raw,locale);
      expect(view.startup.description).not.toBe(raw.startup.description);
      expect(view.tasks[0].title).not.toBe(raw.tasks[0].title);
      expect(view.tasks[0].deliverable).not.toContain("Customer interview evidence");
      expect(view.tasks.map(t=>t.id)).toEqual(raw.tasks.map(t=>t.id));
      const insights=localizeDemoValue(raw,original,locale);
      expect(insights.readiness).toEqual(original.readiness);
      expect(insights.price).toEqual(original.price);
      expect(insights.positioning.slots.find(s=>s.key === "category")?.text).not.toBe("workspace");
      expect(insights.assumptions.find(a=>a.id === "implied-price")?.statement).not.toContain("startup workspace");
      expect(insights.assumptions.map(a=>[a.evidence,a.importance])).toEqual(original.assumptions.map(a=>[a.evidence,a.importance]));
    }
    expect(JSON.stringify(raw)).toBe(before);
  });
  it("preserves founder edits, notes, custom tasks and AI work", () => {
    const raw=sample();
    raw.startup.description="workspace";
    raw.tasks[0]={...raw.tasks[0],edited:true,title:"Founder title",notes:"Keep these notes",status:"done"};
    raw.tasks[1]={...raw.tasks[1],source:"ai",title:"AI proposal"};
    raw.tasks[2]={...raw.tasks[2],source:"custom",ruleKey:null,title:"Custom task"};
    raw.tasks[3]={...raw.tasks[3],deliverable:"Changed before edited flag existed"};
    const view=localizeWorkspace(raw,"ru");
    expect(view.startup.description).toBe("workspace");
    expect(view.tasks.slice(0,4)).toEqual(raw.tasks.slice(0,4));
  });
  it("keeps actual founder inputs verbatim while translating matching system instructions", () => {
    const raw=sample();raw.startup.context="A real founder's own text";
    const view=localizeWorkspace(raw,"kk");
    expect(view.startup).toEqual(raw.startup);
    expect(view.sections).toEqual(raw.sections);
    expect(view.tasks[0].title).not.toBe(raw.tasks[0].title);
    expect(view.tasks[0].deliverable).toContain(demoStrategy.icp.painPoint);
  });
  it("can switch a localized saved demo back to English, preserving revisions and statuses", () => {
    const raw=sample(); const ru=localizeWorkspace(raw,"ru");
    const en=localizeWorkspace(ru,"en");
    expect(en.startup).toEqual(raw.startup);
    expect(en.sections).toEqual(raw.sections);
    expect(en.tasks).toEqual(raw.tasks);
    expect(en.completion).toEqual(raw.completion);
  });
});
