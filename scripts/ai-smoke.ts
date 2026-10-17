/** Owner-only HTTP acceptance. Uses an existing synthetic completed run.
 * Mutates that working copy. AI_SMOKE_RUN_FOLLOWUP=true additionally spends API credits.
 */
import { randomUUID } from "node:crypto";
import { mkdir,writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import type { AiStudioState } from "../src/lib/domain/ai";
import type { Workspace } from "../src/lib/domain/types";
import { sectionKeys } from "../src/lib/domain/schemas";
import type { PlanPreview } from "../src/lib/domain/analysis";

async function main(){
  const base=process.env.AI_SMOKE_BASE_URL||"http://127.0.0.1:3000",startupId=process.env.AI_SMOKE_STARTUP_ID;
  assert(startupId&&process.env.AI_ACCESS_CODE,"Set the synthetic working copy ID and owner access code locally.");
  const endpoint=`${base}/api/startups/${startupId}/ai`;let cookie="";
  async function request<T>(url=endpoint,body?:unknown,expected=200):Promise<T>{const response=await fetch(url,{method:body?"POST":"GET",headers:{"Content-Type":"application/json",...(body?{Origin:new URL(base).origin}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});assert.equal(response.status,expected,`HTTP status ${response.status}`);if(response.headers.get("set-cookie"))cookie=response.headers.get("set-cookie")!.split(";")[0];return (await response.json()).data as T;}
  assert.equal((await request<AiStudioState>()).authorized,false);
  await request(endpoint,{action:"unlock",payload:{code:process.env.AI_ACCESS_CODE}});
  let state=await request<AiStudioState>();const run=process.env.AI_SMOKE_PARENT_RUN_ID?state.runs.find(r=>r.id===process.env.AI_SMOKE_PARENT_RUN_ID):state.runs.find(r=>["completed","needs_attention"].includes(r.status)&&!r.stale);assert(run,"Use a current reviewed synthetic run, or explicitly choose a parent for a follow-up-only evaluation.");
  const latest=(role:string)=>run.steps.filter(s=>s.role===role&&s.status==="completed").at(-1)!;
  if(process.env.AI_SMOKE_APPLY!=="false"){
  for(const role of ["strategist","monetizer"]){const s=latest(role);for(const kind of ["hypothesis","decision"] as const)for(const proposal of (kind==="hypothesis"?s.result?.analysis?.hypotheses:s.result?.analysis?.decisions)||[])await request(endpoint,{action:"remember",runId:run.id,stepId:s.id,kind,key:proposal.key});}
  for(const target of sectionKeys)await request<Workspace>(endpoint,{action:"apply",runId:run.id,stepId:latest(target==="pricing"?"monetizer":"strategist").id,target});
  const experimenter=latest("experimenter");let reviewed:PlanPreview|undefined;
  if(experimenter.result?.analysis){
    reviewed=await request<PlanPreview>(endpoint,{action:"preview_plan",runId:run.id,stepId:experimenter.id});
    if(reviewed.unknowns.length&&process.env.AI_SMOKE_ACK_UNKNOWN==="true")reviewed=await request<PlanPreview>(endpoint,{action:"preview_plan",runId:run.id,stepId:experimenter.id,selection:{...reviewed.selection,acknowledgeUnknowns:true}});
    assert(reviewed.ready,`Plan requires review: ${[...reviewed.blockers,...reviewed.unknowns].join(" ")}`);
  }
  const payloadApply={action:"apply",runId:run.id,stepId:experimenter.id,target:"roadmap",...(reviewed?{plan:{selection:reviewed.selection,previewHash:reviewed.hash}}:{})};
  const plan=await request<Workspace>(endpoint,payloadApply);
  const repeat=await request<Workspace>(endpoint,payloadApply);assert.equal(plan.tasks.length,repeat.tasks.length);assert.equal(plan.completion.percentage,100);assert.equal(plan.tasks.filter(t=>t.source==="ai"&&!t.archived).length,experimenter.result!.experiments.length);
  const task=plan.tasks.find(t=>t.source==="ai")!;
  const hypothesisId=latest("strategist").result?.analysis?.hypotheses[0]?.id;
  const payload={requestId:randomUUID(),taskId:task.id,kind:"interview",observation:"Synthetic follow-up evidence: only one of five screened courier managers transfers voice notes into a separate dispatch record; four work directly in chat. No one committed to payment.",interpretation:"contradicts",sampleSize:5,sourceUrl:"",method:"Five screened phone interviews; founder-recorded results, not independently verified",observedOn:"2026-10-17",limitations:"Small convenience sample; no measured handling-time comparison or verified payment.",hypothesisIds:hypothesisId?[hypothesisId]:[]};
  const first=await request<{id:string}>(endpoint,{action:"evidence",payload},201),second=await request<{id:string}>(endpoint,{action:"evidence",payload},201);assert.equal(first.id,second.id);
  const legacy=await fetch(`${base}/api/startups/${startupId}/export`);assert(!(await legacy.text()).includes(payload.observation));
  state=await request<AiStudioState>();assert(state.runs.find(r=>r.id===run.id)?.stale);assert.equal(state.evidence.filter(e=>e.id===first.id).length,1);
  if(hypothesisId)assert(state.memory?.find(m=>m.id===hypothesisId)?.reviewNeeded,"New adverse observation must reopen review, not silently change the belief.");
  console.log(JSON.stringify({event:"http_acceptance",startupId,runId:run.id,completion:plan.completion.percentage,aiTasks:plan.tasks.filter(t=>t.source==="ai").length,idempotentApplication:true,idempotentEvidence:true,privateEvidence:true,staleAfterObservation:true}));
  }
  if(process.env.AI_SMOKE_RUN_FOLLOWUP==="true"){
    const follow=await request<{id:string}>(endpoint,{action:"create",payload:{mode:"experiments",brief:"Use the new five-interview counter-evidence to revise the next experiments. The existing strategy is an accepted draft, not proof. Prioritize checking whether our narrow segment is reachable before collecting payment. Keep 8 hours/week and $300 total; don't present the small sample as representative. Cite inherited research honestly without claiming fresh browsing.",parentRunId:run.id,requestId:randomUUID()}},201);
    let previous="";const checkpoints=new Set<string>();let complete=false;
    for(let i=0;i<150;i++){
      const current=await request<AiStudioState>();const r=current.runs.find(r=>r.id===follow.id)!;const signature=JSON.stringify([r.status,r.steps.map(s=>s.status)]);
      if(signature!==previous){console.log(JSON.stringify({event:"followup_progress",runId:r.id,status:r.status,steps:r.steps.map(s=>`${s.role}:${s.round}:${s.status}`),sources:r.sources.length,costUsd:r.estimatedMicros/1e6}));previous=signature;}
      if(r.status==="paused"&&!checkpoints.has(r.updatedAt)){checkpoints.add(r.updatedAt);await request(endpoint,{action:"resume",runId:r.id});}
      if(!["queued","running","paused"].includes(r.status)){
        assert(["completed","needs_attention"].includes(r.status),"Follow-up stopped before review");assert(r.sources.length>0,"Inherited source ledger was lost");const result=r.steps.filter(s=>s.role==="experimenter"&&s.status==="completed").at(-1)?.result;assert(result&&result.experiments.length>=6);assert(/five|5|sample|interview/i.test(JSON.stringify(result)),"New observation was not reflected in the proposal");
        await mkdir(".data/ai-evals",{recursive:true});await writeFile(".data/ai-evals/http-followup.json",JSON.stringify({startupId,run:r,evidence:current.evidence},null,2));console.log(JSON.stringify({event:"followup_complete",runId:r.id,status:r.status,costUsd:r.estimatedMicros/1e6,experiments:result.experiments.length,inheritedSources:r.sources.length}));complete=true;break;
      }
      await new Promise(resolve=>setTimeout(resolve,4000));
    }
    assert(complete,"Follow-up did not finish before acceptance timeout; its run remains saved.");
  }
}
main().catch(()=>{console.error("AI HTTP acceptance failed. Inspect the persisted synthetic run; no credentials or raw provider errors were printed.");process.exitCode=1;});
