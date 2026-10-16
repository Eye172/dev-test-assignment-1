import { getStore } from "@/server/store";
import { handle, idFrom, json, readJson } from "@/server/http";
type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export async function GET(request: Request, context: Context) { return handle(request, async () => json(await (await getStore()).workspace(idFrom((await context.params).id)))); }
export async function PATCH(request: Request, context: Context) { return handle(request, async () => json(await (await getStore()).updateStartup(idFrom((await context.params).id),await readJson(request)))); }
