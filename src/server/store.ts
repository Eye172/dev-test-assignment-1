import "server-only";
import { randomUUID } from "node:crypto";
import { calculateCompletion, calculateRoadmapProgress, emptySection } from "@/lib/domain/completion";
import { generateRoadmap } from "@/lib/domain/roadmap";
import { customTaskSchema, profileUpdateSchema, sectionKeys, sectionSchemas, sectionUpdateSchema, startupInputSchema, taskUpdateSchema, type SectionKey, type StartupInput } from "@/lib/domain/schemas";
import type { Startup, StrategySection, Task, Workspace } from "@/lib/domain/types";
import { getDatabase, type Database, type SqlExecutor } from "./database";
import { conflict, notFound } from "./errors";

type Row = Record<string, unknown>;
const iso = (v: unknown) => v instanceof Date ? v.toISOString() : String(v);
function startupFromRow(row: Row): Startup {
  return { id: String(row.id), name: String(row.name), description: String(row.description),
    businessModel: row.business_model as Startup["businessModel"], stage: row.stage as Startup["stage"],
    targetMarket: String(row.target_market), customerSegment: String(row.customer_segment), websiteUrl: String(row.website_url),
    context: String(row.context), customFields: row.custom_fields as Startup["customFields"], preferences: startupInputSchema.shape.preferences.parse(row.preferences),
    revision: Number(row.revision), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
function taskFromRow(row: Row): Task {
  return { id: String(row.id), startupId: String(row.startup_id), ruleKey: row.rule_key ? String(row.rule_key) : null,
    title: String(row.title), deliverable: String(row.deliverable), rationale: String(row.rationale), week: Number(row.week),
    status: row.status as Task["status"], notes: String(row.notes), source: row.source as Task["source"], archived: Boolean(row.archived),
    edited: Boolean(row.edited), revision: Number(row.revision), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
export class Store {
  constructor(public db: Database) {}
  private async findStartup(id: string, tx: SqlExecutor = this.db, lock = false) {
    const [row] = await tx.query("SELECT * FROM startups WHERE id=$1" + (lock ? " FOR UPDATE" : ""), [id]);
    if (!row) throw notFound();
    return startupFromRow(row);
  }
  private async sections(id: string, tx: SqlExecutor = this.db): Promise<StrategySection[]> {
    const rows = await tx.query("SELECT key,data,notes,revision,updated_at FROM strategy_sections WHERE startup_id=$1", [id]);
    return sectionKeys.map(key => {
      const r = rows.find(r => r.key === key);
      return r ? { key, data: sectionSchemas[key].parse(r.data), notes: String(r.notes), revision: Number(r.revision), updatedAt: iso(r.updated_at) } : emptySection(key);
    });
  }
  async workspace(id: string): Promise<Workspace> {
    // A single snapshot keeps dashboard data coherent with concurrent saves.
    return this.db.transaction(async tx => {
      const startup = await this.findStartup(id, tx, true);
      const sections = await this.sections(id, tx);
      const tasks = (await tx.query("SELECT * FROM roadmap_tasks WHERE startup_id=$1 ORDER BY archived,week,created_at,id", [id])).map(taskFromRow);
      return { startup, sections, tasks, completion: calculateCompletion(sections), roadmapProgress: calculateRoadmapProgress(tasks), mode: "demo" };
    });
  }
  async createStartup(input: unknown, id: string = randomUUID(), tx: SqlExecutor = this.db): Promise<Startup> {
    const p = startupInputSchema.parse(input);
    const [row] = await tx.query(`INSERT INTO startups(id,name,description,business_model,stage,target_market,customer_segment,website_url,context,custom_fields,preferences)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb) RETURNING *`,
    [id,p.name,p.description,p.businessModel,p.stage,p.targetMarket,p.customerSegment,p.websiteUrl,p.context,JSON.stringify(p.customFields),JSON.stringify(p.preferences)]);
    return startupFromRow(row);
  }
  async updateStartup(id: string, input: unknown) {
    const { expectedRevision, patch } = profileUpdateSchema.parse(input);
    return this.db.transaction(async tx => {
      const current = await this.findStartup(id, tx, true);
      if (current.revision !== expectedRevision) throw conflict();
      const p = startupInputSchema.parse({ ...currentProfile(current), ...patch,preferences: { ...current.preferences,...patch.preferences } });
      const [row] = await tx.query(`UPDATE startups SET name=$2,description=$3,business_model=$4,stage=$5,target_market=$6,customer_segment=$7,website_url=$8,context=$9,custom_fields=$10::jsonb,preferences=$11::jsonb,revision=revision+1,updated_at=now() WHERE id=$1 RETURNING *`,
        [id,p.name,p.description,p.businessModel,p.stage,p.targetMarket,p.customerSegment,p.websiteUrl,p.context,JSON.stringify(p.customFields),JSON.stringify(p.preferences)]);
      return startupFromRow(row);
    });
  }
  async saveSection(id: string, key: SectionKey, input: unknown): Promise<StrategySection> {
    const { expectedRevision, data, notes } = sectionUpdateSchema.parse(input);
    const parsed = sectionSchemas[key].parse(data);
    return this.db.transaction(async tx => {
      await this.findStartup(id, tx, true);
      const [current] = await tx.query("SELECT revision,notes FROM strategy_sections WHERE startup_id=$1 AND key=$2", [id,key]);
      if (Number(current?.revision ?? 0) !== expectedRevision) throw conflict();
      const [row] = await tx.query(`INSERT INTO strategy_sections(startup_id,key,data,notes) VALUES($1,$2,$3::jsonb,$4)
        ON CONFLICT(startup_id,key) DO UPDATE SET data=EXCLUDED.data,notes=EXCLUDED.notes,revision=strategy_sections.revision+1,updated_at=now() RETURNING *`,
        [id,key,JSON.stringify(parsed),notes ?? current?.notes ?? ""]);
      return { key, data: parsed, notes: String(row.notes), revision: Number(row.revision), updatedAt: iso(row.updated_at) };
    });
  }
  async generate(id: string) {
    await this.db.transaction(async tx => {
      const startup = await this.findStartup(id, tx, true);
      const sections = await this.sections(id, tx);
      const suggestions = generateRoadmap(startup, sections);
      const previous = (await tx.query("SELECT * FROM roadmap_tasks WHERE startup_id=$1 AND source='generated'", [id]))
        .map(row => ({ ...taskFromRow(row),manuallyArchived: Boolean(row.manually_archived) }));
      const keys = suggestions.map(s => s.ruleKey);
      for (const old of previous) {
        const archived = old.manuallyArchived || !keys.includes(old.ruleKey!);
        if (old.archived !== archived) await tx.query("UPDATE roadmap_tasks SET archived=$2,revision=revision+1,updated_at=now() WHERE id=$1", [old.id,archived]);
      }
      for (const suggestion of suggestions) {
        const old = previous.find(t => t.ruleKey === suggestion.ruleKey);
        if (!old) {
          await tx.query(`INSERT INTO roadmap_tasks(id,startup_id,rule_key,title,deliverable,rationale,week,source) VALUES($1,$2,$3,$4,$5,$6,$7,'generated')`,
            [randomUUID(),id,suggestion.ruleKey,suggestion.title,suggestion.deliverable,suggestion.rationale,suggestion.week]);
        } else if (!old.edited && old.status !== "done" && (old.title !== suggestion.title || old.deliverable !== suggestion.deliverable || old.rationale !== suggestion.rationale || old.week !== suggestion.week)) {
          await tx.query("UPDATE roadmap_tasks SET title=$2,deliverable=$3,rationale=$4,week=$5,revision=revision+1,updated_at=now() WHERE id=$1", [old.id,suggestion.title,suggestion.deliverable,suggestion.rationale,suggestion.week]);
        }
      }
    });
    return this.workspace(id);
  }
  async createTask(id: string, input: unknown) {
    const task = customTaskSchema.parse(input);
    return this.db.transaction(async tx => {
      await this.findStartup(id, tx, true);
      const [row] = await tx.query(`INSERT INTO roadmap_tasks(id,startup_id,title,deliverable,rationale,week,notes,source) VALUES($1,$2,$3,$4,$5,$6,$7,'custom') RETURNING *`,
        [randomUUID(),id,task.title,task.deliverable,"Added by the founder for this startup's specific needs.",task.week,task.notes]);
      return taskFromRow(row);
    });
  }
  async updateTask(id: string, taskId: string, input: unknown) {
    const { expectedRevision, patch } = taskUpdateSchema.parse(input);
    return this.db.transaction(async tx => {
      await this.findStartup(id, tx, true);
      const [row] = await tx.query("SELECT * FROM roadmap_tasks WHERE id=$1 AND startup_id=$2 FOR UPDATE", [taskId,id]);
      if (!row) throw notFound();
      const old = taskFromRow(row);
      if (old.revision !== expectedRevision) throw conflict();
      const task = { ...old,...patch };
      const edited = old.edited || ["title","deliverable","week","notes"].some(k => k in patch);
      const manuallyArchived = patch.archived ?? Boolean(row.manually_archived);
      const [updated] = await tx.query(`UPDATE roadmap_tasks SET title=$2,deliverable=$3,week=$4,status=$5,notes=$6,archived=$7,edited=$8,manually_archived=$9,revision=revision+1,updated_at=now() WHERE id=$1 RETURNING *`,
        [taskId,task.title,task.deliverable,task.week,task.status,task.notes,task.archived,edited,manuallyArchived]);
      return taskFromRow(updated);
    });
  }
}
export function currentProfile(startup: Startup): StartupInput {
  const { name,description,businessModel,stage,targetMarket,customerSegment,websiteUrl,context,customFields,preferences } = startup;
  return { name,description,businessModel,stage,targetMarket,customerSegment,websiteUrl,context,customFields,preferences };
}
export async function getStore() { return new Store(await getDatabase()); }
