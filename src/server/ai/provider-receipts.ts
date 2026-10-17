import "server-only";

export type ProviderReceipt = {
  id: string; status: string; reason: string | null;
  inputTokens: number; outputTokens: number; reasoningTokens: number;
  webSearchCalls: number;
  partialOutput?: { characters:number; beginning:string; ending:string };
};

/** The Agents SDK rejects incomplete responses before returning ModelResponse.
 * Retain billing metadata from that actual response, without logging content. */
export function receiptFetch(record: (receipt: ProviderReceipt) => void, network: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const response = await network(input, init);
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (new URL(url).pathname === "/v1/responses" && response.ok && response.headers.get("content-type")?.includes("application/json")) {
      try {
        const body = await response.clone().json();
        const visible=(body.output||[]).flatMap((item:{content?:unknown})=>(Array.isArray(item.content)?item.content:[]).filter(c=>c.type==="output_text"&&typeof c.text==="string").map(c=>c.text)).join("");
        if (body.usage && typeof body.id === "string") record({
          id: body.id, status: body.status, reason: body.incomplete_details?.reason || body.error?.code || null,
          inputTokens: body.usage.input_tokens, outputTokens: body.usage.output_tokens,
          reasoningTokens: body.usage.output_tokens_details?.reasoning_tokens || 0,
          webSearchCalls: (body.output || []).filter((item: { type: string }) => item.type === "web_search_call").length,
          ...(body.status==="incomplete"&&process.env.AI_DIAGNOSTICS==="true"?{partialOutput:{characters:visible.length,beginning:visible.slice(0,1200),ending:visible.slice(-1200)}}:{}),
        });
      } catch { /* Leave the reservation uncertain when no usable receipt arrived. */ }
    }
    return response;
  };
}
