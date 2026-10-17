import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { analysisLayoutSchema, defaultAnalysisLayout, memoryDataSchema, memoryInputSchema, type MemoryData, type MemoryItem, type QualityIssue, type SourcePage } from "@/lib/domain/analysis";
import type { AiResult, AiStep } from "@/lib/domain/ai";
import type { Database, SqlExecutor } from "../database";
import { AppError, conflict, notFound } from "../errors";
import { Store } from "../store";
import { artifactId, fingerprint } from "./identity";

const iso=(v:unknown)=>v instanceof Date?v.toISOString():String(v);
export type StoredFinding=NonNullable<AiResult["analysis"]>["findings"][number] & {support:string;stepId:string;runId:string;active?:boolean;snapshotAt?:string};
export class AnalysisStore {
  constructor(public db:Database) {}
  async memory(startupId:string,tx:SqlExecutor=this.db):Promise<MemoryItem[]> {
    const rows=await tx.query("SELECT * FROM ai_memory WHERE startup_id=$1 ORDER BY created_at,id",[startupId]);
    const observations=await tx.query("SELECT id,hypothesis_ids FROM ai_evidence WHERE startup_id=$1 ORDER BY created_at,id",[startupId]);
    return rows.map(r=>{
      const data=memoryDataSchema.parse(r.data);
      const targets=data.kind==="decision"?data.proposal.hypothesisRefs:[String(r.id)];
      const ids=observations.filter(e=>(e.hypothesis_ids as string[]).some(id=>targets.includes(id))).map(e=>String(e.id));
      const reviewed=new Set(r.reviewed_evidence as string[]);
      return {id:String(r.id),revision:Number(r.revision),status:r.status as MemoryItem["status"],data,originStepId:r.origin_step_id?String(r.origin_step_id):null,reason:String(r.reason),createdAt:iso(r.created_at),updatedAt:iso(r.updated_at),observations:ids,reviewNeeded:ids.some(id=>!reviewed.has(id))};
    });
  }
  async checkLinks(startupId:string,data:MemoryData,tx:SqlExecutor) {
    const p=data.proposal;
    for(const ref of p.findingRefs){
      if(!z.uuid().safeParse(ref).success||!(await tx.query("SELECT id FROM ai_findings WHERE id=$1 AND startup_id=$2",[ref,startupId])).length)throw new AppError("AI_REFERENCE","A finding reference is absent from this workspace.",422);
    }
    for(const id of p.evidenceIds)if(!(await tx.query("SELECT id FROM ai_evidence WHERE id=$1 AND startup_id=$2",[id,startupId])).length)throw new AppError("AI_REFERENCE","An observation reference is absent from this workspace.",422);
    if(data.kind==="decision"){
      if(!data.proposal.options.some(o=>o.key===data.proposal.selectedOption))throw new AppError("AI_DECISION","Choose one of this decision's options.",422);
      for(const id of data.proposal.hypothesisRefs)if(!z.uuid().safeParse(id).success||!(await tx.query("SELECT id FROM ai_memory WHERE id=$1 AND startup_id=$2 AND kind='hypothesis'",[id,startupId])).length)throw new AppError("AI_REFERENCE","A decision's hypothesis is absent from this workspace.",422);
      for(const option of data.proposal.options)for(const id of option.findingRefs)if(!z.uuid().safeParse(id).success||!(await tx.query("SELECT id FROM ai_findings WHERE id=$1 AND startup_id=$2",[id,startupId])).length)throw new AppError("AI_REFERENCE","An option's finding is absent from this workspace.",422);
    }
  }
  async saveMemory(startupId:string,input:unknown) {
    const p=memoryInputSchema.parse(input);
    return this.db.transaction(async tx=>{
      await new Store(this.db).workspaceIn(startupId,tx);
      const [used]=await tx.query("SELECT item_id,request_hash FROM ai_memory_history WHERE startup_id=$1 AND request_id=$2",[startupId,p.requestId]);
      if(used){if(used.request_hash!==fingerprint(p))throw new AppError("IDEMPOTENCY_CONFLICT","This observation/decision request has different content.",409);return (await this.memory(startupId,tx)).find(i=>i.id===used.item_id)!;}
      const id=p.id||randomUUID();
      const [old]=await tx.query("SELECT * FROM ai_memory WHERE id=$1 AND startup_id=$2 FOR UPDATE",[id,startupId]);
      if(p.id&&!old&&(p.expectedRevision!==0||(await tx.query("SELECT id FROM ai_memory WHERE id=$1",[p.id])).length))throw notFound();if(Number(old?.revision||0)!==p.expectedRevision)throw conflict();
      if(old&&old.kind!==p.data.kind)throw new AppError("AI_MEMORY_KIND","A hypothesis cannot change into a decision.",422);
      const data={...p.data,proposal:{...p.data.proposal,id}} as MemoryData;
      await this.checkLinks(startupId,data,tx);
      const targets=data.kind==="decision"?data.proposal.hypothesisRefs:[id];
      const seen=new Set([...(old?.reviewed_evidence as string[]||[]),...p.reviewedEvidenceIds]);
      const reviewed=(await tx.query("SELECT id,hypothesis_ids FROM ai_evidence WHERE startup_id=$1",[startupId])).filter(e=>seen.has(String(e.id))&&(e.hypothesis_ids as string[]).some(h=>targets.includes(h))).map(e=>String(e.id));
      await tx.query("INSERT INTO ai_memory(id,startup_id,kind,status,data,reason,reviewed_evidence) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb) ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,data=EXCLUDED.data,reason=EXCLUDED.reason,reviewed_evidence=EXCLUDED.reviewed_evidence,revision=ai_memory.revision+1,updated_at=now()",[id,startupId,data.kind,p.status,JSON.stringify(data),p.reason,JSON.stringify(reviewed)]);
      await this.history(tx,startupId,id,p.requestId,fingerprint(p));
      return (await this.memory(startupId,tx)).find(i=>i.id===id)!;
    });
  }
  async history(tx:SqlExecutor,startupId:string,id:string,requestId:string|null=null,requestHash:string|null=null) {
    await tx.query("INSERT INTO ai_memory_history(id,item_id,startup_id,revision,status,data,reason,reviewed_evidence,request_id,request_hash) SELECT $1,id,startup_id,revision,status,data,reason,reviewed_evidence,$3,$4 FROM ai_memory WHERE id=$2 AND startup_id=$5 ON CONFLICT(item_id,revision) DO NOTHING",[randomUUID(),id,requestId,requestHash,startupId]);
  }
  async layout(startupId:string,tx:SqlExecutor=this.db){const [r]=await tx.query("SELECT layout FROM ai_analysis_layouts WHERE startup_id=$1",[startupId]);return r?analysisLayoutSchema.parse(r.layout):defaultAnalysisLayout();}
  async saveLayout(startupId:string,input:unknown){const layout=analysisLayoutSchema.parse(input);await this.db.transaction(async tx=>{await new Store(this.db).workspaceIn(startupId,tx);await tx.query("INSERT INTO ai_analysis_layouts(startup_id,layout) VALUES($1,$2::jsonb) ON CONFLICT(startup_id) DO UPDATE SET layout=EXCLUDED.layout,revision=ai_analysis_layouts.revision+1",[startupId,JSON.stringify(layout)]);});return layout;}
  async pages(runId:string|string[],tx:SqlExecutor=this.db):Promise<SourcePage[]>{
    return (await tx.query("SELECT * FROM ai_source_pages WHERE run_id=ANY($1::uuid[]) ORDER BY accessed_at,id",[`{${(Array.isArray(runId)?runId:[runId]).join(",")}}`])).map(r=>({id:String(r.id),runId:String(r.run_id),url:String(r.url),title:String(r.title),accessedAt:iso(r.accessed_at),contentHash:String(r.content_hash),status:r.status as SourcePage["status"],limitation:String(r.limitation),passages:r.passages as SourcePage["passages"]}));
  }
  async page(startupId:string,id:string){const [r]=await this.db.query("SELECT run_id FROM ai_source_pages WHERE id=$1 AND startup_id=$2",[id,startupId]);if(!r)throw notFound();return (await this.pages(String(r.run_id))).find(p=>p.id===id)!;}
  async savePage(startupId:string,step:AiStep,page:SourcePage,tx:SqlExecutor){
    await tx.query("INSERT INTO ai_source_pages(id,startup_id,run_id,step_id,url,title,accessed_at,content_hash,status,limitation,passages) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) ON CONFLICT(run_id,url) DO NOTHING",[page.id,startupId,page.runId,step.id,page.url,page.title,page.accessedAt,page.contentHash,page.status,page.limitation,JSON.stringify(page.passages)]);
  }
  async findings(startupId:string,tx:SqlExecutor=this.db):Promise<StoredFinding[]>{return (await tx.query("SELECT f.*,r.created_at AS snapshot_at FROM ai_findings f JOIN ai_runs r ON r.id=f.run_id WHERE f.startup_id=$1 ORDER BY f.id",[startupId])).map(r=>({...r.data as StoredFinding,support:String(r.support),stepId:String(r.step_id),runId:String(r.run_id),active:Boolean(r.active),snapshotAt:iso(r.snapshot_at)}));}
  async issues(runId:string|string[],tx:SqlExecutor=this.db):Promise<(QualityIssue & {runId:string})[]>{return (await tx.query("SELECT * FROM ai_quality_issues WHERE run_id=ANY($1::uuid[]) ORDER BY created_at,id",[`{${(Array.isArray(runId)?runId:[runId]).join(",")}}`])).map(r=>({id:String(r.id),runId:String(r.run_id),stepId:String(r.step_id),severity:r.severity as QualityIssue["severity"],target:String(r.target),topic:String(r.topic),reason:String(r.reason),correction:String(r.correction),deterministic:Boolean(r.deterministic),status:r.status as QualityIssue["status"],resolution:r.resolution?String(r.resolution):null}));}
  async registerIssues(runId:string,step:AiStep,result:AiResult,tx:SqlExecutor,machineCount=0){
    const machine=result.issues.slice(0,machineCount);
    // A successful revised artifact can retire its earlier machine-detected defects.
    await tx.query("UPDATE ai_quality_issues SET status='resolved',resolution='Rechecked against the revised artifact.' WHERE run_id=$1 AND step_id IN (SELECT id FROM ai_steps WHERE run_id=$1 AND role=$2) AND deterministic=true AND status='open' AND topic NOT IN (SELECT jsonb_array_elements_text($3::jsonb))",[runId,step.role,JSON.stringify(machine.map(i=>i.topic))]);
    for(const [i,issue] of result.issues.entries())await tx.query("INSERT INTO ai_quality_issues(id,run_id,step_id,severity,target,topic,reason,correction,deterministic) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING",[artifactId(step.id,"issue",String(i)),runId,step.id,issue.severity,issue.target,issue.topic,issue.reason,issue.correction,i<machineCount]);
    if(step.role==="critic")for(const resolution of result.analysis?.resolutions||[]){
      // Deterministic invalidity cannot be waived by a model's prose.
      await tx.query("UPDATE ai_quality_issues SET status=$3,resolution=$4 WHERE id=$1 AND run_id=$2 AND deterministic=false",[resolution.issueId,runId,resolution.outcome,resolution.reason]);
    }
  }
  async proposedMemory(startupId:string,step:AiStep,result:AiResult,tx:SqlExecutor){
    for(const kind of ["hypothesis","decision"] as const)for(const proposal of (kind==="hypothesis"?result.analysis?.hypotheses:result.analysis?.decisions)||[]){
      if(!proposal.id)continue;
      // Existing decisions are proposals in the artifact until explicitly accepted.
      const data={kind,proposal};
      await tx.query("INSERT INTO ai_memory(id,startup_id,kind,status,data,origin_step_id,reason) VALUES($1,$2,$3,'proposed',$4::jsonb,$5,'AI proposal; founder has not accepted it.') ON CONFLICT(id) DO NOTHING",[proposal.id,startupId,kind,JSON.stringify(data),step.id]);
      await this.history(tx,startupId,proposal.id);
    }
  }
  async impactedDecisions(startupId:string,hypothesisIds:string[],tx:SqlExecutor){
    if(!hypothesisIds.length)return;
    const decisions=(await this.memory(startupId,tx)).filter(i=>i.data.kind==="decision"&&i.data.proposal.hypothesisRefs.some(id=>hypothesisIds.includes(id)));
    // Review markers preserve accepted decisions; observations never rewrite them.
    for(const item of decisions)await tx.query("UPDATE ai_memory SET reviewed_evidence='[]'::jsonb WHERE id=$1",[item.id]);
  }
}
