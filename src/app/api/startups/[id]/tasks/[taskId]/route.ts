import { getStore } from "@/server/store";
import { handle, idFrom, json, readJson } from "@/server/http";
export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ id: string; taskId: string }> }) {
  return handle(request, async () => { const { id,taskId } = await context.params; return json(await (await getStore()).updateTask(idFrom(id),idFrom(taskId),await readJson(request))); });
}
