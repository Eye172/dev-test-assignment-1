import { Agent, OpenAIProvider, Runner, webSearchTool, setTracingDisabled } from "@openai/agents";
import { z } from "zod";

setTracingDisabled(true);
async function main() {
  if(process.env.AI_ALLOW_PAID_TESTS!=="true")throw new Error("Paid connection test requires AI_ALLOW_PAID_TESTS=true; no generation was started.");
  if (!process.env.OPENAI_API_KEY) throw new Error("missing_key");
  const provider = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY, useResponses: true });
  const runner = new Runner({ modelProvider: provider, tracingDisabled: true, traceIncludeSensitiveData: false });
  const agent = new Agent({ name: "Orbit connection check", model: process.env.OPENAI_MODEL || "gpt-6.1-sol",
    instructions: "Look up the official OpenAI Agents SDK documentation. Return its URL and a one-sentence description. Use web search and only developers.openai.com sources. This is an integration check.",
    tools: [webSearchTool({ filters: { allowedDomains: ["developers.openai.com"] }, searchContextSize: "low" })],
    modelSettings: { reasoning: { effort: "low" }, maxTokens: 2000, store: false, providerData: { service_tier:"default",include: ["web_search_call.action.sources"], max_tool_calls: 2 } },
    outputType: z.object({ url: z.string(), description: z.string() }),
  });
  try {
    const result = await runner.run(agent, "Verify the SDK and hosted research tool.", { maxTurns: 3, signal: AbortSignal.timeout(90000) });
    console.log(JSON.stringify({ ok: true, model: agent.model, output: result.finalOutput,
      responses: result.rawResponses.map(r => ({ inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens,
        outputTypes: r.output.map(o => o.type), providerKeys: Object.keys(r.providerData || {}),
        hostedItems: r.output.filter(o => o.type === "hosted_tool_call") })) }));
  } finally { await provider.close(); }
}
main().catch(error => { console.error(JSON.stringify({ ok: false, status: error?.status || null, code: error?.code || null, category: error?.name || "unknown" })); process.exitCode = 1; });
