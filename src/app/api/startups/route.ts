import { getStore } from "@/server/store";
import { handle, json, readJson } from "@/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) { return handle(request, async () => json(await (await getStore()).createStartup(await readJson(request)),201)); }
