import { notFound } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace";
import { getStore } from "@/server/store";
import { AppError } from "@/server/errors";
import { uuidSchema } from "@/lib/domain/schemas";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function StartupLayout({ children,params }: { children: React.ReactNode;params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  try { const initial = await (await getStore()).workspace(id); return <WorkspaceShell initial={initial}>{children}</WorkspaceShell>; }
  catch (error) { if (error instanceof AppError && error.status === 404) notFound(); throw error; }
}
