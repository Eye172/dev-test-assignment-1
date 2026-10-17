import { getStore } from "@/server/store";
import { handle, idFrom, json, readJson } from "@/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) { return handle(request, async () => {
  const store=await getStore(), input=await readJson(request), requestId=request.headers.get("Idempotency-Key");
  return json(requestId?await store.createStartupOnce(input,idFrom(requestId)):await store.createStartup(input),201);
}); }
