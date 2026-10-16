import "server-only";
import OpenAI from "openai";
import { Agent, OpenAIProvider, Runner, setTracingDisabled, tool, webSearchTool, type Model, type ModelResponse } from "@openai/agents";
import { z } from "zod";
import { agentCatalog, modeRoles, outputSchema, safeSourceUrl, type AiEvidence, type AiResult, type AiRole, type AiSource, type AiStep } from "@/lib/domain/ai";
import { getDatabase } from "../database";
import { AppError } from "../errors";
import { estimatedCost, requireConfiguration } from "./config";
import { AiStore, type LeasedRun } from "./store";

setTracingDisabled(true);
type JsonObject = Record<string, unknown>;
const object = (v: unknown): JsonObject => v && typeof v === "object" && !Array.isArray(v) ? v as JsonObject : {};
export function responseSources(response: ModelResponse): { sources: AiSource[]; searches: number } {
  const sources = new Map<string,AiSource>(); let searches=0;
  const visit=(v:unknown)=>{
    if(Array.isArray(v)){v.forEach(visit);return;}
    const r=object(v);if(!Object.keys(r).length)return;
    if(r.type==="web_search_call")searches++;
    if(typeof r.url==="string") {const url=safeSourceUrl(r.url);if(url)sources.set(url,{url,title:typeof r.title==="string"?r.title:new URL(url).hostname,accessedAt:new Date().toISOString(),method:r.type==="url_citation"?"citation":"search"});}
    Object.values(r).forEach(visit);
  };
  // The raw Responses output includes citation annotations and actual tool source URLs.
  visit(response.providerData?.output || response.output);
  return {sources:[...sources.values()],searches};
}
export function checkCitations(result:AiResult,sources:AiSource[],role:AiRole,evidence:AiEvidence[]=[]):AiResult {
  const allowed=new Set(sources.map(s=>s.url)),evidenceIds=new Set(evidence.map(e=>e.id));const problems:string[]=[];
  const filter=(urls:string[])=>urls.map(safeSourceUrl).filter((u):u is string=>!!u&&allowed.has(u));
  const claims=result.claims.map(c=>{
    const urls=filter(c.sourceUrls);for(const url of c.sourceUrls)if(!urls.includes(safeSourceUrl(url)||""))problems.push(`Claim '${c.statement.slice(0,100)}': reference '${url.slice(0,180)}' was not retrieved.`);
    const ids=(c.evidenceIds||[]).filter(id=>evidenceIds.has(id));for(const id of c.evidenceIds||[])if(!evidenceIds.has(id))problems.push(`Claim '${c.statement.slice(0,100)}': observation '${id}' is absent from this snapshot.`);
    if(c.kind==="source_reported"&&!urls.length){
      if(ids.length)return {...c,kind:"founder_statement" as const,sourceUrls:[],evidenceIds:ids,limitation:`Founder-recorded observation; not independently verified. ${c.limitation||""}`.trim()};
      problems.push(`External claim '${c.statement.slice(0,150)}' has no retrieved supporting URL and was downgraded to inference.`);return {...c,kind:"inference" as const,sourceUrls:[],evidenceIds:[],limitation:"No supporting external source was returned by the research tool. Treat this external assertion as unverified."};
    }
    return {...c,sourceUrls:urls,evidenceIds:ids};
  });
  const recommendations=result.recommendations.map(r=>{const urls=filter(r.sourceUrls);for(const url of r.sourceUrls)if(!urls.includes(safeSourceUrl(url)||""))problems.push(`Recommendation '${r.title.slice(0,100)}': reference '${url.slice(0,180)}' was not retrieved.`);return {...r,sourceUrls:urls};});
  return {...result,claims,recommendations,experiments:role==="experimenter"?result.experiments:[],issues:[...(problems.length?[{severity:"material" as const,target:role,topic:"Unsupported references",reason:problems.slice(0,6).join(" "),correction:"Use actual retrieved URLs for external claims, actual supplied evidence IDs for founder observations, or label an unsupported assertion as inference/hypothesis. Snapshot task flags do not require web research."}]:[]),...result.issues].slice(0,12)};
}
export function calculation(input:{currency:string;period:string;unitPrice:number;units:number;variableCostPerUnit:number|null;fixedCosts:number|null}) {
  const revenue=input.unitPrice*input.units;
  const variableCosts=input.variableCostPerUnit===null?null:input.variableCostPerUnit*input.units;
  return {...input,revenue,variableCosts,contribution:variableCosts===null?null:revenue-variableCosts,operatingResult:variableCosts===null||input.fixedCosts===null?null:revenue-variableCosts-input.fixedCosts,warning:"Scenario from supplied assumptions, not a revenue forecast. Taxes, acquisition and other unknown costs are excluded."};
}
const calculator=()=>tool({name:"calculate_scenario",description:"Calculate a scenario using explicitly supplied assumptions. Unknown costs must be null. Never use this to invent customer willingness to pay or a forecast.",parameters:z.object({currency:z.string().min(1).max(20),period:z.string().min(1).max(100),unitPrice:z.number().min(0).max(1e9),units:z.number().min(0).max(1e9),variableCostPerUnit:z.number().min(0).max(1e9).nullable(),fixedCosts:z.number().min(0).max(1e12).nullable()}),execute:async input=>calculation(input)});
export function safeAiError(error:unknown) {
  if(error instanceof AppError)return error.message;
  const e=object(error);const code=String(e.code||"");const status=Number(e.status||0);
  if(status===401)return "OpenAI rejected the server API key. The owner needs to check its project and permissions.";
  if(status===403)return "This OpenAI project cannot access the requested model or tool.";
  if(status===429)return code==="insufficient_quota"?"The OpenAI project has no available quota. Review billing before starting a follow-up.":"OpenAI rate-limited the request. Completed work is preserved; retry with a follow-up later.";
  if(status===404)return "The configured OpenAI model is unavailable to this project.";
  if(status===400)return "OpenAI rejected the model or structured-output settings. The owner needs to review the integration configuration.";
  if(e.name==="AbortError"||e.name==="TimeoutError"||e.message==="Request was aborted.")return "The provider call exceeded its time limit. Its result and cost may be uncertain; no automatic retry was made.";
  return "The specialist could not return a complete, valid result. Completed work is preserved. If a provider call was interrupted, its reservation remains until the owner reviews usage.";
}
function latest(steps:AiStep[]) {
  const map=new Map<AiRole,AiStep>();for(const s of steps)if(s.status==="completed")map.set(s.role,s);return [...map.values()];
}
async function execute(store:AiStore,run:LeasedRun,step:AiStep,provider:OpenAIProvider) {
  const execution=await store.execution(step);
  const completed=latest(await store.steps(run.id));
  const [row]=await store.db.query("SELECT sources FROM ai_runs WHERE id=$1",[run.id]);
  const priorSources=row.sources as AiSource[];const found:AiSource[]=[];
  const rawModel=await provider.getModel(step.model);
  const metered:Model={
    async getResponse(request) {
      const size=Buffer.byteLength(JSON.stringify({instructions:request.systemInstructions,input:request.input,tools:request.tools,outputType:request.outputType}));
      if(size>200000)throw new AppError("AI_CONTEXT_LIMIT","The accumulated brief exceeds this run's context limit. Use a focused follow-up.",422);
      const reservation=step.role==="researcher"?estimatedCost(step.model,1100000,8000,3):estimatedCost(step.model,size+6000,8000);
      const call=await store.reserve(run,step,step.model,reservation);
      try {
        const response=await rawModel.getResponse(request);
        const retrieved=responseSources(response);found.push(...retrieved.sources);
        await store.settle(call,response.usage.inputTokens,response.usage.outputTokens,estimatedCost(step.model,response.usage.inputTokens,response.usage.outputTokens,retrieved.searches),response.responseId||null,{model:step.model,responseId:response.responseId||null,inputTokens:response.usage.inputTokens,outputTokens:response.usage.outputTokens,webSearchCalls:retrieved.searches,sources:retrieved.sources});
        return response;
      } catch(error) {
        const status=Number(object(error).status||0);
        if([400,401,403,404,422,429].includes(status))await store.settle(call,0,0,0,null,{kind:"provider_rejection",status});
        throw error;
      }
    },
    async *getStreamedResponse() { throw new AppError("AI_STREAM_UNSUPPORTED","This worker uses metered non-streaming calls.",500); },
  };
  const agent=new Agent({name:agentCatalog[step.role].name,model:metered,instructions:execution.instructions,outputType:outputSchema(step.role),tools:step.role==="researcher"?[webSearchTool({searchContextSize:"low"})]:step.role==="monetizer"?[calculator()]:[],modelSettings:{reasoning:{effort:execution.settings.reasoningEffort},maxTokens:execution.settings.maxTokens,store:false,retry:{maxRetries:0},providerData:step.role==="researcher"?{include:["web_search_call.action.sources"],max_tool_calls:execution.settings.webSearchCalls}:{}}});
  const payload=JSON.stringify({asOf:new Date().toISOString(),role:step.role,round:step.round,brief:run.brief,snapshot:run.snapshot,sourceLedger:priorSources,precedingArtifacts:completed.map(s=>({role:s.role,round:s.round,result:s.result})),instruction:"Make the next useful decision concrete. Unknowns and hypothesis labels must remain explicit. Do not treat source existence as proof of a claim."});
  const runner=new Runner({modelProvider:provider,tracingDisabled:true,traceIncludeSensitiveData:false});
  const result=await runner.run(agent,payload,{maxTurns:4,signal:AbortSignal.timeout(110000)});
  if(!result.finalOutput)throw new AppError("AI_EMPTY_OUTPUT","This specialist returned no usable proposal.",502);
  const parsed=outputSchema(step.role).parse(result.finalOutput);
  if(step.role==="experimenter"&&parsed.experiments.length<6)throw new AppError("AI_PLAN_INVALID","The experiment designer returned fewer than six tasks. Start a focused experiment follow-up.",422);
  await store.completeStep(run,step,checkCitations(parsed,[...priorSources,...found],step.role,run.snapshot.evidence),found);
}
export async function runAiJob(id:string) {
  const store=new AiStore(await getDatabase()); const run=await store.lease(id);if(!run)return;
  const start=Date.now();let active:AiStep|undefined;
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0,timeout:110000});
  const provider=new OpenAIProvider({openAIClient:client,useResponses:true});
  try {
    requireConfiguration();
    for(;;) {
      const steps=await store.steps(id);
      const order=modeRoles[run.mode];
      const pending=steps.filter(s=>s.status==="queued").sort((a,b)=>a.round-b.round||order.indexOf(a.role)-order.indexOf(b.role));
      if(!pending.length) {
        const review=latest(steps).find(s=>s.role==="critic");
        const serious=(review?.result?.issues||[]).filter(i=>i.severity!=="minor");
        if(!steps.some(s=>s.round===1)&&serious.length) {
          // At most two targeted specialists, plus downstream experiment refresh and final critique.
          const roles=[...new Set(serious.map(i=>i.target))].filter(r=>r!=="critic"&&r!=="intake"&&order.includes(r)).slice(0,2);
          if(roles.length) {
            if(roles.includes("researcher"))for(const downstream of ["strategist","monetizer"] as const)if(order.includes(downstream)&&!roles.includes(downstream))roles.push(downstream);
            if(order.includes("experimenter")&&roles.some(r=>["strategist","monetizer","researcher"].includes(r))&&!roles.includes("experimenter"))roles.push("experimenter");
            await store.scheduleRepair(run,roles);continue;
          }
        }
        await store.finish(run,serious.length?"needs_attention":"completed");return;
      }
      if(Date.now()-start>145000){await store.finish(run,"paused","Checkpoint saved. Resume to continue the remaining specialist work.");return;}
      active=pending[0];await store.startStep(run,active);await execute(store,run,active,provider);active=undefined;
    }
  } catch(error) {
    if(process.env.AI_DIAGNOSTICS==="true") {
      const e=object(error);
      const message=String(e.message||"").replaceAll(process.env.OPENAI_API_KEY||"__no_key__","[redacted]").replace(/sk-[a-zA-Z0-9_-]+/g,"[redacted]").slice(0,1200);
      console.error(JSON.stringify({event:"ai_diagnostic",role:active?.role,category:e.name,code:e.code,status:e.status,message}));
    }
    await store.finish(run,"failed",safeAiError(error),active?.id);
  } finally {await provider.close();}
}
