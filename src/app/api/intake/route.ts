import { after } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/server/database";
import { handle, idFrom, json, readJson } from "@/server/http";
import { aiConfig } from "@/server/ai/config";
import { isAiAuthorized, requireAiAuthorization, unlockAi } from "@/server/ai/auth";
import { IntakeStore, runIntake } from "@/server/ai/intake";

export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(request:Request) { return handle(request,async()=>{
  const id=new URL(request.url).searchParams.get("id");
  if(id){requireAiAuthorization(request);return json(await new IntakeStore(await getDatabase()).get(idFrom(id)));}
  return json({configured:aiConfig().configured,authorized:isAiAuthorized(request)});
}); }
export async function POST(request:Request) { return handle(request,async()=>{
  const input=await readJson(request,{maxBytes:256*1024});
  const action=z.object({action:z.enum(["unlock","analyze"]),payload:z.unknown()}).strict().parse(input);
  if(action.action==="unlock"){const cookie=await unlockAi(request,action.payload);const response=json({authorized:true});response.headers.set("Set-Cookie",cookie);return response;}
  requireAiAuthorization(request);
  const result=await new IntakeStore(await getDatabase()).create(action.payload);
  if(result.status==="queued")after(async()=>{try{await runIntake(result.id);}catch{console.error("Orbit intake worker: ServiceError");}});
  return json(result,202);
}); }
