import { z } from "zod";
import { dashboardPlateIds, plateCatalog } from "./dashboard";

const text = (max = 3000) => z.string().trim().max(max).default("");
export const sectionKeys = ["icp", "value", "channels", "pricing", "assumptions"] as const;
export type SectionKey = (typeof sectionKeys)[number];
export const dashboardLayoutSchema = z.object({
  version: z.literal(1),
  plates: z.array(z.object({ id: z.enum(dashboardPlateIds),size: z.enum(["S","M","L","XL"]),hidden: z.boolean() }).strict()).length(8),
}).strict().superRefine((layout,ctx) => {
  if (new Set(layout.plates.map(p => p.id)).size !== 8) ctx.addIssue({ code: "custom",path: ["plates"],message: "Each known plate must appear exactly once." });
  layout.plates.forEach((plate,index) => {
    if (!plateCatalog[plate.id].allowedSizes.includes(plate.size)) ctx.addIssue({ code: "custom",path: ["plates",index,"size"],message: "Choose an allowed size for this plate." });
    if (plate.id === "readout" && plate.hidden) ctx.addIssue({ code: "custom",path: ["plates",index,"hidden"],message: "Keep the strategy readout visible." });
  });
});
export const preferencesSchema = z.object({
  theme: z.enum(["dark", "light", "system"]).default("dark"),
  density: z.enum(["comfortable", "compact"]).default("comfortable"),
  motion: z.enum(["full", "reduced"]).default("full"),
  accent: z.enum(["green", "lime", "blue"]).default("green"),
  dashboardLayout: dashboardLayoutSchema.nullable().default(null),
}).strict();
export const startupInputSchema = z.object({
  name: z.string().trim().min(1, "Give your startup a name.").max(120),
  description: z.string().trim().min(1, "Describe what you are building.").max(2000),
  businessModel: z.enum(["B2B", "B2C", "B2G"]),
  stage: z.enum(["Idea", "MVP", "Early Traction"]),
  targetMarket: z.string().trim().min(1, "Choose a country or market.").max(200),
  customerSegment: z.string().trim().min(1, "Describe your primary customer.").max(500),
  websiteUrl: z.union([z.literal(""), z.url().refine(v => /^https?:\/\//i.test(v), "Use an http or https website URL.")]).default(""),
  context: text(5000),
  customFields: z.record(z.string().trim().min(1).max(80), z.string().max(1000)).refine(v => Object.keys(v).length <= 12, "Keep up to 12 custom fields.").default({}),
  preferences: preferencesSchema.default({ theme: "dark", density: "comfortable", motion: "full", accent: "green", dashboardLayout: null }),
}).strict();
export const startupPatchSchema = startupInputSchema.partial().extend({ preferences: preferencesSchema.partial().strict().optional() }).strict().refine(v => Object.keys(v).length > 0, "No changes provided.");
export const sectionSchemas = {
  icp: z.object({ buyerType: text(), industry: text(), painPoint: text(), buyingTrigger: text() }).strict(),
  value: z.object({ problem: text(), outcome: text(), differentiation: text(), proof: text() }).strict(),
  channels: z.object({
    channels: z.array(z.object({ name: text(120), reason: text() }).strict()).max(3).default([]),
    firstExperiment: text(),
  }).strict(),
  pricing: z.object({ model: text(), initialPrice: text(500), paymentUnit: text(500), rationale: text() }).strict(),
  assumptions: z.object({ assumptions: z.array(z.object({
    statement: text(), risk: z.enum(["low", "medium", "high"]).default("medium"), validationMethod: text(),
  }).strict()).max(3).default([]) }).strict(),
};
export type SectionDataMap = { [K in SectionKey]: z.infer<(typeof sectionSchemas)[K]> };
export type StrategyData = SectionDataMap[SectionKey];
export type StartupInput = z.infer<typeof startupInputSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export const taskStatuses = ["todo", "in_progress", "done", "skipped"] as const;
export const taskPatchSchema = z.object({
  title: z.string().trim().min(1).max(240).optional(),
  deliverable: z.string().trim().min(1).max(3000).optional(),
  week: z.number().int().min(1).max(4).optional(),
  status: z.enum(taskStatuses).optional(),
  notes: z.string().max(5000).optional(),
  archived: z.boolean().optional(),
}).strict().refine(v => Object.keys(v).length > 0, "No changes provided.");
export const customTaskSchema = z.object({
  title: z.string().trim().min(1).max(240), deliverable: z.string().trim().min(1).max(3000),
  week: z.number().int().min(1).max(4), notes: text(5000),
}).strict();
export const revisionSchema = z.number().int().min(0);
export const uuidSchema = z.uuid();
export const profileUpdateSchema = z.object({ expectedRevision: revisionSchema, patch: startupPatchSchema }).strict();
export const taskUpdateSchema = z.object({ expectedRevision: revisionSchema, patch: taskPatchSchema }).strict();
export const sectionUpdateSchema = z.object({ expectedRevision: revisionSchema, data: z.unknown(), notes: z.string().max(5000).optional() }).strict();
