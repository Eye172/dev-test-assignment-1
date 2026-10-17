import { z } from "zod";
import type { AiResult } from "./ai";

const text = (max = 1800) => z.string().trim().max(max);
const required = (max = 1800) => text(max).min(1);
const key = z.string().regex(/^[a-z][a-z0-9_-]{0,59}$/);
const refs = z.array(required(100)).max(20);
export const moneyAssumptionSchema = z.object({ currency: z.string().regex(/^[A-Z]{3}$/), amount: z.number().finite().min(0).max(1e9).nullable() });
export const findingSchema = z.object({
  id: z.uuid().nullable(), key, statement: required(),
  kind: z.enum(["founder_statement", "workspace_record", "source_reported", "inference", "hypothesis"]),
  passageIds: refs, evidenceIds: z.array(z.uuid()).max(10), limitation: text(),
});
export const researchSchema = z.object({
  question: required(), scope: required(),
  axes: z.array(z.object({ key, label: required(160), why: required(500) })).min(2).max(8),
  alternatives: z.array(z.object({
    key, name: required(180), category: z.enum(["idea", "direct", "indirect", "manual", "do_nothing"]),
    buyer: required(600), job: required(700), workflow: required(1000), switchingCosts: required(800),
    pricing: z.object({ description: required(800), currency: text(10).nullable(), amount: z.number().min(0).nullable(), unit: text(160).nullable(), period: text(160).nullable(), conditions: required(800), findingRefs: refs }),
    findingRefs: refs, relevance: required(700),
  })).min(1).max(7),
  cells: z.array(z.object({ alternativeKey: key, axisKey: key, value: required(700), basis: z.enum(["reported", "observed", "inferred", "unknown"]), findingRefs: refs, limitation: text(700) })).max(56),
  ideaAdvantages: z.array(z.object({ statement: required(800), findingRefs: refs, test: required(700) })).max(5),
  ideaDisadvantages: z.array(z.object({ statement: required(800), findingRefs: refs, test: required(700) })).max(5),
  coverage: z.object({ searchedFor: z.array(required(400)).max(12), exclusions: z.array(required(500)).max(8), gaps: z.array(required(700)).max(10), stopReason: required(700), freshResearch: z.boolean() }),
  nextChecks: z.array(required(700)).max(5),
});
export const hypothesisProposalSchema = z.object({
  id: z.uuid().nullable(), key, statement: required(), risk: z.enum(["low", "medium", "high"]),
  rationale: required(), reviewWhen: required(), findingRefs: refs, evidenceIds: z.array(z.uuid()).max(10),
});
export const decisionProposalSchema = z.object({
  id: z.uuid().nullable(), key, question: required(800),
  options: z.array(z.object({ key, label: required(400), benefits: z.array(required(600)).max(4), drawbacks: z.array(required(600)).max(4), findingRefs: refs })).min(2).max(4),
  selectedOption: key, rationale: required(), counterargument: required(), reopenWhen: required(),
  hypothesisRefs: refs, findingRefs: refs, evidenceIds: z.array(z.uuid()).max(10),
});
export const experimentContractSchema = z.object({
  key, hypothesisRefs: refs, decisionRefs: refs, dependsOn: z.array(key).max(10),
  effortMinutes: z.number().int().min(0).max(100000).nullable(), costs: z.array(moneyAssumptionSchema).max(5),
  measurement: z.object({ unit: required(200), minimumSample: z.number().int().min(1).nullable(), success: required(1000), failure: required(1000), inconclusive: required(1000), deadlineDay: z.number().int().min(1).max(30) }),
  assumptions: z.array(required(600)).max(10), existingTaskIds: z.array(z.uuid()).max(10),
});
export const planLimitsSchema = z.object({
  weeklyMinutes: z.number().int().min(1).max(10080).nullable(),
  budgets: z.array(moneyAssumptionSchema).max(5), basis: required(), confirmed: z.boolean(),
});
export const analysisSchema = z.object({
  version: z.literal(2), findings: z.array(findingSchema).max(20), research: researchSchema.nullable(),
  hypotheses: z.array(hypothesisProposalSchema).max(5), decisions: z.array(decisionProposalSchema).max(4),
  planLimits: planLimitsSchema.nullable(),
  resolutions: z.array(z.object({ issueId: z.uuid(), outcome: z.enum(["resolved", "deferred"]), reason: required(), findingRefs: refs })).max(24),
  sourceChecks: z.array(z.object({ findingId: z.uuid(), outcome: z.enum(["supports", "does_not_support", "unclear"]), reason: required(900) })).max(60),
});
export type Analysis = z.infer<typeof analysisSchema>;
export type ExperimentContract = z.infer<typeof experimentContractSchema>;
export type PlanLimits = z.infer<typeof planLimitsSchema>;
export type SourcePage = { id: string; runId: string; url: string; title: string; accessedAt: string; contentHash: string; status: "captured" | "unavailable"; limitation: string; passages: { id: string; text: string }[] };
export const memoryStatuses = ["proposed", "active", "accepted", "rejected", "deferred", "superseded"] as const;
export const memoryDataSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("hypothesis"), proposal: hypothesisProposalSchema }),
  z.object({ kind: z.literal("decision"), proposal: decisionProposalSchema }),
]);
export type MemoryData = z.infer<typeof memoryDataSchema>;
export type MemoryItem = { id: string; revision: number; status: typeof memoryStatuses[number]; data: MemoryData; originStepId: string | null; reason: string; createdAt: string; updatedAt: string; observations: string[]; reviewNeeded: boolean };
export const memoryInputSchema = z.object({
  requestId: z.uuid(), id: z.uuid().nullable(), expectedRevision: z.number().int().min(0),
  status: z.enum(memoryStatuses), data: memoryDataSchema, reason: required(1800),
  reviewedEvidenceIds: z.array(z.uuid()).max(500).default([]),
}).strict();
export const analysisPlateIds = ["comparison", "decisions", "hypotheses", "experiments", "review", "activity"] as const;
export const analysisLayoutSchema = z.object({ version: z.literal(1), plates: z.array(z.object({ id: z.enum(analysisPlateIds), hidden: z.boolean(), collapsed: z.boolean(), size: z.enum(["compact", "wide"]) }).strict()).length(6) }).strict().superRefine((v, ctx) => {
  if (new Set(v.plates.map(p => p.id)).size !== 6) ctx.addIssue({ code: "custom", message: "Include each analysis display once." });
});
export type AnalysisLayout = z.infer<typeof analysisLayoutSchema>;
export const defaultAnalysisLayout = (): AnalysisLayout => ({ version: 1, plates: analysisPlateIds.map(id => ({ id, hidden: false, collapsed: false, size: id === "comparison" ? "wide" : "compact" })) });
export type QualityIssue = { id: string; stepId: string; severity: "blocking" | "material" | "minor"; target: string; topic: string; reason: string; correction: string; deterministic: boolean; status: "open" | "resolved" | "deferred"; resolution: string | null };
export const planSelectionSchema = z.object({
  retireTaskIds: z.array(z.uuid()).max(500),
  retainedEstimates: z.array(z.object({ taskId: z.uuid(), effortMinutes: z.number().int().min(0).max(100000).nullable(), costs: z.array(moneyAssumptionSchema).max(5) }).strict()).max(500),
  limits: planLimitsSchema, acknowledgeUnknowns: z.boolean(),
  experimentEdits: z.array(z.object({ key, title: required(240).optional(), deliverable: required(3000).optional(), method: required().optional(), week: z.number().int().min(1).max(4).optional(), effortMinutes: z.number().int().min(0).max(100000).nullable().optional(), costs:z.array(moneyAssumptionSchema).max(5).optional(), measurement:experimentContractSchema.shape.measurement.optional(), reason:required(1000) }).strict()).max(10).default([]),
}).strict();
export type PlanSelection = z.infer<typeof planSelectionSchema>;
export type PlanPreview = { hash: string; selection: PlanSelection; retireCandidates: string[]; protectedTaskIds: string[]; weeks: { week: number; minutes: number; unknownTasks: string[] }[]; spending: { currency: string; amount: number; limit: number | null }[]; blockers: string[]; unknowns: string[]; ready: boolean };
export function reviewedExperiments(result:AiResult,selection:PlanSelection){
  return result.experiments.map(e=>{
    const edit=selection.experimentEdits.find(x=>x.key===e.contract?.key);if(!edit)return e;
    return {...e,title:edit.title??e.title,deliverable:edit.deliverable??e.deliverable,method:edit.method??e.method,threshold:edit.measurement?`${edit.measurement.success} (decision by day ${edit.measurement.deadlineDay})`:e.threshold,week:edit.week??e.week,effort:edit.effortMinutes===undefined?e.effort:edit.effortMinutes===null?"Effort unknown":`${edit.effortMinutes} founder minutes`,contract:e.contract?{...e.contract,effortMinutes:edit.effortMinutes===undefined?e.contract.effortMinutes:edit.effortMinutes,costs:edit.costs??e.contract.costs,measurement:edit.measurement??e.contract.measurement}:null};
  });
}
