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

export const runtime="nodejs";
export const maxDuration=300;
type Context={params:Promise<{id:string}>};
const runAction=z.object({action:z.enum(["cancel","resume"]),runId:z.uuid()}).strict();
const applyAction=z.object({action:z.literal("apply"),runId:z.uuid(),stepId:z.uuid(),target:z.enum([...sectionKeys,"roadmap"])}).strict();
const schedule=(id:string)=>after(async()=>{try{await runAiJob(id);}catch{console.error("Orbit AI worker could not checkpoint: ServiceError");}});
export async function GET(request:Request,context:Context) {
  return handle(request,async()=>{
    const id=idFrom((await context.params).id);const c=aiConfig();
    if(!isAiAuthorized(request)){
      if(new URL(request.url).searchParams.get("export")==="1")requireAiAuthorization(request);
      return json({configured:c.configured,authorized:false,runs:[],nextCursor:null,evidence:[],limits:{runBudgetUsd:c.runBudgetUsd,dailyBudgetUsd:c.dailyBudgetUsd}});
    }
    const store=new AiStore(await getDatabase());
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
    if(p.action==="apply") {const a=applyAction.parse(input);return json(await store.apply(id,a.runId,a.stepId,a.target));}
    if(p.action==="cancel"||p.action==="resume") {
      const a=runAction.parse(input);const [r]=await store.db.query("SELECT id,status,lease_until FROM ai_runs WHERE id=$1 AND startup_id=$2",[a.runId,id]);if(!r)throw notFound();
      if(a.action==="cancel")await store.cancel(id,a.runId);
      else {if(!["queued","running","paused"].includes(String(r.status)))throw new AppError("AI_NOT_RESUMABLE","Start a follow-up from the saved artifacts for this run.",409);schedule(a.runId);}
      return json({id:a.runId});
    }
    throw new AppError("AI_ACTION","Unknown AI studio action.");
  });
}
