import { notFound } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace";
import { getStore } from "@/server/store";
import { AppError } from "@/server/errors";
import { uuidSchema } from "@/lib/domain/schemas";
import type { Workspace } from "@/lib/domain/types";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
async function load(id: string): Promise<Workspace> {
  try { return await (await getStore()).workspace(id); }
  catch (error) { if (error instanceof AppError && error.status === 404) notFound(); throw error; }
}
export default async function StartupLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const initial = await load(id);
  return <WorkspaceShell initial={initial}>{children}</WorkspaceShell>;
}
