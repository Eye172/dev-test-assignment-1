import { getStore } from "@/server/store";
import { handle, idFrom } from "@/server/http";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(request, async () => {
    const workspace = await (await getStore()).workspace(idFrom((await context.params).id));
    return Response.json({ format: "orbit-workspace", version: 1, exportedAt: new Date().toISOString(), workspace },
      { headers: { "Cache-Control": "no-store", "Content-Disposition": `attachment; filename="orbit-${workspace.startup.id}.json"` } });
  });
}
