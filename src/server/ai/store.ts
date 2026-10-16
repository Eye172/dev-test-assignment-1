import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { agentCatalog, createAiRunSchema, evidenceSchema, modeRoles, outputSchema, roleSections, validatedProposal, type AiEvidence, type AiRole, type AiRun, type AiSource, type AiStep, type AiStudioState, type AiResult } from "@/lib/domain/ai";
import { customTaskSchema, type SectionKey } from "@/lib/domain/schemas";
import type { Workspace } from "@/lib/domain/types";
import type { Database, SqlExecutor } from "../database";
import { AppError, notFound } from "../errors";
import { Store, currentProfile } from "../store";
import { aiConfig, requireConfiguration } from "./config";
import { ARTIFACT_VERSION, effectiveInstructions, executionConfig, PROMPT_VERSION, TOOL_VERSION } from "./prompts";
import { AnalysisStore, type StoredFinding } from "./analysis-store";
import { prepareAnalysis } from "./quality";
import type { MemoryData, MemoryItem, SourcePage, PlanSelection } from "@/lib/domain/analysis";
import { buildPlanPreview, applyExperimentPlan } from "./plans";

type Row = Record<string, unknown>;
const iso = (v: unknown) => v instanceof Date ? v.toISOString() : String(v);
// PostgreSQL JSONB reorders object keys. Fingerprints must be stable across a DB round trip.
function canonical(v:unknown):unknown {
  if(Array.isArray(v))return v.map(canonical);
  if(v&&typeof v==="object")return Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,value])=>[k,canonical(value)]));
  return v;
}
export const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(canonical(v))).digest("hex");
type Vector = { profile: string; sections: Record<string, number>; tasks: Record<string, number>; evidence: string[]; memory?:Record<string,string> };
export type AiSnapshot = { workspace: Workspace; evidence: AiEvidence[]; parent: { role: AiRole; result: AiResult; runId?:string; stepId?:string; asOf?:string }[]; parentSources:AiSource[]; memory?:MemoryItem[]; pages?:SourcePage[]; findings?:StoredFinding[] };
export type LeasedRun = { id: string; token: string; snapshot: AiSnapshot; mode: AiRun["mode"]; brief: string };
export function revisionVector(workspace: Workspace, evidence: AiEvidence[], memory:MemoryItem[]=[]): Vector {
  const profile = { ...currentProfile(workspace.startup), preferences: undefined };
  return { profile: hash(profile), sections: Object.fromEntries(workspace.sections.map(s => [s.key,s.revision])),
    tasks: Object.fromEntries([...workspace.tasks].sort((a,b) => a.id.localeCompare(b.id)).map(t => [t.id,t.revision])), evidence: evidence.map(e => e.id).sort(), memory:memory.some(m=>m.status!=="proposed")?Object.fromEntries(memory.filter(m=>m.status!=="proposed").map(m=>[m.id,`${m.revision}:${m.status}`])):undefined };
}
const sameVector = (a: unknown, b: unknown) => hash(a) === hash(b);
function evidenceFromRow(r: Row): AiEvidence {
  return { id: String(r.id),requestId:String(r.request_id||r.id),taskId: r.task_id ? String(r.task_id) : null, kind: r.kind as AiEvidence["kind"], observation: String(r.observation), interpretation: r.interpretation as AiEvidence["interpretation"],sampleSize: r.sample_size ? Number(r.sample_size) : null, sourceUrl: String(r.source_url), method: String(r.method),observedOn: String(r.observed_on),limitations: String(r.limitations),createdAt: iso(r.created_at),hypothesisIds:(r.hypothesis_ids||[]) as string[],taskSnapshot:r.task_snapshot as Record<string,unknown>|null };
}
function stepFromRow(r: Row): AiStep {
  return { id: String(r.id),role: r.role as AiRole,round: Number(r.round),status: r.status as AiStep["status"],result: r.result as AiResult | null,model: String(r.model),promptVersion:String(r.prompt_version),promptHash:String(r.prompt_hash),inputTokens: Number(r.input_tokens),outputTokens: Number(r.output_tokens),estimatedMicros: Number(r.estimated_micros),error: r.error ? String(r.error) : null,createdAt: iso(r.created_at),completedAt: r.completed_at ? iso(r.completed_at) : null };
}
export class AiStore {
  public workspaceStore: Store;
  public analysis:AnalysisStore;
  constructor(public db: Database) { this.workspaceStore = new Store(db); this.analysis=new AnalysisStore(db); }
  async evidence(id: string, tx: SqlExecutor = this.db) {
    return (await tx.query("SELECT * FROM ai_evidence WHERE startup_id=$1 ORDER BY created_at,id", [id])).map(evidenceFromRow);
  }
  async state(id: string, options:{before?:string;all?:boolean}={}): Promise<AiStudioState> {
    return this.db.transaction(async tx => {
      const workspace = await this.workspaceStore.workspaceIn(id,tx);
      const evidence = await this.evidence(id,tx);
      const memory=await this.analysis.memory(id,tx);
      const vector = revisionVector(workspace,evidence,memory);
      const fetched = await tx.query("SELECT * FROM ai_runs WHERE startup_id=$1"+(options.before?" AND (created_at,id) < (SELECT created_at,id FROM ai_runs WHERE id=$2 AND startup_id=$1)":"")+" ORDER BY created_at DESC,id DESC"+(options.all?"":" LIMIT 31"),[id,...(options.before?[options.before]:[])]);
      const rows=options.all?fetched:fetched.slice(0,30);
      const runIds=`{${rows.map(r=>r.id).join(",")}}`;
      // Keep polling inexpensive: bulk-read artifacts instead of three queries per run.
      const allSteps=await tx.query("SELECT * FROM ai_steps WHERE run_id=ANY($1::uuid[]) ORDER BY round,created_at,id",[runIds]);
      const allEvents=await tx.query("SELECT * FROM ai_events WHERE run_id=ANY($1::uuid[]) ORDER BY seq",[runIds]);
      const allApplications=await tx.query("SELECT * FROM ai_applications WHERE run_id=ANY($1::uuid[]) ORDER BY created_at",[runIds]);
      const allPages=await this.analysis.pages(rows.map(r=>String(r.id)),tx);
      const allIssues=await this.analysis.issues(rows.map(r=>String(r.id)),tx);
      const runs: AiRun[] = [];
      for (const r of rows) {
        const steps = allSteps.filter(s=>s.run_id===r.id).map(stepFromRow);
        const events = allEvents.filter(e=>e.run_id===r.id);
        const applications = allApplications.filter(a=>a.run_id===r.id);
        runs.push({ id: String(r.id),startupId: id,mode: r.mode as AiRun["mode"],brief: String(r.brief),status: r.status as AiRun["status"],inputHash: String(r.input_hash),stale: !sameVector(vector,r.expected_vector),createdAt: iso(r.created_at),updatedAt: iso(r.updated_at),completedAt: r.completed_at ? iso(r.completed_at) : null,error: r.error ? String(r.error) : null,inputTokens: Number(r.input_tokens),outputTokens: Number(r.output_tokens),estimatedMicros: Number(r.estimated_micros),maxMicros: Number(r.max_micros),sources: r.sources as AiSource[],steps,pages:allPages.filter(p=>p.runId===r.id),qualityIssues:allIssues.filter(i=>i.runId===r.id),events: events.map(e => ({seq:Number(e.seq),kind:String(e.kind),role:e.role as AiRole|null,message:String(e.message),createdAt:iso(e.created_at)})),applications: applications.map(a => ({stepId:String(a.step_id),target:a.target as SectionKey|"roadmap",createdAt:iso(a.created_at)})) });
      }
      const c = aiConfig(); return { configured:c.configured,authorized:true,runs,nextCursor:!options.all&&fetched.length>30?String(rows.at(-1)!.id):null,evidence,memory,findings:await this.analysis.findings(id,tx),layout:await this.analysis.layout(id,tx),limits:{runBudgetUsd:c.runBudgetUsd,dailyBudgetUsd:c.dailyBudgetUsd} };
    });
  }
  async create(id: string, input: unknown) {
    const config = requireConfiguration(); const p = createAiRunSchema.parse(input);
    return this.db.transaction(async tx => {
      const workspace = await this.workspaceStore.workspaceIn(id,tx);
      const [old] = await tx.query("SELECT * FROM ai_runs WHERE startup_id=$1 AND request_id=$2",[id,p.requestId]);
      if (old) {
        if (old.mode !== p.mode || old.brief !== p.brief || (old.parent_run_id || null) !== (p.parentRunId || null)) throw new AppError("IDEMPOTENCY_CONFLICT","This request identifier was already used for another brief.",409);
        return { id:String(old.id),created:false };
      }
      const [active] = await tx.query("SELECT id FROM ai_runs WHERE startup_id=$1 AND status IN ('queued','running','paused')",[id]);
      if (active) throw new AppError("AI_RUN_ACTIVE","Finish, resume or cancel the current run before starting another.",409);
      const [count] = await tx.query("SELECT count(*) AS count FROM ai_runs WHERE created_at > now() - interval '1 day'");
      if (Number(count.count) >= 100) throw new AppError("AI_RUN_LIMIT","The daily run limit has been reached.",429);
      const evidence = await this.evidence(id,tx);
      let parent: AiSnapshot["parent"] = [];
      let parentSources:AiSource[]=[];
      if (p.parentRunId) {
        const [parentRun] = await tx.query("SELECT id,sources,input_snapshot FROM ai_runs WHERE id=$1 AND startup_id=$2",[p.parentRunId,id]);
        if (!parentRun) throw notFound();
        const rows = await tx.query("SELECT DISTINCT ON(role) id,run_id,role,result,completed_at FROM ai_steps WHERE run_id=$1 AND status='completed' ORDER BY role,round DESC",[p.parentRunId]);
        const inherited=(parentRun.input_snapshot as AiSnapshot).parent||[];
        parent = [...new Map([...inherited,...rows.map(r => ({role:r.role as AiRole,result:r.result as AiResult,runId:String(r.run_id),stepId:String(r.id),asOf:iso(r.completed_at)}))].map(item=>[item.role,item])).values()];
        parentSources=parentRun.sources as AiSource[];
      }
      const memory=await this.analysis.memory(id,tx);
      const findingIds=new Set([...memory.flatMap(m=>m.data.proposal.findingRefs),...parent.flatMap(p=>p.result.analysis?.findings.map(f=>f.id!)||[])]);
      const findings=(await this.analysis.findings(id,tx)).filter(f=>findingIds.has(f.id!));
      const pageIds=new Set(findings.flatMap(f=>f.passageIds.map(p=>p.split(":")[0])));
      const pageRows=await tx.query("SELECT DISTINCT run_id FROM ai_source_pages WHERE startup_id=$1 AND id=ANY($2::uuid[])",[id,`{${[...pageIds].join(",")}}`]);
      const pages=(await Promise.all(pageRows.map(r=>this.analysis.pages(String(r.run_id),tx)))).flat().filter(p=>pageIds.has(p.id));
      parentSources=[...new Map([...parentSources,...pages.map(p=>({url:p.url,title:p.title,accessedAt:p.accessedAt,method:"open_page" as const}))].map(s=>[s.url,s])).values()];
      const snapshot: AiSnapshot = { workspace,evidence,parent,parentSources,memory,findings,pages };
      if (Buffer.byteLength(JSON.stringify(snapshot)) > 500000) throw new AppError("AI_CONTEXT_LIMIT","This workspace is too large for one run. Export its history and use a focused working copy.",422);
      const runId = randomUUID(); const vector = revisionVector(workspace,evidence,memory);
      await tx.query(`INSERT INTO ai_runs(id,startup_id,request_id,parent_run_id,mode,brief,input_snapshot,input_hash,expected_vector,max_micros,sources) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10,$11::jsonb)`,[runId,id,p.requestId,p.parentRunId||null,p.mode,p.brief,JSON.stringify(snapshot),hash(snapshot),JSON.stringify(vector),Math.round(config.runBudgetUsd*1000000),JSON.stringify(parentSources)]);
      for (const role of modeRoles[p.mode]) await this.insertStep(tx,runId,role,0);
      await this.event(tx,runId,"queued",null,"Brief saved. The specialist team is ready to begin.");
      return { id:runId,created:true };
    });
  }
  private async insertStep(tx: SqlExecutor, runId: string, role: AiRole, round: number) {
    const c=aiConfig();
    const instructions=effectiveInstructions(role,round),settings=executionConfig(role);
    await tx.query("INSERT INTO ai_steps(id,run_id,role,round,model,prompt_version,prompt_hash,instructions,execution_config) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) ON CONFLICT(run_id,role,round) DO NOTHING",[randomUUID(),runId,role,round,role==="critic"?c.criticModel:c.model,PROMPT_VERSION,hash({instructions,settings}),instructions,JSON.stringify(settings)]);
  }
  async execution(step:AiStep) {
    const [r]=await this.db.query("SELECT instructions,execution_config,prompt_hash FROM ai_steps WHERE id=$1",[step.id]);
    const settings=r?.execution_config as ReturnType<typeof executionConfig>|null;
    if(!r?.instructions||!settings||settings.artifactVersion!==ARTIFACT_VERSION||settings.toolVersion!==TOOL_VERSION||hash({instructions:r.instructions,settings})!==r.prompt_hash)throw new AppError("AI_VERSION_CHANGED","This step's prompt, tool or artifact version cannot be replayed safely by this deployment. Start a follow-up from completed artifacts.",409);
    return {instructions:String(r.instructions),settings};
  }
  async event(tx: SqlExecutor, runId: string, kind: string, role: AiRole|null, message: string) {
    await tx.query("INSERT INTO ai_events(run_id,kind,role,message) VALUES($1,$2,$3,$4)",[runId,kind,role,message]);
  }
  async lease(id: string): Promise<LeasedRun|null> {
    return this.db.transaction(async tx => {
      const [r] = await tx.query("SELECT * FROM ai_runs WHERE id=$1 FOR UPDATE",[id]);
      if (!r || !["queued","running","paused"].includes(String(r.status)) || r.cancel_requested || (r.lease_until && new Date(String(r.lease_until)).getTime()>Date.now())) return null;
      // An interrupted paid call has an uncertain outcome. Do not automatically rebill it.
      const [uncertain] = await tx.query("SELECT id FROM ai_calls WHERE run_id=$1 AND charged_micros IS NULL",[id]);
      const [uncheckpointed] = await tx.query("SELECT s.id FROM ai_steps s WHERE s.run_id=$1 AND s.status='running' AND s.result IS NULL AND EXISTS(SELECT 1 FROM ai_calls c WHERE c.step_id=s.id)",[id]);
      if (uncertain || uncheckpointed) {
        await tx.query("UPDATE ai_runs SET status='failed',error=$2,lease_token=NULL,lease_until=NULL,updated_at=now(),completed_at=now() WHERE id=$1",[id,"A provider call was interrupted before its artifact could be checkpointed. Confirmed usage remains charged; uncertain reservations are retained. Review the provider account before starting a follow-up run."]);
        await tx.query("UPDATE ai_steps SET status='failed',error='Provider outcome could not be safely checkpointed. No automatic replay.',completed_at=now() WHERE run_id=$1 AND status='running'",[id]);
        await this.event(tx,id,"uncertain",null,"An interrupted provider call needs owner review; it was not retried automatically."); return null;
      }
      const token = randomUUID();
      await tx.query("UPDATE ai_runs SET status='running',lease_token=$2,lease_until=$3,updated_at=now(),error=NULL WHERE id=$1",[id,token,new Date(Date.now()+280000)]);
      await tx.query("UPDATE ai_steps SET status='queued' WHERE run_id=$1 AND status='running'",[id]);
      return {id,token,snapshot:r.input_snapshot as AiSnapshot,mode:r.mode as AiRun["mode"],brief:String(r.brief)};
    });
  }
  async fence(tx: SqlExecutor, run: LeasedRun) {
    const [r] = await tx.query("SELECT * FROM ai_runs WHERE id=$1 FOR UPDATE",[run.id]);
    if (!r || r.lease_token !== run.token || r.status !== "running" || r.cancel_requested || new Date(String(r.lease_until)).getTime()<Date.now()) throw new AppError("AI_CANCELLED","This run stopped or its worker lease expired.",409);
    return r;
  }
  async steps(runId: string) { return (await this.db.query("SELECT * FROM ai_steps WHERE run_id=$1 ORDER BY round,created_at,id",[runId])).map(stepFromRow); }
  async startStep(run: LeasedRun, step: AiStep) {
    await this.db.transaction(async tx => {
      await this.fence(tx,run);
      await tx.query("UPDATE ai_steps SET status='running',error=NULL WHERE id=$1",[step.id]);
      await this.event(tx,run.id,"working",step.role,`${agentCatalog[step.role].name}${step.round?" · revision":""} is working.`);
      await tx.query("INSERT INTO ai_messages(id,run_id,step_id,sender,recipients,kind,content) VALUES($1,$2,$3,'orchestrator',$4::jsonb,'task',$5::jsonb)",[randomUUID(),run.id,step.id,JSON.stringify([step.role]),JSON.stringify({snapshotHash:hash(run.snapshot),brief:run.brief,promptVersion:step.promptVersion,round:step.round})]);
    });
  }
  async completeStep(run: LeasedRun, step: AiStep, result: AiResult, sources: AiSource[]) {
    outputSchema(step.role).parse(result);
    for(const key of roleSections[step.role])validatedProposal(key,result);
    if(step.role==="experimenter")for(const e of result.experiments)customTaskSchema.parse({title:e.title,deliverable:e.deliverable,week:e.week,notes:""});
    await this.db.transaction(async tx => {
      const r=await this.fence(tx,run);
      const [execution]=await tx.query("SELECT input_payload FROM ai_steps WHERE id=$1",[step.id]);
      const supplied=execution?.input_payload as {findings?:StoredFinding[]}|null;
      const priorFindings=supplied?.findings||(await this.analysis.findings(String(r.startup_id),tx)).filter(f=>f.runId===run.id&&f.active||(run.snapshot.findings||[]).some(x=>x.id===f.id));
      result=prepareAnalysis(result,step,{memory:await this.analysis.memory(String(r.startup_id),tx),findings:priorFindings,pages:[...(run.snapshot.pages||[]),...await this.analysis.pages(run.id,tx)],evidence:run.snapshot.evidence,taskIds:run.snapshot.workspace.tasks.map(t=>t.id)});
      if(result.analysis){
        await tx.query("UPDATE ai_findings SET active=false WHERE run_id=$1 AND step_id IN (SELECT id FROM ai_steps WHERE run_id=$1 AND role=$2)",[run.id,step.role]);
        for(const f of result.analysis.findings)await tx.query("INSERT INTO ai_findings(id,startup_id,run_id,step_id,data) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(id) DO NOTHING",[f.id,r.startup_id,run.id,step.id,JSON.stringify(f)]);
        for(const c of result.analysis.sourceChecks)await tx.query("UPDATE ai_findings SET support=$3 WHERE id=$1 AND startup_id=$2",[c.findingId,r.startup_id,c.outcome]);
        await this.analysis.proposedMemory(String(r.startup_id),step,result,tx);
      }
      await this.analysis.registerIssues(run.id,step,result,tx);
      await tx.query("UPDATE ai_steps SET status='completed',result=$2::jsonb,completed_at=now() WHERE id=$1",[step.id,JSON.stringify(result)]);
      const merged = new Map((r.sources as AiSource[]).map(s=>[s.url,s])); for(const s of sources) merged.set(s.url,s);
      // Never truncate citations after validation: inherited and new provenance must survive together.
      await tx.query("UPDATE ai_runs SET sources=$2::jsonb,updated_at=now() WHERE id=$1",[run.id,JSON.stringify([...merged.values()])]);
      await tx.query("INSERT INTO ai_messages(id,run_id,step_id,sender,recipients,kind,content) VALUES($1,$2,$3,$4,$5::jsonb,'artifact',$6::jsonb)",[randomUUID(),run.id,step.id,step.role,JSON.stringify(step.role==="critic"?["orchestrator"]:["critic","orchestrator"]),JSON.stringify(result)]);
      await this.event(tx,run.id,"artifact",step.role,`${agentCatalog[step.role].name} saved a proposal${result.issues.length?` with ${result.issues.length} review note(s)`:""}.`);
    });
  }
  async recordTool(run:LeasedRun,step:AiStep,name:string,input:unknown,result:unknown) {
    await this.db.transaction(async tx=>{await this.fence(tx,run);await tx.query("INSERT INTO ai_messages(id,run_id,step_id,sender,recipients,kind,content) VALUES($1,$2,$3,$4,$5::jsonb,'tool_result',$6::jsonb)",[randomUUID(),run.id,step.id,name,JSON.stringify([step.role,"orchestrator"]),JSON.stringify({tool:name,input,result})]);});
  }
  async capture(run:LeasedRun,step:AiStep,page:SourcePage){
    return this.db.transaction(async tx=>{const r=await this.fence(tx,run);await this.analysis.savePage(String(r.startup_id),step,page,tx);return (await this.analysis.pages(run.id,tx)).find(p=>p.url===page.url)!;});
  }
  async saveInput(run:LeasedRun,step:AiStep,payload:unknown){await this.db.transaction(async tx=>{await this.fence(tx,run);await tx.query("UPDATE ai_steps SET input_payload=$2::jsonb WHERE id=$1",[step.id,JSON.stringify(payload)]);});}
  async scheduleRepair(run: LeasedRun, roles: AiRole[]) {
    await this.db.transaction(async tx => { await this.fence(tx,run); for(const role of roles) await this.insertStep(tx,run.id,role,1); await this.insertStep(tx,run.id,"critic",1); await this.event(tx,run.id,"revision",null,"The critic requested one focused correction round. Original proposals stay in history."); });
  }
  async finish(run: LeasedRun, status: AiRun["status"], message: string|null=null, stepId?: string) {
    await this.db.transaction(async tx => {
      const [r]=await tx.query("SELECT lease_token,status,cancel_requested FROM ai_runs WHERE id=$1 FOR UPDATE",[run.id]);
      if(!r || r.lease_token!==run.token || r.cancel_requested || r.status==="cancelled") return;
      if(stepId) await tx.query("UPDATE ai_steps SET status='failed',error=$2,completed_at=now() WHERE id=$1 AND status='running'",[stepId,message]);
      await tx.query("UPDATE ai_runs SET status=$2,error=$3,lease_token=NULL,lease_until=NULL,updated_at=now(),completed_at=CASE WHEN $2='paused' THEN NULL ELSE now() END WHERE id=$1",[run.id,status,message]);
      await this.event(tx,run.id,status,null,message || (status==="completed"?"Review complete. Proposals are ready for your decision.":"Review complete. Unresolved concerns are shown beside the proposals."));
    });
  }
  async cancel(startupId:string,id:string) {
    await this.db.transaction(async tx=>{
      const [r]=await tx.query("SELECT status FROM ai_runs WHERE id=$1 AND startup_id=$2 FOR UPDATE",[id,startupId]); if(!r)throw notFound();
      if(!["queued","running","paused"].includes(String(r.status)))return;
      await tx.query("UPDATE ai_runs SET status='cancelled',cancel_requested=true,lease_token=NULL,lease_until=NULL,updated_at=now(),completed_at=now() WHERE id=$1",[id]);
      await tx.query("UPDATE ai_steps SET status='cancelled',error='Cancelled before completion',completed_at=now() WHERE run_id=$1 AND status IN ('queued','running')",[id]);
      await this.event(tx,id,"cancelled",null,"Run cancelled. Completed artifacts remain; an in-flight provider call may still incur cost.");
    });
  }
  async reserve(run:LeasedRun,step:AiStep,model:string,reservation:number) {
    const id=randomUUID(),day=new Date().toISOString().slice(0,10),c=aiConfig();
    await this.db.transaction(async tx=>{
      await tx.query("INSERT INTO ai_budget_days(day) VALUES($1) ON CONFLICT DO NOTHING",[day]);
      const [budget]=await tx.query("SELECT * FROM ai_budget_days WHERE day=$1 FOR UPDATE",[day]);
      // Same lock order as settlement: shared day before the run row.
      const r=await this.fence(tx,run);
      const [calls]=await tx.query("SELECT count(*) AS count FROM ai_calls WHERE run_id=$1",[run.id]);
      if(Number(calls.count)>=18 || Number(r.input_tokens)+Number(r.output_tokens)>=300000 || Number(r.estimated_micros)+Number(r.reserved_micros)+reservation>Number(r.max_micros) || Number(budget.charged_micros)+Number(budget.reserved_micros)+reservation>c.dailyBudgetUsd*1000000) throw new AppError("AI_BUDGET","The next call exceeds the configured token, run or shared daily budget. Completed work is preserved; start a smaller follow-up or ask the owner to review limits.",429);
      await tx.query("UPDATE ai_budget_days SET reserved_micros=reserved_micros+$2 WHERE day=$1",[day,reservation]);
      await tx.query("UPDATE ai_runs SET reserved_micros=reserved_micros+$2 WHERE id=$1",[run.id,reservation]);
      await tx.query("INSERT INTO ai_calls(id,run_id,step_id,budget_day,model,reserved_micros) VALUES($1,$2,$3,$4,$5,$6)",[id,run.id,step.id,day,model,reservation]);
    });return id;
  }
  async settle(callId:string,input:number,output:number,cost:number,responseId:string|null,metadata:unknown) {
    // Settle even after cancellation: already incurred usage must stay accounted for.
    await this.db.transaction(async tx=>{
      const [call]=await tx.query("SELECT * FROM ai_calls WHERE id=$1 FOR UPDATE",[callId]);if(!call||call.charged_micros!==null)return;
      await tx.query("UPDATE ai_calls SET charged_micros=$2,response_id=$3 WHERE id=$1",[callId,cost,responseId]);
      await tx.query("UPDATE ai_budget_days SET reserved_micros=reserved_micros-$2,charged_micros=charged_micros+$3 WHERE day=$1",[call.budget_day,call.reserved_micros,cost]);
      for(const table of ["ai_runs","ai_steps"]) await tx.query(`UPDATE ${table} SET input_tokens=input_tokens+$2,output_tokens=output_tokens+$3,estimated_micros=estimated_micros+$4${table==="ai_runs"?",reserved_micros=reserved_micros-$5,updated_at=now()":""} WHERE id=$1`,[table==="ai_runs"?call.run_id:call.step_id,input,output,cost,...(table==="ai_runs"?[call.reserved_micros]:[])]);
      await tx.query("INSERT INTO ai_messages(id,run_id,step_id,sender,recipients,kind,content) VALUES($1,$2,$3,'tools','[\"orchestrator\"]','tool_result',$4::jsonb)",[randomUUID(),call.run_id,call.step_id,JSON.stringify(metadata)]);
    });
  }
  async addEvidence(id:string,input:unknown) {
    const p=evidenceSchema.parse(input);
    return this.db.transaction(async tx=>{
      await this.workspaceStore.workspaceIn(id,tx);
      const [existing]=await tx.query("SELECT * FROM ai_evidence WHERE startup_id=$1 AND request_id=$2",[id,p.requestId]);
      if(existing){const old=evidenceFromRow(existing);if(hash(Object.fromEntries(Object.keys(p).map(key=>[key,old[key as keyof AiEvidence]])))!==hash(p))throw new AppError("IDEMPOTENCY_CONFLICT","This observation request was already used for different content.",409);return old;}
      let task:Row|null=null;
      if(p.taskId) { const [found]=await tx.query("SELECT * FROM roadmap_tasks WHERE id=$1 AND startup_id=$2",[p.taskId,id]);if(!found)throw notFound();task=found; }
      for(const hypothesisId of p.hypothesisIds)if(!(await tx.query("SELECT id FROM ai_memory WHERE id=$1 AND startup_id=$2 AND kind='hypothesis'",[hypothesisId,id])).length)throw new AppError("AI_REFERENCE","The related hypothesis is absent from this workspace.",422);
      const [experiment]=p.taskId?await tx.query("SELECT contract FROM ai_experiments WHERE task_id=$1",[p.taskId]):[];
      const taskSnapshot=task?{...task,experimentContract:experiment?.contract||null}:null;
      const [r]=await tx.query(`INSERT INTO ai_evidence(id,startup_id,task_id,kind,observation,interpretation,sample_size,source_url,method,observed_on,limitations,task_snapshot,request_id,hypothesis_ids,experiment_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14::jsonb,$15::jsonb) RETURNING *`,[randomUUID(),id,p.taskId,p.kind,p.observation,p.interpretation,p.sampleSize,p.sourceUrl,p.method,p.observedOn,p.limitations,JSON.stringify(taskSnapshot),p.requestId,JSON.stringify(p.hypothesisIds),JSON.stringify(experiment?.contract||null)]);
      return evidenceFromRow(r);
    });
  }
  async previewPlan(startupId:string,runId:string,stepId:string,selection?:PlanSelection){
    return this.db.transaction(async tx=>{
      const workspace=await this.workspaceStore.workspaceIn(startupId,tx);
      const [s]=await tx.query("SELECT s.result FROM ai_steps s JOIN ai_runs r ON r.id=s.run_id WHERE s.id=$1 AND s.run_id=$2 AND r.startup_id=$3 AND s.role='experimenter' AND s.status='completed'",[stepId,runId,startupId]);
      if(!s)throw notFound();return buildPlanPreview(workspace,s.result as AiResult,selection);
    });
  }
  async remember(startupId:string,runId:string,stepId:string,kind:"hypothesis"|"decision",key:string){
    return this.db.transaction(async tx=>{
      const workspace=await this.workspaceStore.workspaceIn(startupId,tx);
      const [r]=await tx.query("SELECT * FROM ai_runs WHERE id=$1 AND startup_id=$2 FOR UPDATE",[runId,startupId]);if(!r)throw notFound();
      const [s]=await tx.query("SELECT * FROM ai_steps WHERE id=$1 AND run_id=$2 AND status='completed'",[stepId,runId]);if(!s)throw notFound();
      const result=s.result as AiResult;
      const proposal=(kind==="hypothesis"?result.analysis?.hypotheses:result.analysis?.decisions)?.find(p=>p.key===key);
      if(!proposal?.id)throw new AppError("AI_MEMORY_PROPOSAL","This artifact has no such memory proposal.",422);
      const [item]=await tx.query("SELECT * FROM ai_memory WHERE id=$1 AND startup_id=$2 FOR UPDATE",[proposal.id,startupId]);if(!item)throw notFound();
      const desired=kind==="hypothesis"?"active":"accepted";
      const data={kind,proposal} as MemoryData;
      if(item.status===desired&&hash(item.data)===hash(data))return (await this.analysis.memory(startupId,tx)).find(m=>m.id===proposal.id)!;
      const baseline=(r.input_snapshot as AiSnapshot).memory?.find(m=>m.id===proposal.id);
      if(Number(item.revision)!==(baseline?.revision||1))throw new AppError("AI_MEMORY_CHANGED","This memory record was edited after the proposal's baseline. Keep your edit or start a follow-up; the old proposal cannot overwrite it.",409);
      if(!["completed","needs_attention"].includes(String(r.status)))throw new AppError("AI_NOT_READY","Wait for the complete review before accepting proposals.",409);
      const currentMemory=await this.analysis.memory(startupId,tx),evidence=await this.evidence(startupId,tx);
      if(!sameVector(revisionVector(workspace,evidence,currentMemory),r.expected_vector))throw new AppError("AI_STALE","The business context changed. Start a follow-up before accepting this proposal.",409);
      const [latest]=await tx.query("SELECT id FROM ai_steps WHERE run_id=$1 AND role=$2 AND status='completed' ORDER BY round DESC LIMIT 1",[runId,s.role]);if(latest?.id!==stepId)throw new AppError("AI_SUPERSEDED","A newer specialist revision exists.",409);
      const dependencies=kind==="decision"&&s.role==="monetizer"?["intake","researcher","strategist","monetizer","critic"]:["intake","researcher","strategist","critic"];
      const [critic]=await tx.query("SELECT result FROM ai_steps WHERE run_id=$1 AND role='critic' AND status='completed' ORDER BY round DESC LIMIT 1",[runId]);
      const issues=[...((critic?.result as AiResult|undefined)?.issues||[]),...(await this.analysis.issues(runId,tx)).filter(i=>i.status==="open")];
      if(issues.some(i=>i.severity==="blocking"&&dependencies.includes(i.target)))throw new AppError("AI_REVIEW_BLOCKED","Resolve blocking issues before accepting this dependent decision.",409);
      await this.analysis.checkLinks(startupId,data,tx);
      const targets=kind==="decision"?(data as Extract<MemoryData,{kind:"decision"}>).proposal.hypothesisRefs:[proposal.id];
      const reviewed=evidence.filter(e=>e.hypothesisIds.some(h=>targets.includes(h))).map(e=>e.id);
      await tx.query("UPDATE ai_memory SET data=$2::jsonb,status=$3,reason=$4,revision=revision+1,reviewed_evidence=$5::jsonb,updated_at=now() WHERE id=$1",[proposal.id,JSON.stringify(data),desired,"Founder accepted the reviewed specialist proposal.",JSON.stringify(reviewed)]);
      await this.analysis.history(tx,startupId,proposal.id);
      await tx.query("UPDATE ai_runs SET expected_vector=$2::jsonb,updated_at=now() WHERE id=$1",[runId,JSON.stringify(revisionVector(workspace,evidence,await this.analysis.memory(startupId,tx)))]);
      await this.event(tx,runId,"remembered",s.role,`${kind} accepted by the founder; prior revisions remain in memory history.`);
      return (await this.analysis.memory(startupId,tx)).find(m=>m.id===proposal.id)!;
    });
  }
  async apply(startupId:string,runId:string,stepId:string,target:SectionKey|"roadmap",plan?:{selection:PlanSelection;previewHash:string}) {
    await this.db.transaction(async tx=>{
      const workspace=await this.workspaceStore.workspaceIn(startupId,tx);
      const [r]=await tx.query("SELECT * FROM ai_runs WHERE id=$1 AND startup_id=$2 FOR UPDATE",[runId,startupId]);if(!r)throw notFound();
      const [applied]=await tx.query("SELECT id FROM ai_applications WHERE run_id=$1 AND step_id=$2 AND target=$3",[runId,stepId,target]);if(applied)return;
      if(!["completed","needs_attention"].includes(String(r.status)))throw new AppError("AI_NOT_READY","Wait for the full review before applying proposals.",409);
      const evidence=await this.evidence(startupId,tx);
      if(!sameVector(revisionVector(workspace,evidence,await this.analysis.memory(startupId,tx)),r.expected_vector))throw new AppError("AI_STALE","Saved strategy, tasks, profile, memory or evidence changed after this brief. Start a follow-up with the latest context before applying.",409);
      const [s]=await tx.query("SELECT * FROM ai_steps WHERE id=$1 AND run_id=$2 AND status='completed'",[stepId,runId]);if(!s)throw notFound();
      const [latest]=await tx.query("SELECT id FROM ai_steps WHERE run_id=$1 AND role=$2 AND status='completed' ORDER BY round DESC LIMIT 1",[runId,s.role]);if(latest?.id!==stepId)throw new AppError("AI_SUPERSEDED","A newer revision of this specialist's proposal is available.",409);
      const [critic]=await tx.query("SELECT result FROM ai_steps WHERE run_id=$1 AND role='critic' AND status='completed' ORDER BY round DESC LIMIT 1",[runId]);
      const issues=[...((critic?.result as AiResult|undefined)?.issues || []),...(await this.analysis.issues(runId,tx)).filter(i=>i.status==="open")];
      const dependencies=s.role==="experimenter"?["intake","researcher","strategist","monetizer","experimenter","critic"]:s.role==="monetizer"?["intake","researcher","strategist","monetizer","critic"]:["intake","researcher",s.role,"critic"];
      if(issues.some(i=>i.severity==="blocking"&&dependencies.includes(i.target)))throw new AppError("AI_REVIEW_BLOCKED","The critic found an unresolved blocking issue in this proposal or its supporting specialist work. Resolve it in a follow-up first.",409);
      const result=s.result as AiResult;let previous:unknown,proposed:unknown,revision:number|null=null;
      if(target==="roadmap") {
        if(s.role!=="experimenter"||result.experiments.length<6||result.experiments.length>10)throw new AppError("AI_PLAN_INVALID","A reviewed plan needs six to ten experiments.",422);
        const tasks=result.experiments.map(e=>({...customTaskSchema.parse({title:e.title,deliverable:e.deliverable,week:e.week,notes:""}),...e}));
        previous=workspace.tasks.filter(t=>t.source==="ai");proposed=tasks;
        if(result.analysis?.version===2&&!plan)throw new AppError("AI_PLAN_REVIEW","Preview and review the plan, preserved work and resource limits before applying.",422);
        const preview=buildPlanPreview(workspace,result,plan?.selection);
        if(plan&&preview.hash!==plan.previewHash)throw new AppError("AI_PLAN_CHANGED","The plan selection or workspace changed. Review a fresh preview.",409);
        if(result.analysis&&(!preview.ready))throw new AppError("AI_PLAN_CAPACITY",preview.blockers[0]||"Acknowledge unknown estimates before applying this conditional plan.",422);
        await applyExperimentPlan(tx,startupId,runId,stepId,workspace,result,preview);
      } else {
        const proposal=validatedProposal(target,result);if(!proposal)throw new AppError("AI_PROPOSAL_MISSING","This specialist did not propose that section.",422);
        if(!((s.role==="strategist"&&target!=="pricing")||(s.role==="monetizer"&&target==="pricing")))throw new AppError("AI_SCOPE","This role cannot apply that section.",422);
        const old=workspace.sections.find(x=>x.key===target)!;previous=old.data;proposed=proposal;revision=old.revision+1;
        await tx.query("INSERT INTO strategy_sections(startup_id,key,data,notes) VALUES($1,$2,$3::jsonb,$4) ON CONFLICT(startup_id,key) DO UPDATE SET data=EXCLUDED.data,revision=strategy_sections.revision+1,updated_at=now()",[startupId,target,JSON.stringify(proposal),old.notes]);
      }
      await tx.query("INSERT INTO ai_applications(id,run_id,step_id,startup_id,target,section_revision,previous_data,proposed_data) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)",[randomUUID(),runId,stepId,startupId,target,revision,JSON.stringify(previous),JSON.stringify(proposed)]);
      const current=await this.workspaceStore.workspaceIn(startupId,tx);
      await tx.query("UPDATE ai_runs SET expected_vector=$2::jsonb,updated_at=now() WHERE id=$1",[runId,JSON.stringify(revisionVector(current,evidence,await this.analysis.memory(startupId,tx)))]);
      await this.event(tx,runId,"applied",s.role,`${target==="roadmap"?"Experiment plan":target} applied by the founder. Previous values retained in application history.`);
    });
    return this.workspaceStore.workspace(startupId);
  }
  async export(id:string) {
    const state=await this.state(id,{all:true});
    const rows=await this.db.query("SELECT m.* FROM ai_messages m JOIN ai_runs r ON r.id=m.run_id WHERE r.startup_id=$1 ORDER BY m.created_at,m.id",[id]);
    const applications=await this.db.query("SELECT * FROM ai_applications WHERE startup_id=$1 ORDER BY created_at",[id]);
    const executions=await this.db.query("SELECT s.id,s.run_id,s.role,s.round,s.model,s.prompt_version,s.prompt_hash,s.instructions,s.execution_config,s.input_payload FROM ai_steps s JOIN ai_runs r ON r.id=s.run_id WHERE r.startup_id=$1 ORDER BY s.created_at,s.id",[id]);
    const snapshots=await this.db.query("SELECT id,input_snapshot,input_hash,expected_vector,parent_run_id FROM ai_runs WHERE startup_id=$1 ORDER BY created_at,id",[id]);
    const memoryHistory=await this.db.query("SELECT * FROM ai_memory_history WHERE startup_id=$1 ORDER BY created_at,id",[id]);
    const plans=await this.db.query("SELECT * FROM ai_plans WHERE startup_id=$1 ORDER BY created_at,id",[id]);
    const calls=await this.db.query("SELECT c.* FROM ai_calls c JOIN ai_runs r ON r.id=c.run_id WHERE r.startup_id=$1 ORDER BY c.created_at,c.id",[id]);
    return {exportedAt:new Date().toISOString(),state,messages:rows,applications,executions,snapshots,memoryHistory,plans,calls,findings:await this.analysis.findings(id)};
  }
}
