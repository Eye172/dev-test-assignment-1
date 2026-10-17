import "server-only";
import { randomUUID } from "node:crypto";
import { sectionKeys } from "@/lib/domain/schemas";
import { Store } from "./store";

export const DEMO_ID = "11111111-1111-4111-8111-111111111111";
export { demoProfile, demoStrategy } from "@/lib/domain/demo-content";
import { demoProfile, demoStrategy } from "@/lib/domain/demo-content";
async function populate(store: Store, id: string) {
  await store.db.transaction(async tx => {
    if (store.db.mode === "postgres") await tx.query("SELECT pg_advisory_xact_lock(4815162343)");
    if ((await tx.query("SELECT id FROM startups WHERE id=$1", [id])).length) return;
    await store.createStartup(demoProfile, id, tx);
    for (const key of sectionKeys) await tx.query("INSERT INTO strategy_sections(startup_id,key,data,notes) VALUES($1,$2,$3::jsonb,$4)",
      [id,key,JSON.stringify(demoStrategy[key]),"Synthetic example. Commercial assumptions have not been validated."]);
  });
  const workspace = await store.workspace(id);
  if (!workspace.tasks.length) return store.generate(id);
  return workspace;
}
export async function ensureDemo(store: Store) { return populate(store, DEMO_ID); }
export async function cloneDemo(store: Store) { return populate(store, randomUUID()); }
