import { z } from "zod";
import { sectionKeys, sectionSchemas, type SectionKey } from "./schemas";
import { analysisSchema, experimentContractSchema, type AnalysisLayout, type MemoryItem, type QualityIssue, type SourcePage } from "./analysis";
import { founderMaterialSchema } from "./intake-api";

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
  experiments: z.array(z.object({ title: text(240).min(1), week: z.number().int().min(1).max(4), deliverable: text().min(1), rationale: text(), hypothesis: text(), method: text(), metric: text(), threshold: text(), effort: text(), dependencies: z.array(text()).max(10), contract: experimentContractSchema.nullable().default(null) })).max(10),
  issues: z.array(z.object({ severity: z.enum(["blocking", "material", "minor"]), target: z.enum(aiRoles), topic: text(), reason: text(), correction: text() })).max(12),
  analysis: analysisSchema.nullable().default(null),
});
export type AiResult = z.infer<typeof aiResultSchema>;
export const roleSections: Record<AiRole, readonly SectionKey[]> = { intake: [], researcher: [], strategist: ["icp", "value", "channels", "assumptions"], monetizer: ["pricing"], experimenter: [], critic: [] };
export function outputSchema(role: AiRole) {
  const allowed = roleSections[role];
  return aiResultSchema.extend({ analysis: analysisSchema.nullable(), experiments: z.array(aiResultSchema.shape.experiments.element.extend({ contract: experimentContractSchema.nullable() })).max(10), strategy: z.object({
    icp: allowed.includes("icp") ? icp.nullable() : z.null(), value: allowed.includes("value") ? value.nullable() : z.null(),
    channels: allowed.includes("channels") ? channels.nullable() : z.null(), pricing: allowed.includes("pricing") ? pricing.nullable() : z.null(),
    assumptions: allowed.includes("assumptions") ? assumptions.nullable() : z.null(),
  }) });
}
/** New model calls always use the rich contract; stored v1 artifacts remain readable. */
export function modelOutputSchema(role:AiRole){
  return outputSchema(role).extend({experiments:z.array(aiResultSchema.shape.experiments.element.extend({contract:experimentContractSchema.extend({existingTaskIds:z.array(z.string().min(1).max(100)).max(10)}).nullable()})).max(10),analysis:analysisSchema.extend({
    research:role==="researcher"?analysisSchema.shape.research:z.null(),
    hypotheses:["strategist","monetizer","experimenter"].includes(role)?analysisSchema.shape.hypotheses:analysisSchema.shape.hypotheses.max(0),
    decisions:["strategist","monetizer","experimenter"].includes(role)?analysisSchema.shape.decisions:analysisSchema.shape.decisions.max(0),
    planLimits:role==="experimenter"?analysisSchema.shape.planLimits:z.null(),
    sourceChecks:role==="critic"?analysisSchema.shape.sourceChecks:analysisSchema.shape.sourceChecks.max(0),
    // Specialists can propose a resolution; only the independent critic closes persisted issues.
    resolutions:analysisSchema.shape.resolutions,
  })});
}
export function validatedProposal(key: SectionKey, result: AiResult) {
  const proposal = result.strategy[key];
  if (!proposal) return null;
  return sectionSchemas[key].parse(proposal);
}
export const runModes = ["full", "research", "strategy", "pricing", "experiments"] as const;
export type RunMode = typeof runModes[number];
export const createAiRunSchema = z.object({ mode: z.enum(runModes), brief: z.string().trim().max(6000), requestId: z.uuid(), parentRunId: z.uuid().nullable().optional(), intakeId:z.uuid().nullable().optional(), material:founderMaterialSchema.optional() }).strict();
export const evidenceSchema = z.object({
  requestId: z.uuid(),
  taskId: z.uuid().nullable(), kind: z.enum(["interview", "commitment", "payment", "analytics", "other"]),
  observation: z.string().trim().min(10).max(5000), interpretation: z.enum(["supports", "contradicts", "inconclusive"]),
  sampleSize: z.number().int().min(1).max(10000000).nullable(), sourceUrl: z.union([z.literal(""), z.url({ protocol: /^https?$/ })]),
  method: z.string().trim().min(3).max(1000), observedOn: z.iso.date(), limitations: z.string().trim().max(1500),
  hypothesisIds: z.array(z.uuid()).max(10).default([]),
}).strict();
export type AiEvidence = z.infer<typeof evidenceSchema> & { id: string; createdAt: string; taskSnapshot?: Record<string,unknown> | null };
export type AiSource = { url: string; title: string; accessedAt: string; method: "search" | "open_page" | "citation" };
export type AiStep = { id: string; role: AiRole; round: number; status: "queued" | "running" | "completed" | "failed" | "cancelled"; result: AiResult | null; model: string; promptVersion:string; promptHash:string; inputTokens: number; outputTokens: number; estimatedMicros: number; error: string | null; createdAt: string; completedAt: string | null };
export type AiEvent = { seq: number; kind: string; role: AiRole | null; message: string; createdAt: string };
export type AiApplication = { stepId: string; target: SectionKey | "roadmap"; createdAt: string };
export type AiRun = {
  id: string; startupId: string; mode: RunMode; brief: string; status: "queued" | "running" | "completed" | "needs_attention" | "failed" | "cancelled" | "paused";
  inputHash: string; stale: boolean; createdAt: string; updatedAt: string; completedAt: string | null; error: string | null;
  inputTokens: number; outputTokens: number; estimatedMicros: number; maxMicros: number; sources: AiSource[]; steps: AiStep[]; events: AiEvent[]; applications: AiApplication[];
  pages?: SourcePage[]; qualityIssues?: QualityIssue[];
};
export type AiStudioState = { configured: boolean; authorized: boolean; runs: AiRun[]; nextCursor:string|null; evidence: AiEvidence[]; memory?: MemoryItem[]; layout?: AnalysisLayout; findings?: (NonNullable<AiResult["analysis"]>["findings"][number]&{support?:string})[]; limits: { runBudgetUsd: number; dailyBudgetUsd: number } };
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
