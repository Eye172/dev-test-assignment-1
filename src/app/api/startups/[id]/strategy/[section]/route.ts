import { sectionKeys, type SectionKey } from "@/lib/domain/schemas";
import { getStore } from "@/server/store";
import { AppError } from "@/server/errors";
import { handle, idFrom, json, readJson } from "@/server/http";
export const runtime = "nodejs";
export async function PUT(request: Request, context: { params: Promise<{ id: string; section: string }> }) {
  return handle(request, async () => {
    const { id,section } = await context.params;
    if (!sectionKeys.includes(section as SectionKey)) throw new AppError("NOT_FOUND","This strategy section does not exist.",404);
    return json(await (await getStore()).saveSection(idFrom(id),section as SectionKey,await readJson(request)));
  });
}
