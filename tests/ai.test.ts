import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createDatabase, type Database } from "@/server/database";
import { Store } from "@/server/store";
import { demoProfile, demoStrategy } from "@/server/demo";
import { AiStore, revisionVector } from "@/server/ai/store";
import { aiResultSchema, outputSchema, safeSourceUrl, type AiResult, type AiRole } from "@/lib/domain/ai";
import { calculation, checkCitations, safeAiError } from "@/server/ai/runtime";
import { isAiAuthorized } from "@/server/ai/auth";

let db:Database,store:Store,ai:AiStore;
beforeAll(async()=>{process.env.OPENAI_API_KEY="test-fixture-no-paid-calls";process.env.AI_ACCESS_CODE="test-access-code-only";db=await createDatabase(process.env.TEST_DATABASE_URL||"memory://");store=new Store(db);ai=new AiStore(db);});
afterAll(async()=>{await db.close();});
const emptyResult=():AiResult=>aiResultSchema.parse({title:"Synthetic contract fixture",summary:"An untested proposal for a synthetic test, not a live AI result.",claims:[],recommendations:[],questions:[],strategy:{icp:null,value:null,channels:null,pricing:null,assumptions:null},experiments:[],issues:[]});
const experiment=(i:number)=>({title:`Test hypothesis ${i}`,week:(i%4)+1,deliverable:"A decision log with observed results",rationale:"Test the most uncertain buyer assumption",hypothesis:"A named buyer experiences this pain",method:"Interview five screened buyers",metric:"Recent examples of the pain",threshold:"At least three of five provide a recent example; otherwise revise",effort:"2 founder hours",dependencies:[],contract:null});
async function ready(mode="full"){
  const startup=await store.createStartup(demoProfile);const created=await ai.create(startup.id,{mode,brief:"Synthetic test brief",requestId:randomUUID()});const run=(await ai.lease(created.id))!;
  for(const step of await ai.steps(run.id)){
    const result=emptyResult();
    if(step.role==="strategist")result.strategy=aiResultSchema.shape.strategy.parse({...result.strategy,icp:demoStrategy.icp,value:demoStrategy.value,channels:demoStrategy.channels,assumptions:demoStrategy.assumptions});
    if(step.role==="monetizer")result.strategy.pricing=demoStrategy.pricing as AiResult["strategy"]["pricing"];
    if(step.role==="experimenter")result.experiments=Array.from({length:6},(_,i)=>experiment(i));
    await ai.startStep(run,step);await ai.completeStep(run,step,outputSchema(step.role).parse(result),[]);
  }
  await ai.finish(run,"completed");return {startup,run,state:await ai.state(startup.id)};
}
describe("agent contracts and evidence boundaries",()=>{
  it("reviews completed saved artifacts without scheduling duplicate paid specialists",async()=>{
    const {startup,run}=await ready();
    await expect(ai.create(startup.id,{mode:"review",brief:"Review only",requestId:randomUUID()})).rejects.toThrow();
    const child=await ai.create(startup.id,{mode:"review",brief:"Review saved work",parentRunId:run.id,requestId:randomUUID()});
    expect((await ai.steps(child.id)).map(s=>s.role)).toEqual(["critic"]);
    const leased=(await ai.lease(child.id))!;
    expect(leased.snapshot.parent.some(p=>p.role==="experimenter")).toBe(true);
    expect(leased.snapshot.parent.some(p=>p.role==="strategist")).toBe(true);
    await ai.cancel(startup.id,child.id);
    const empty=await ai.create(startup.id,{mode:"research",brief:"No completed results",requestId:randomUUID()});
    await ai.cancel(startup.id,empty.id);
    await expect(ai.create(startup.id,{mode:"review",brief:"Cannot review nothing",parentRunId:empty.id,requestId:randomUUID()})).rejects.toMatchObject({code:"AI_REVIEW_EMPTY"});
  });
  it("restricts role-owned drafts and rejects malformed experiments",()=>{
    const result=emptyResult();result.strategy.pricing=demoStrategy.pricing as AiResult["strategy"]["pricing"];
    expect(outputSchema("researcher").safeParse(result).success).toBe(false);
    expect(outputSchema("monetizer").safeParse(result).success).toBe(true);
    result.experiments=[{...experiment(1),week:5}];expect(aiResultSchema.safeParse(result).success).toBe(false);
  });
  it("removes invented citations and downgrades unsupported factual assertions",()=>{
    const result=emptyResult();result.claims=[{statement:"A vendor claims an outcome",kind:"source_reported",sourceUrls:["https://invented.example/proof"],evidenceIds:[],limitation:null}];
    const checked=checkCitations(result,[],"researcher");expect(checked.claims[0]).toMatchObject({kind:"inference",sourceUrls:[]});expect(checked.issues[0].severity).toBe("material");
    expect(safeSourceUrl("https://example.com/pricing?utm_source=test")).toBe("https://example.com/pricing");
    for(const url of ["javascript:alert(1)","http://example.com","https://127.0.0.1","https://user:secret@example.com","https://localhost"])expect(safeSourceUrl(url)).toBeNull();
  });
  it("calculates only supplied assumptions, keeping missing costs unknown",()=>{
    expect(calculation({currency:"KZT",period:"month",unitPrice:10000,units:3,variableCostPerUnit:null,fixedCosts:null})).toMatchObject({revenue:30000,variableCosts:null,contribution:null,operatingResult:null});
    expect(calculation({currency:"USD",period:"month",unitPrice:20,units:10,variableCostPerUnit:2,fixedCosts:100})).toMatchObject({revenue:200,contribution:180,operatingResult:80});
  });
  it("accepts internal primary evidence and snapshot records without requiring public URLs",()=>{
    const id=randomUUID();const evidence={id,requestId:randomUUID(),taskId:null,kind:"interview" as const,observation:"Only one of five buyers uses this workflow",interpretation:"contradicts" as const,sampleSize:5,sourceUrl:"",method:"Screened interviews",observedOn:"2026-10-17",limitations:"Small founder-recorded sample",createdAt:new Date().toISOString(),hypothesisIds:[]};
    const result=emptyResult();result.claims=[{statement:evidence.observation,kind:"founder_statement",sourceUrls:[],evidenceIds:[id],limitation:evidence.limitations},{statement:"Saved tasks are todo",kind:"workspace_record",sourceUrls:[],evidenceIds:[],limitation:"As of the immutable snapshot"}];
    expect(checkCitations(result,[],"intake",[evidence]).issues).toEqual([]);
    result.claims[0].kind="source_reported";expect(checkCitations(result,[],"intake",[evidence]).claims[0].kind).toBe("founder_statement");
    result.claims[0].evidenceIds=[randomUUID()];expect(checkCitations(result,[],"intake",[evidence]).issues[0].reason).toContain("absent from this snapshot");
  });
  it("does not expose provider errors, keys or forged session values",()=>{
    expect(safeAiError(new Error("sk-secret internal request"))).not.toContain("sk-secret");
    expect(safeAiError({status:401,message:"secret"})).toContain("API key");
    expect(isAiAuthorized(new Request("http://localhost",{headers:{cookie:`orbit_ai_owner=${Date.now()+10000}.forged`}}))).toBe(false);
  });
});
describe("persisted agent orchestration",()=>{
  it("paginates run history while exporting every retained run",async()=>{
    const startup=await store.createStartup(demoProfile);
    for(let i=0;i<31;i++){const run=await ai.create(startup.id,{mode:"experiments",brief:`History fixture ${i}`,requestId:randomUUID()});await ai.cancel(startup.id,run.id);}
    const page=await ai.state(startup.id);expect(page.runs).toHaveLength(30);expect(page.nextCursor).toBeTruthy();const older=await ai.state(startup.id,{before:page.nextCursor!});expect(older.runs).toHaveLength(1);expect(older.nextCursor).toBeNull();expect((await ai.export(startup.id)).state.runs).toHaveLength(31);
  });
  it("freezes the complete effective prompt and rejects tampered or incompatible replay before paid work",async()=>{
    const startup=await store.createStartup(demoProfile);const created=await ai.create(startup.id,{mode:"research",brief:"Prompt replay fixture",requestId:randomUUID()});const step=(await ai.steps(created.id))[0];const original=await ai.execution(step);expect(original.instructions).toContain("Return analysis.version=2");expect(original.settings).toMatchObject({store:false,retries:0});expect(original.settings.timeoutMs).toBe(step.role==="intake"?110000:step.role==="researcher"?250000:200000);expect(step.promptVersion).toBe("orbit-council-3.0.1");
    await db.query("UPDATE ai_steps SET instructions=instructions || ' tampered' WHERE id=$1",[step.id]);await expect(ai.execution(step)).rejects.toMatchObject({code:"AI_VERSION_CHANGED"});const [count]=await db.query("SELECT count(*) AS count FROM ai_calls WHERE run_id=$1",[created.id]);expect(Number(count.count)).toBe(0);await ai.cancel(startup.id,created.id);
  });
  it("scopes request identifiers to workspace and rejects payload reuse",async()=>{
    const startup=await store.createStartup(demoProfile),requestId=randomUUID();const input={mode:"research",brief:"A brief",requestId};
    const first=await ai.create(startup.id,input);const second=await ai.create(startup.id,input);expect(second).toEqual({id:first.id,created:false});
    await expect(ai.create(startup.id,{...input,brief:"Another brief"})).rejects.toMatchObject({status:409});
    await expect(ai.create(startup.id,{...input,requestId:randomUUID()})).rejects.toMatchObject({code:"AI_RUN_ACTIVE"});
    await ai.cancel(startup.id,first.id);
  });
  it("fences concurrent workers and refuses to automatically rebill ambiguous calls",async()=>{
    const startup=await store.createStartup(demoProfile);const created=await ai.create(startup.id,{mode:"research",brief:"A brief",requestId:randomUUID()});const run=(await ai.lease(created.id))!;
    expect(await ai.lease(created.id)).toBeNull();
    const step=(await ai.steps(run.id))[0];await ai.startStep(run,step);await ai.reserve(run,step,step.model,1000);
    await db.query("UPDATE ai_runs SET lease_until=$2 WHERE id=$1",[run.id,new Date(Date.now()-1)]);
    expect(await ai.lease(run.id)).toBeNull();expect((await ai.state(startup.id)).runs[0].status).toBe("failed");
    await expect(ai.completeStep(run,step,emptyResult(),[])).rejects.toMatchObject({code:"AI_CANCELLED"});
  });
  it("reserves shared budgets atomically and settles usage exactly once",async()=>{
    const startup=await store.createStartup(demoProfile);const created=await ai.create(startup.id,{mode:"research",brief:"Budget test",requestId:randomUUID()});const run=(await ai.lease(created.id))!,step=(await ai.steps(run.id))[0];
    const calls=await Promise.allSettled([ai.reserve(run,step,step.model,4000000),ai.reserve(run,step,step.model,4000000)]);
    expect(calls.filter(c=>c.status==="fulfilled")).toHaveLength(1);expect(calls.filter(c=>c.status==="rejected")).toHaveLength(1);
    const id=(calls.find(c=>c.status==="fulfilled") as PromiseFulfilledResult<string>).value;
    await ai.settle(id,100,50,700,"test-response",{});await ai.settle(id,100,50,700,"test-response",{});
    const [r]=await db.query("SELECT estimated_micros,reserved_micros,input_tokens FROM ai_runs WHERE id=$1",[run.id]);expect(Number(r.estimated_micros)).toBe(700);expect(Number(r.reserved_micros)).toBe(0);expect(Number(r.input_tokens)).toBe(100);
    await ai.cancel(startup.id,run.id);
  });
  it("allows the expanded council to reach critique while retaining token and dollar caps",async()=>{
    const startup=await store.createStartup(demoProfile);
    const created=await ai.create(startup.id,{mode:"full",brief:"Expanded research budget regression",requestId:randomUUID()});
    const run=(await ai.lease(created.id))!,step=(await ai.steps(run.id)).find(s=>s.role==="critic")!;
    await ai.startStep(run,step);
    await db.query("UPDATE ai_runs SET input_tokens=287080,output_tokens=27195,estimated_micros=1265598 WHERE id=$1",[run.id]);
    const call=await ai.reserve(run,step,step.model,3000000);
    await ai.settle(call,1000,500,35000,"critic-budget-fixture",{});
    await expect(ai.reserve(run,step,step.model,6000000)).rejects.toMatchObject({code:"AI_BUDGET"});
    await db.query("UPDATE ai_runs SET input_tokens=600000 WHERE id=$1",[run.id]);
    await expect(ai.reserve(run,step,step.model,1000)).rejects.toMatchObject({code:"AI_BUDGET"});
    await ai.cancel(startup.id,run.id);
  });
  it("does not rebill a paid response lost between settlement and artifact checkpoint",async()=>{
    const startup=await store.createStartup(demoProfile);const created=await ai.create(startup.id,{mode:"research",brief:"Checkpoint interruption",requestId:randomUUID()});const run=(await ai.lease(created.id))!,step=(await ai.steps(run.id))[0];
    await ai.startStep(run,step);const call=await ai.reserve(run,step,step.model,1000);await ai.settle(call,10,10,100,"settled-but-not-checkpointed",{});
    await db.query("UPDATE ai_runs SET lease_until=$2 WHERE id=$1",[run.id,new Date(Date.now()-1)]);expect(await ai.lease(run.id)).toBeNull();
    const state=await ai.state(startup.id);expect(state.runs[0].status).toBe("failed");expect(state.runs[0].estimatedMicros).toBe(100);
    const [count]=await db.query("SELECT count(*) AS count FROM ai_calls WHERE run_id=$1",[run.id]);expect(Number(count.count)).toBe(1);
  });
  it("retains new citations beside a large inherited ledger and carries both into follow-ups",async()=>{
    const startup=await store.createStartup(demoProfile);const created=await ai.create(startup.id,{mode:"research",brief:"Source persistence fixture",requestId:randomUUID()});const run=(await ai.lease(created.id))!;
    const sources=Array.from({length:100},(_,i)=>({url:`https://example.com/source/${i}`,title:`Synthetic source ${i}`,method:"search" as const,accessedAt:new Date().toISOString()}));
    const fresh={url:"https://example.org/new-source",title:"New synthetic source",method:"citation" as const,accessedAt:new Date().toISOString()};
    for(const step of await ai.steps(run.id)){const result=emptyResult();if(step.role==="researcher")result.claims=[{kind:"source_reported",statement:"A synthetic reported claim",sourceUrls:[fresh.url],evidenceIds:[],limitation:"Fixture only"}];await ai.startStep(run,step);await ai.completeStep(run,step,result,step.role==="intake"?sources:step.role==="researcher"?[fresh]:[]);}await ai.finish(run,"completed");
    expect((await ai.state(startup.id)).runs[0].sources).toHaveLength(101);
    const child=await ai.create(startup.id,{mode:"experiments",brief:"Keep provenance",parentRunId:run.id,requestId:randomUUID()});const childState=(await ai.state(startup.id)).runs.find(r=>r.id===child.id)!;expect(childState.sources.map(s=>s.url)).toContain(fresh.url);await ai.cancel(startup.id,child.id);
  });
  it("preserves completed artifacts and refuses publication after cancellation",async()=>{
    const startup=await store.createStartup(demoProfile);const created=await ai.create(startup.id,{mode:"research",brief:"Cancel test",requestId:randomUUID()});const run=(await ai.lease(created.id))!,step=(await ai.steps(run.id))[0];
    await ai.startStep(run,step);await ai.recordTool(run,step,"calculate_scenario",{units:3},{revenue:30});expect((await ai.export(startup.id)).messages.some(m=>m.sender==="calculate_scenario"&&(m.content as Record<string,unknown>).tool==="calculate_scenario")).toBe(true);await ai.completeStep(run,step,emptyResult(),[]);await ai.cancel(startup.id,run.id);
    await expect(ai.recordTool(run,step,"calculate_scenario",{units:4},{revenue:40})).rejects.toMatchObject({code:"AI_CANCELLED"});
    await expect(ai.startStep(run,(await ai.steps(run.id))[1])).rejects.toMatchObject({code:"AI_CANCELLED"});const state=await ai.state(startup.id);expect(state.runs[0].steps[0].result?.title).toBeTruthy();expect(state.runs[0].status).toBe("cancelled");
  });
});
describe("reviewed application, versioning and experiment history",()=>{
  const specialist=(state:Awaited<ReturnType<AiStore["state"]>>,role:AiRole)=>state.runs[0].steps.find(s=>s.role===role)!;
  it("applies multiple sections idempotently with transactional before/after history",async()=>{
    const {startup,run,state}=await ready();const s=specialist(state,"strategist");
    await ai.apply(startup.id,run.id,s.id,"icp");await ai.apply(startup.id,run.id,s.id,"icp");await ai.apply(startup.id,run.id,s.id,"value");
    const current=await store.workspace(startup.id);expect(current.sections.find(s=>s.key==="icp")?.revision).toBe(1);expect(current.completion.percentage).toBe(40);
    const history=await ai.export(startup.id);expect(history.applications).toHaveLength(2);expect(history.messages.some(m=>m.kind==="artifact")).toBe(true);expect(history.state.runs[0].stale).toBe(false);
  });
  it("ignores preference changes but detects independent section, task and evidence revisions",async()=>{
    const {startup,run,state}=await ready();await store.updateStartup(startup.id,{expectedRevision:1,patch:{preferences:{theme:"light"}}});
    expect((await ai.state(startup.id)).runs[0].stale).toBe(false);
    await store.saveSection(startup.id,"pricing",{expectedRevision:0,data:{initialPrice:"Founder decision"}});
    expect((await ai.state(startup.id)).runs[0].stale).toBe(true);
    await expect(ai.apply(startup.id,run.id,specialist(state,"strategist").id,"icp")).rejects.toMatchObject({code:"AI_STALE"});
    const ws=await store.workspace(startup.id),before=revisionVector(ws,[]);const task=await store.createTask(startup.id,{title:"An interview",week:1,deliverable:"Notes"});
    expect(revisionVector(await store.workspace(startup.id),[])).not.toEqual(before);
    const input={requestId:randomUUID(),taskId:task.id,kind:"interview",observation:"Three of five buyers had a recent incident",interpretation:"supports",sampleSize:5,sourceUrl:"",method:"Screened phone interviews",observedOn:"2026-10-17",limitations:"Convenience sample"};
    const e=await ai.addEvidence(startup.id,input);expect((await ai.addEvidence(startup.id,input)).id).toBe(e.id);await expect(ai.addEvidence(startup.id,{...input,observation:"Different results using the same identifier"})).rejects.toMatchObject({code:"IDEMPOTENCY_CONFLICT"});
    expect(revisionVector(await store.workspace(startup.id),[e]).evidence).toContain(e.id);
    const other=await store.createStartup(demoProfile);await expect(ai.addEvidence(other.id,{...input,requestId:randomUUID()})).rejects.toMatchObject({status:404});
    const rows=await db.query("SELECT task_snapshot FROM ai_evidence WHERE id=$1",[e.id]);expect((rows[0].task_snapshot as Record<string,unknown>).revision).toBe(1);
  });
  it("keeps AI provenance and completed/manual work across rule regeneration and repeated plan apply",async()=>{
    const {startup,run,state}=await ready(),step=specialist(state,"experimenter");
    await store.generate(startup.id);await store.createTask(startup.id,{title:"My own task",week:2,deliverable:"A founder decision"});
    // This deliberately changes the snapshot. A fresh run is required before apply.
    await expect(ai.apply(startup.id,run.id,step.id,"roadmap")).rejects.toMatchObject({code:"AI_STALE"});
    // Prepare a reviewed run for this existing, current workspace.
    const created=await ai.create(startup.id,{mode:"experiments",brief:"Use the current tasks",requestId:randomUUID()});const next=(await ai.lease(created.id))!;
    for(const s of await ai.steps(next.id)){const result=emptyResult();if(s.role==="experimenter")result.experiments=Array.from({length:6},(_,i)=>experiment(i));await ai.startStep(next,s);await ai.completeStep(next,s,result,[]);}await ai.finish(next,"completed");
    const proposal=(await ai.steps(next.id)).find(s=>s.role==="experimenter")!;
    await ai.apply(startup.id,next.id,proposal.id,"roadmap");await ai.apply(startup.id,next.id,proposal.id,"roadmap");
    let ws=await store.workspace(startup.id);expect(ws.tasks.filter(t=>t.source==="ai")).toHaveLength(6);const aiTask=ws.tasks.find(t=>t.source==="ai")!;
    await store.updateTask(startup.id,aiTask.id,{expectedRevision:1,patch:{status:"done"}});await expect(store.generate(startup.id)).rejects.toMatchObject({code:"AI_PLAN_ACTIVE"});
    ws=await store.workspace(startup.id);ws=await store.generate(startup.id,{replaceAiPlan:true,expectedPlanId:ws.activePlan!.id});
    expect(ws.tasks.filter(t=>t.source==="ai"&&!t.archived)).toHaveLength(1);expect(ws.tasks.find(t=>t.id===aiTask.id)?.status).toBe("done");expect(ws.tasks.find(t=>t.source==="custom")?.title).toBe("My own task");
  });
  it("blocks unresolved critical recommendations and prevents cross-workspace application",async()=>{
    const {startup,run,state}=await ready();const c=specialist(state,"critic"),s=specialist(state,"strategist");const result=emptyResult();result.issues=[{severity:"blocking",target:"strategist",topic:"Unsupported promise",reason:"No evidence",correction:"Reframe as a hypothesis"}];
    await db.query("UPDATE ai_steps SET result=$2::jsonb WHERE id=$1",[c.id,JSON.stringify(result)]);
    await expect(ai.apply(startup.id,run.id,s.id,"icp")).rejects.toMatchObject({code:"AI_REVIEW_BLOCKED"});const other=await store.createStartup(demoProfile);await expect(ai.apply(other.id,run.id,s.id,"icp")).rejects.toMatchObject({status:404});
    await expect(ai.apply(startup.id,run.id,specialist(state,"experimenter").id,"roadmap")).rejects.toMatchObject({code:"AI_REVIEW_BLOCKED"});
    await expect(ai.apply(startup.id,run.id,specialist(state,"monetizer").id,"pricing")).rejects.toMatchObject({code:"AI_REVIEW_BLOCKED"});
  });
});
