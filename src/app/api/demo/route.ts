import { getStore } from "@/server/store";
import { cloneDemo, ensureDemo } from "@/server/demo";
import { handle, json } from "@/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) { return handle(request, async () => json(await ensureDemo(await getStore()))); }
export async function POST(request: Request) { return handle(request, async () => json(await cloneDemo(await getStore()),201)); }
