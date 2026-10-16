import { getStore } from "@/server/store";
import { handle, idFrom, json } from "@/server/http";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { return handle(request, async () => json(await (await getStore()).generate(idFrom((await context.params).id)))); }
