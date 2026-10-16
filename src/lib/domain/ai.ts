import { z } from "zod";
import { sectionKeys, sectionSchemas, type SectionKey } from "./schemas";

export const aiRoles = ["intake", "researcher", "strategist", "monetizer", "experimenter", "critic"] as const;
export type AiRole = typeof aiRoles[number];
export const agentCatalog: Record<AiRole, { name: string; short: string; description: string }> = {
  intake: { name: "Brief interpreter", short: "Brief", description: "Your goals, constraints and the questions that matter." },
  researcher: { name: "Researcher", short: "Research", description: "Competitors, alternatives and evidence with sources." },
  strategist: { name: "GTM strategist", short: "Strategy", description: "Your first buyer, positioning and route to market." },
  monetizer: { name: "Monetization specialist", short: "Pricing", description: "Offers, payment units and testable pricing." },
  experimenter: { name: "Experiment designer", short: "Experiments", description: "A feasible 30-day plan with measurable outcomes." },
  critic: { name: "Evidence critic", short: "Review", description: "Contradictions, weak evidence and practical corrections." },
};
const text = (max=3000) => z.string().max(max);
const icp = z.object({ buyerType: text(), industry: text(), painPoint: text(), buyingTrigger: text() });
const value = z.object({ problem: text(), outcome: text(), differentiation: text(), proof: text() });
const channels = z.object({ channels: z.array(z.object({ name: text(120), reason: text() })).max(3), firstExperiment: text() });
const pricing = z.object({ model: text(), initialPrice: text(500), paymentUnit: text(500), rationale: text() });
const assumptions = z.object({ assumptions: z.array(z.object({ statement: text(), risk: z.enum(["low", "medium", "high"]), validationMethod: text() })).length(3) });
export const aiStrategySchema = z.object({ icp: icp.nullable(), value: value.nullable(), channels: channels.nullable(), pricing: pricing.nullable(), assumptions: assumptions.nullable() });
export const aiResultSchema = z.object({
  title: text(), summary: text(),
  claims: z.array(z.object({ statement: text(), kind: z.enum(["founder_statement", "workspace_record", "source_reported", "inference", "hypothesis"]), sourceUrls: z.array(text()).max(4), evidenceIds:z.array(z.uuid()).max(4), limitation: text().nullable() })).max(16),
  recommendations: z.array(z.object({ title: text(), detail: text(), section: z.enum(sectionKeys).nullable(), sourceUrls: z.array(text()), tradeoffs: z.array(text()), nextTest: text() })).max(10),
  questions: z.array(z.object({ question: text(), why: text() })).max(3),
  strategy: aiStrategySchema,
  experiments: z.array(z.object({ title: text(240).min(1), week: z.number().int().min(1).max(4), deliverable: text().min(1), rationale: text(), hypothesis: text(), method: text(), metric: text(), threshold: text(), effort: text(), dependencies: z.array(text()).max(10) })).max(10),
  issues: z.array(z.object({ severity: z.enum(["blocking", "material", "minor"]), target: z.enum(aiRoles), topic: text(), reason: text(), correction: text() })).max(12),
});
export type AiResult = z.infer<typeof aiResultSchema>;
export const roleSections: Record<AiRole, readonly SectionKey[]> = { intake: [], researcher: [], strategist: ["icp", "value", "channels", "assumptions"], monetizer: ["pricing"], experimenter: [], critic: [] };
export function outputSchema(role: AiRole) {
  const allowed = roleSections[role];
  return aiResultSchema.extend({ strategy: z.object({
    icp: allowed.includes("icp") ? icp.nullable() : z.null(), value: allowed.includes("value") ? value.nullable() : z.null(),
    channels: allowed.includes("channels") ? channels.nullable() : z.null(), pricing: allowed.includes("pricing") ? pricing.nullable() : z.null(),
    assumptions: allowed.includes("assumptions") ? assumptions.nullable() : z.null(),
  }) });
}
export function validatedProposal(key: SectionKey, result: AiResult) {
  const proposal = result.strategy[key];
  if (!proposal) return null;
  return sectionSchemas[key].parse(proposal);
}
export const runModes = ["full", "research", "strategy", "pricing", "experiments"] as const;
export type RunMode = typeof runModes[number];
export const createAiRunSchema = z.object({ mode: z.enum(runModes), brief: z.string().trim().max(6000), requestId: z.uuid(), parentRunId: z.uuid().nullable().optional() }).strict();
export const evidenceSchema = z.object({
  requestId: z.uuid(),
  taskId: z.uuid().nullable(), kind: z.enum(["interview", "commitment", "payment", "analytics", "other"]),
  observation: z.string().trim().min(10).max(5000), interpretation: z.enum(["supports", "contradicts", "inconclusive"]),
  sampleSize: z.number().int().min(1).max(10000000).nullable(), sourceUrl: z.union([z.literal(""), z.url({ protocol: /^https?$/ })]),
  method: z.string().trim().min(3).max(1000), observedOn: z.iso.date(), limitations: z.string().trim().max(1500),
}).strict();
export type AiEvidence = z.infer<typeof evidenceSchema> & { id: string; createdAt: string };
export type AiSource = { url: string; title: string; accessedAt: string; method: "search" | "open_page" | "citation" };
export type AiStep = { id: string; role: AiRole; round: number; status: "queued" | "running" | "completed" | "failed" | "cancelled"; result: AiResult | null; model: string; promptVersion:string; promptHash:string; inputTokens: number; outputTokens: number; estimatedMicros: number; error: string | null; createdAt: string; completedAt: string | null };
export type AiEvent = { seq: number; kind: string; role: AiRole | null; message: string; createdAt: string };
export type AiApplication = { stepId: string; target: SectionKey | "roadmap"; createdAt: string };
export type AiRun = {
  id: string; startupId: string; mode: RunMode; brief: string; status: "queued" | "running" | "completed" | "needs_attention" | "failed" | "cancelled" | "paused";
  inputHash: string; stale: boolean; createdAt: string; updatedAt: string; completedAt: string | null; error: string | null;
  inputTokens: number; outputTokens: number; estimatedMicros: number; maxMicros: number; sources: AiSource[]; steps: AiStep[]; events: AiEvent[]; applications: AiApplication[];
};
export type AiStudioState = { configured: boolean; authorized: boolean; runs: AiRun[]; nextCursor:string|null; evidence: AiEvidence[]; limits: { runBudgetUsd: number; dailyBudgetUsd: number } };
export const modeRoles: Record<RunMode, AiRole[]> = {
  full: [...aiRoles], research: ["intake", "researcher", "critic"],
  strategy: ["intake", "researcher", "strategist", "experimenter", "critic"],
  pricing: ["intake", "researcher", "monetizer", "critic"],
  experiments: ["intake", "experimenter", "critic"],
};
export function safeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.hostname === "localhost" || url.hostname.endsWith(".local") || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(":")) return null;
    for (const key of [...url.searchParams.keys()]) if (/^utm_|^(trk|ref|cq_net)$/.test(key)) url.searchParams.delete(key);
    url.hash = ""; return url.href;
  } catch { return null; }
}
