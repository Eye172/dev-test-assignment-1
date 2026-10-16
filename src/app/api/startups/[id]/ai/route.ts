import { after } from "next/server";
import { z } from "zod";
import { sectionKeys } from "@/lib/domain/schemas";
import { getDatabase } from "@/server/database";
import { AppError, notFound } from "@/server/errors";
import { handle, idFrom, json, readJson } from "@/server/http";
import { aiConfig } from "@/server/ai/config";
import { isAiAuthorized, lockAiCookie, requireAiAuthorization, unlockAi } from "@/server/ai/auth";
import { AiStore } from "@/server/ai/store";
import { runAiJob } from "@/server/ai/runtime";
import { planSelectionSchema } from "@/lib/domain/analysis";

export const runtime="nodejs";
export const maxDuration=300;
type Context={params:Promise<{id:string}>};
const runAction=z.object({action:z.enum(["cancel","resume"]),runId:z.uuid()}).strict();
const applyAction=z.object({action:z.literal("apply"),runId:z.uuid(),stepId:z.uuid(),target:z.enum([...sectionKeys,"roadmap"]),plan:z.object({selection:planSelectionSchema,previewHash:z.string().length(64)}).strict().optional()}).strict();
const previewAction=z.object({action:z.literal("preview_plan"),runId:z.uuid(),stepId:z.uuid(),selection:planSelectionSchema.optional()}).strict();
const rememberAction=z.object({action:z.literal("remember"),runId:z.uuid(),stepId:z.uuid(),kind:z.enum(["hypothesis","decision"]),key:z.string().min(1).max(60)}).strict();
const schedule=(id:string)=>after(async()=>{try{await runAiJob(id);}catch{console.error("Orbit AI worker could not checkpoint: ServiceError");}});
export async function GET(request:Request,context:Context) {
  return handle(request,async()=>{
    const id=idFrom((await context.params).id);const c=aiConfig();
    if(!isAiAuthorized(request)){
      if(new URL(request.url).searchParams.get("export")==="1"||new URL(request.url).searchParams.has("sourcePageId"))requireAiAuthorization(request);
      return json({configured:c.configured,authorized:false,runs:[],nextCursor:null,evidence:[],limits:{runBudgetUsd:c.runBudgetUsd,dailyBudgetUsd:c.dailyBudgetUsd}});
    }
    const store=new AiStore(await getDatabase());
    const pageId=new URL(request.url).searchParams.get("sourcePageId");if(pageId)return json(await store.analysis.page(id,idFrom(pageId)));
    if(new URL(request.url).searchParams.get("export")==="1")return new Response(JSON.stringify(await store.export(id),null,2),{headers:{"Content-Type":"application/json","Content-Disposition":'attachment; filename="orbit-ai-history.json"',"Cache-Control":"no-store"}});
    const before=new URL(request.url).searchParams.get("before");
    return json(await store.state(id,{...(before?{before:idFrom(before)}:{})}));
  });
}
export async function POST(request:Request,context:Context) {
  return handle(request,async()=>{
    const id=idFrom((await context.params).id);
    const input=await readJson(request);const p=z.object({action:z.string(),payload:z.unknown().optional()}).passthrough().parse(input);
    if(p.action==="unlock") {const cookie=await unlockAi(request,p.payload);const response=json({authorized:true});response.headers.set("Set-Cookie",cookie);return response;}
    requireAiAuthorization(request);
    if(p.action==="lock"){const response=json({authorized:false});response.headers.set("Set-Cookie",lockAiCookie());return response;}
    const store=new AiStore(await getDatabase());
    if(p.action==="create") {const run=await store.create(id,p.payload);schedule(run.id);return json(run,run.created?201:200);}
    if(p.action==="evidence")return json(await store.addEvidence(id,p.payload),201);
    if(p.action==="memory")return json(await store.analysis.saveMemory(id,p.payload));
    if(p.action==="layout")return json(await store.analysis.saveLayout(id,p.payload));
    if(p.action==="remember"){const a=rememberAction.parse(input);return json(await store.remember(id,a.runId,a.stepId,a.kind,a.key));}
    if(p.action==="preview_plan"){const a=previewAction.parse(input);return json(await store.previewPlan(id,a.runId,a.stepId,a.selection));}
    if(p.action==="apply") {const a=applyAction.parse(input);return json(await store.apply(id,a.runId,a.stepId,a.target,a.plan));}
    if(p.action==="cancel"||p.action==="resume") {
      const a=runAction.parse(input);const [r]=await store.db.query("SELECT id,status,lease_until FROM ai_runs WHERE id=$1 AND startup_id=$2",[a.runId,id]);if(!r)throw notFound();
      if(a.action==="cancel")await store.cancel(id,a.runId);
      else {if(!["queued","running","paused"].includes(String(r.status)))throw new AppError("AI_NOT_RESUMABLE","Start a follow-up from the saved artifacts for this run.",409);schedule(a.runId);}
      return json({id:a.runId});
    }
    throw new AppError("AI_ACTION","Unknown AI studio action.");
  });
}
