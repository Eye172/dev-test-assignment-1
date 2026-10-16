import "server-only";
import { randomUUID } from "node:crypto";
import { startupInputSchema, sectionKeys } from "@/lib/domain/schemas";
import { Store } from "./store";

export const DEMO_ID = "11111111-1111-4111-8111-111111111111";
export const demoProfile = startupInputSchema.parse({
  name: "Fieldnote", description: "A lightweight customer-research workspace that turns founder interviews into traceable product and commercial decisions.",
  businessModel: "B2B", stage: "MVP", targetMarket: "Kazakhstan and Central Asia", customerSegment: "Founders of B2B SaaS startups with 2–10 people",
  websiteUrl: "https://example.com", context: "Synthetic demonstration startup. The first goal is three paid pilot customers in 30 days.",
  customFields: { "30-day goal": "Three paid pilot customers", "Team capacity": "Two founders, 6 hours per week for discovery" },
});
export const demoStrategy = {
  icp: { buyerType: "Founder or product lead at a small B2B SaaS startup", industry: "Early-stage SaaS, teams of 2–10 people", painPoint: "Customer interview evidence is scattered across notes and calls", buyingTrigger: "Preparing a pilot offer or deciding which customer segment to prioritize" },
  value: { problem: "Founders struggle to connect interview evidence to commercial decisions", outcome: "A clear customer insight and next action after every interview", differentiation: "A small evidence trail linking observations, assumptions and founder decisions", proof: "Assumption: founders will pay for traceability. Five informal conversations suggest interest; no payment evidence yet." },
  channels: { channels: [{ name: "Founder outreach", reason: "Direct conversations reach the buyer and reveal objections early" }, { name: "Incubator partnerships", reason: "Cohort leads can introduce teams actively testing their market" }], firstExperiment: "Invite 20 SaaS founders to a 20-minute interview; aim for five qualified conversations" },
  pricing: { model: "Monthly subscription with a small paid pilot", initialPrice: "$29/month; two-week pilot at $15", paymentUnit: "startup workspace", rationale: "Keep the first commitment small while testing whether evidence traceability has commercial value" },
  assumptions: { assumptions: [
    { statement: "At least 3 of 10 interviewed founders will commit to a paid pilot", risk: "high", validationMethod: "Offer a defined two-week pilot after the interview and record commitments" },
    { statement: "Founders can document an interview insight in under five minutes", risk: "medium", validationMethod: "Observe five founders completing the workflow and measure time" },
    { statement: "Incubator cohort leads will introduce at least five relevant founders", risk: "medium", validationMethod: "Request introductions from three cohort leads and record qualified referrals" },
  ] },
} as const;
async function populate(store: Store, id: string) {
  await store.db.transaction(async tx => {
    if (store.db.mode === "postgres") await tx.query("SELECT pg_advisory_xact_lock(4815162343)");
    if ((await tx.query("SELECT id FROM startups WHERE id=$1", [id])).length) return;
    await store.createStartup(demoProfile, id, tx);
    for (const key of sectionKeys) await tx.query("INSERT INTO strategy_sections(startup_id,key,data,notes) VALUES($1,$2,$3::jsonb,$4)",
      [id,key,JSON.stringify(demoStrategy[key]),"Synthetic example. Commercial assumptions have not been validated."]);
  });
  const workspace = await store.workspace(id);
  if (!workspace.tasks.length) return store.generate(id);
  return workspace;
}
export async function ensureDemo(store: Store) { return populate(store, DEMO_ID); }
export async function cloneDemo(store: Store) { return populate(store, randomUUID()); }
