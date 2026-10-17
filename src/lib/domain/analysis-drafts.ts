import { z } from "zod";
import { decisionProposalSchema, hypothesisProposalSchema, planSelectionSchema, planLimitsSchema } from "./analysis";

// Recovery validates shape, not readiness to submit. Blank required fields and
// temporarily invalid numeric limits must survive a reload while being edited.
const draftText = z.string().max(50000);
const draftNumber = z.number().finite();
const draftMoney = z.object({ currency: z.string().max(3), amount: draftNumber.nullable() });
export const memoryDraftSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("hypothesis"), proposal: hypothesisProposalSchema.extend({ statement: draftText, rationale: draftText, reviewWhen: draftText }) }),
  z.object({ kind: z.literal("decision"), proposal: decisionProposalSchema.extend({ question: draftText, rationale: draftText, counterargument: draftText, reopenWhen: draftText, options: z.array(decisionProposalSchema.shape.options.element.extend({ label: draftText, benefits: z.array(draftText).max(100), drawbacks: z.array(draftText).max(100) })).min(2).max(4) }) }),
]);
const edit = planSelectionSchema.shape.experimentEdits.unwrap().element;
export const planDraftSchema = planSelectionSchema.extend({
  limits: planLimitsSchema.extend({ weeklyMinutes: draftNumber.nullable(), basis: draftText, budgets: z.array(draftMoney).max(5) }),
  retainedEstimates: z.array(planSelectionSchema.shape.retainedEstimates.element.extend({ effortMinutes: draftNumber.nullable(), costs: z.array(draftMoney).max(5) })).max(500),
  experimentEdits: z.array(edit.extend({ title: draftText.optional(), deliverable: draftText.optional(), method: draftText.optional(), week: draftNumber.optional(), effortMinutes: draftNumber.nullable().optional(), costs: z.array(draftMoney).max(5).optional(), reason: draftText, measurement: edit.shape.measurement.unwrap().extend({ deadlineDay: draftNumber }).optional() })).max(10),
});
