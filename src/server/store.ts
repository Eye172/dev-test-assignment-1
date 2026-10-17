import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { stableJson } from "@/lib/domain/json";
import { calculateCompletion, calculateRoadmapProgress, emptySection } from "@/lib/domain/completion";
import { generateRoadmap } from "@/lib/domain/roadmap";
import { customTaskSchema, profileUpdateSchema, sectionKeys, sectionSchemas, sectionUpdateSchema, startupInputSchema, taskUpdateSchema, type SectionKey, type StartupInput } from "@/lib/domain/schemas";
import type { Startup, StrategySection, Task, Workspace } from "@/lib/domain/types";
import { getDatabase, type Database, type SqlExecutor } from "./database";
import { AppError, conflict, notFound } from "./errors";

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
    edited: Boolean(row.edited), revision: Number(row.revision), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),experiment:row.experiment_contract as Task["experiment"]||null };
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
    return this.db.transaction(tx => this.workspaceIn(id, tx));
  }
  async workspaceIn(id: string, tx: SqlExecutor): Promise<Workspace> {
      const startup = await this.findStartup(id, tx, true);
      const sections = await this.sections(id, tx);
      const tasks = (await tx.query("SELECT t.*,e.contract AS experiment_contract FROM roadmap_tasks t LEFT JOIN ai_experiments e ON e.task_id=t.id WHERE t.startup_id=$1 ORDER BY t.archived,t.week,t.created_at,t.id", [id])).map(taskFromRow);
      const [plan]=await tx.query("SELECT id,created_at,preview FROM ai_plans WHERE startup_id=$1 AND status='active'",[id]);
      return { startup, sections, tasks, completion: calculateCompletion(sections), roadmapProgress: calculateRoadmapProgress(tasks), mode: "demo",activePlan:plan?{id:String(plan.id),createdAt:iso(plan.created_at),conditional:!!(plan.preview as {unknowns?:unknown[]}).unknowns?.length}:null };
  }
  async createStartup(input: unknown, id: string = randomUUID(), tx: SqlExecutor = this.db): Promise<Startup> {
    const p = startupInputSchema.parse(input);
    const [row] = await tx.query(`INSERT INTO startups(id,name,description,business_model,stage,target_market,customer_segment,website_url,context,custom_fields,preferences)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb) RETURNING *`,
    [id,p.name,p.description,p.businessModel,p.stage,p.targetMarket,p.customerSegment,p.websiteUrl,p.context,JSON.stringify(p.customFields),JSON.stringify(p.preferences)]);
    return startupFromRow(row);
  }
  async createStartupOnce(input:unknown, requestId:string) {
    const p=startupInputSchema.parse(input);
    const inputHash=createHash("sha256").update(stableJson(p)).digest("hex");
    return this.db.transaction(async tx=>{
      await tx.query("INSERT INTO startup_creation_requests(request_id,input_hash) VALUES($1,$2) ON CONFLICT DO NOTHING",[requestId,inputHash]);
      const [row]=await tx.query("SELECT * FROM startup_creation_requests WHERE request_id=$1 FOR UPDATE",[requestId]);
      if(row.input_hash!==inputHash)throw new AppError("CREATION_CHANGED","A workspace was already created with the earlier submitted profile. Open it before changing its profile.",409,row.startup_id?{createdStartupId:String(row.startup_id)}:undefined);
      if(row.startup_id)return this.findStartup(String(row.startup_id),tx);
      const startup=await this.createStartup(p,randomUUID(),tx);
      await tx.query("UPDATE startup_creation_requests SET startup_id=$2 WHERE request_id=$1",[requestId,startup.id]);return startup;
    });
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
  async generate(id: string, options:{replaceAiPlan?:boolean;expectedPlanId?:string;locale?:"en"|"ru"|"kk"}={}) {
    await this.db.transaction(async tx => {
      const startup = await this.findStartup(id, tx, true);
      const [plan]=await tx.query("SELECT id FROM ai_plans WHERE startup_id=$1 AND status='active' FOR UPDATE",[id]);
      if(plan){
        if(!options.replaceAiPlan||options.expectedPlanId!==plan.id)throw new AppError("AI_PLAN_ACTIVE","An AI plan is active. Explicitly switch to the rule plan after reviewing preserved work.",409);
        await tx.query("UPDATE ai_plans SET status='superseded' WHERE id=$1",[plan.id]);
        await tx.query("UPDATE roadmap_tasks SET archived=true,superseded_by_plan=$2,revision=revision+1,updated_at=now() WHERE startup_id=$1 AND source='ai' AND status='todo' AND NOT edited AND NOT archived",[id,plan.id]);
        await tx.query("UPDATE roadmap_tasks SET superseded_by_plan=NULL WHERE startup_id=$1 AND source='generated'",[id]);
      }
      const sections = await this.sections(id, tx);
      const suggestions = generateRoadmap(startup, sections, options.locale ?? "en");
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
      const [experiment] = await tx.query("SELECT contract FROM ai_experiments WHERE task_id=$1", [taskId]);
      return taskFromRow({...updated,experiment_contract:experiment?.contract});
    });
  }
}
export function currentProfile(startup: Startup): StartupInput {
  const { name,description,businessModel,stage,targetMarket,customerSegment,websiteUrl,context,customFields,preferences } = startup;
  return { name,description,businessModel,stage,targetMarket,customerSegment,websiteUrl,context,customFields,preferences };
}
export async function getStore() { return new Store(await getDatabase()); }
