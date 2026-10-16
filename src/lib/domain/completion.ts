import { sectionKeys, sectionSchemas, type SectionKey, type StrategyData } from "./schemas";
import type { Completion, CompletionSection, StrategySection, Task } from "./types";

export const sectionTitles: Record<SectionKey, string> = {
  icp: "Ideal Customer Profile", value: "Value Proposition", channels: "Acquisition Channels",
  pricing: "Pricing & Revenue", assumptions: "Market Assumptions",
};
export const fieldLabels: Record<string, string> = {
  buyerType: "Buyer type", industry: "Industry or demographics", painPoint: "Primary pain point", buyingTrigger: "Buying trigger",
  problem: "Customer problem", outcome: "Promised outcome", differentiation: "Differentiation", proof: "Proof or assumptions",
  model: "Pricing model", initialPrice: "Initial price assumption", paymentUnit: "Payment unit", rationale: "Pricing rationale",
  firstExperiment: "First acquisition experiment",
};
export function emptySection(key: SectionKey): StrategySection {
  return { key, data: sectionSchemas[key].parse({}), notes: "", revision: 0, updatedAt: null };
}
export function sectionCompletion(key: SectionKey, input: StrategyData): CompletionSection {
  const data = sectionSchemas[key].parse(input);
  const missing: string[] = [];
  if (key === "channels") {
    const channels = sectionSchemas.channels.parse(data);
    if (!channels.channels.length) missing.push("At least one acquisition channel");
    channels.channels.forEach((c, i) => {
      if (!c.name) missing.push(`Channel ${i + 1}: name`);
      if (!c.reason) missing.push(`Channel ${i + 1}: reason`);
    });
    if (!channels.firstExperiment) missing.push(fieldLabels.firstExperiment);
  } else if (key === "assumptions") {
    const assumptions = sectionSchemas.assumptions.parse(data).assumptions;
    for (let i = 0; i < 3; i++) {
      const a = assumptions[i];
      if (!a?.statement) missing.push(`Assumption ${i + 1}: testable statement`);
      if (!a?.validationMethod) missing.push(`Assumption ${i + 1}: validation method`);
    }
  } else {
    for (const [name, value] of Object.entries(data)) if (typeof value === "string" && !value.trim()) missing.push(fieldLabels[name] ?? name);
  }
  return { key, title: sectionTitles[key], complete: missing.length === 0, missing,
    suggestion: missing.length ? `Add ${missing[0].toLowerCase()} to move this section forward.` : "Ready to test in the market. These inputs remain assumptions until supported by evidence." };
}
export function calculateCompletion(sections: StrategySection[]): Completion {
  const results = sectionKeys.map(key => sectionCompletion(key, sections.find(s => s.key === key)?.data ?? emptySection(key).data));
  const completed = results.filter(s => s.complete).length;
  return { percentage: completed * 20, completed, total: 5, sections: results };
}
export function calculateRoadmapProgress(tasks: Task[]) {
  const active = tasks.filter(t => !t.archived);
  const done = active.filter(t => t.status === "done").length;
  return { total: active.length, done, skipped: active.filter(t => t.status === "skipped").length,
    percentage: active.length ? Math.round(done / active.length * 100) : 0 };
}
