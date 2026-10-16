import { getDatabase } from "@/server/database";
import { handle, json } from "@/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return handle(request, async () => { const db = await getDatabase(); await db.query("SELECT 1"); return json({ status: "ready", database: db.mode, mode: "demo" }); });
}
