import "server-only";
import { AppError } from "../errors";

// USD millionths per token. A conservative estimate, not a provider billing receipt.
export const modelPrices: Record<string, { input: number; output: number; longContext: number }> = {
  "gpt-6.1-sol": { input: 2, output: 10, longContext: 1.5 },
  "gpt-6-astra": { input: 10, output: 50, longContext: 1.5 },
};
const dollars = (value: string | undefined, fallback: number, max: number) => {
  const n = Number(value); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
};
export function aiConfig() {
  return {
    configured: !!process.env.OPENAI_API_KEY && !!process.env.AI_ACCESS_CODE,
    model: process.env.OPENAI_MODEL || "gpt-6.1-sol",
    criticModel: process.env.OPENAI_CRITIC_MODEL || process.env.OPENAI_MODEL || "gpt-6.1-sol",
    runBudgetUsd: dollars(process.env.AI_RUN_BUDGET_USD, 7, 30),
    dailyBudgetUsd: dollars(process.env.AI_DAILY_BUDGET_USD, 15, 100),
  };
}
export function requireConfiguration() {
  const config = aiConfig();
  if (!config.configured) throw new AppError("AI_NOT_CONFIGURED", "The owner needs to configure OpenAI and the studio access code on the server.", 503);
  if (!modelPrices[config.model] || !modelPrices[config.criticModel]) throw new AppError("AI_MODEL_CONFIG", "This model has no configured budget rate. Ask the owner to review the server model settings.", 503);
  return config;
}
export function estimatedCost(model: string, input: number, output: number, searches = 0) {
  const rate = modelPrices[model];
  if (!rate) throw new AppError("AI_MODEL_CONFIG", "No price configured for this model.", 503);
  return Math.ceil(input * rate.input * (input > 272000 ? 2 : 1) + output * rate.output * (input > 272000 ? rate.longContext : 1) + searches * 10000);
}
