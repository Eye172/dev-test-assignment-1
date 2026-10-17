import { z } from "zod";
import type { IntakeDraft } from "./intake";

export const attachmentSchema = z.object({
  name: z.string().min(1).max(240), size: z.number().int().min(0).max(5 * 1024 * 1024),
  kind: z.enum(["text", "binary"]), text: z.string().max(20000),
  coverage: z.string().max(300).default(""), error: z.string().max(300).default(""),
}).strict();
export type Attachment = z.infer<typeof attachmentSchema>;
export const founderMaterialSchema=z.object({text:z.string().trim().max(16000),files:z.array(attachmentSchema).max(3)}).strict();
export const intakeInputSchema = founderMaterialSchema.extend({requestId:z.uuid()}).refine(v => v.text.length >= 20 || v.files.some(f => f.text.trim().length >= 20), "Describe your startup or attach readable material.");
export const intakeOutputSchema = z.object({
  profile: z.object({ name: z.string().max(120), description: z.string().max(2000), businessModel: z.enum(["", "B2B", "B2C", "B2G"]), stage: z.enum(["", "Idea", "MVP", "Early Traction"]), targetMarket: z.string().max(200), customerSegment: z.string().max(500), websiteUrl: z.string().max(2000) }).strict(),
  hints: z.object({ painPoint: z.string().max(3000), outcome: z.string().max(3000), price: z.string().max(500), pricingModel: z.string().max(500), channels: z.array(z.string().max(120)).max(3) }).strict(),
  uncertainties: z.array(z.string().max(500)).max(8),
}).strict();
export const intakeDraftSchema=intakeOutputSchema.pick({profile:true,hints:true}).extend({origin:z.record(z.string().max(40),z.enum(["text","file","answer","choice","ai"]))}).strict();
export const intakeRecordSchema=z.object({id:z.uuid(),requestId:z.uuid(),status:z.enum(["queued","running","completed","failed"]),draft:intakeDraftSchema.nullable(),uncertainties:z.array(z.string().max(500)).max(8),error:z.string().nullable(),inputTokens:z.number().nonnegative(),outputTokens:z.number().nonnegative(),estimatedMicros:z.number().nonnegative()}).strict();
export type IntakeRecord = {
  id: string; requestId: string; status: "queued" | "running" | "completed" | "failed";
  draft: IntakeDraft | null; uncertainties: string[]; error: string | null;
  inputTokens: number; outputTokens: number; estimatedMicros: number;
};
