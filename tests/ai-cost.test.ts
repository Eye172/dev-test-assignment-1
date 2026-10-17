import { afterAll,beforeAll,describe,expect,it,vi } from "vitest";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { Agent,OpenAIProvider,Runner } from "@openai/agents";
import { z } from "zod";
import { createDatabase,type Database } from "@/server/database";
import { Store } from "@/server/store";
import { AiStore } from "@/server/ai/store";
import { demoProfile,demoStrategy } from "@/server/demo";
import { aiConfig,estimatedCost } from "@/server/ai/config";
import { executionConfig } from "@/server/ai/prompts";
import { runAiJob,specialistModelSettings } from "@/server/ai/runtime";
import { compactIntakeContext } from "@/server/ai/context";
import { aiRoles,aiResultSchema,type AiResult } from "@/lib/domain/ai";

const holder=vi.hoisted(()=>({db:null as Database|null}));
vi.mock("@/server/database",async importOriginal=>({...await importOriginal<typeof import("@/server/database")>(),getDatabase:async()=>holder.db!}));
let db:Database,ai:AiStore,store:Store;
beforeAll(async()=>{
  vi.stubEnv("OPENAI_API_KEY","offline-cost-fixture");vi.stubEnv("AI_ACCESS_CODE","offline-cost-owner");
  vi.stubEnv("OPENAI_MODEL","gpt-6.1-sol");vi.stubEnv("OPENAI_CRITIC_MODEL","");vi.stubEnv("AI_AUTO_REPAIR","false");
  db=await createDatabase(process.env.TEST_DATABASE_URL||"memory://");holder.db=db;ai=new AiStore(db);store=new Store(db);
});
afterAll(async()=>{await db.close();vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();});

describe("AI cost controls without live provider calls",()=>{
  it("keeps a bounded first-pass output allowance and an explicit premium-model override",()=>{
    expect(aiConfig().criticModel).toBe("gpt-6.1-sol");
    const cap=aiRoles.reduce((sum,role)=>sum+estimatedCost("gpt-6.1-sol",0,executionConfig(role).maxTokens),0);
    expect(cap).toBeLessThanOrEqual(600000); // One response per role, excluding input/tools.
    const firstPass=aiRoles.reduce((sum,role)=>sum+estimatedCost("gpt-6.1-sol",0,executionConfig(role).maxTokens)*executionConfig(role).maxTurns,0);
    expect(firstPass).toBeLessThanOrEqual(1500000); // Includes every allowed tool-loop response; no automatic repair.
    expect(executionConfig("experimenter").maxTokens).toBeGreaterThanOrEqual(8000);
    expect(executionConfig("researcher")).toMatchObject({webSearchCalls:3,maxSourceCaptures:5,searchContextSize:"low",retries:0});
    vi.stubEnv("OPENAI_CRITIC_MODEL","gpt-6-astra");expect(aiConfig().criticModel).toBe("gpt-6-astra");vi.stubEnv("OPENAI_CRITIC_MODEL","");
  });
  it("freezes automatic-repair consent in the saved execution settings",async()=>{
    const startup=await store.createStartup(demoProfile);
    const run=await ai.create(startup.id,{mode:"full",brief:"Synthetic cost-control fixture",requestId:randomUUID()});
    const steps=await ai.steps(run.id);
    vi.stubEnv("AI_AUTO_REPAIR","true");
    expect((await ai.execution(steps[0])).settings.autoRepair).toBe(false);
    expect(steps.every(s=>s.model==="gpt-6.1-sol")).toBe(true);
    await ai.cancel(startup.id,run.id);vi.stubEnv("AI_AUTO_REPAIR","false");
  });
  it("stops after the first critique with visible issues instead of buying a repair round",async()=>{
    const startup=await store.createStartup(demoProfile);
    const created=await ai.create(startup.id,{mode:"full",brief:"Synthetic first-pass review fixture",requestId:randomUUID()});
    const run=(await ai.lease(created.id))!;
    for(const step of await ai.steps(run.id)){
      const result:AiResult=aiResultSchema.parse({title:"Offline specialist fixture",summary:"Synthetic contract fixture",claims:[],recommendations:[],questions:[],strategy:{icp:null,value:null,channels:null,pricing:null,assumptions:null},experiments:[],issues:step.role==="critic"?[{severity:"material",target:"strategist",topic:"Unverified access",reason:"Buyer access is unconfirmed",correction:"Review the buyer-access assumption"}]:[]});
      if(step.role==="strategist")result.strategy=aiResultSchema.shape.strategy.parse({...result.strategy,icp:demoStrategy.icp,value:demoStrategy.value,channels:demoStrategy.channels,assumptions:demoStrategy.assumptions});
      if(step.role==="monetizer")result.strategy.pricing=demoStrategy.pricing as AiResult["strategy"]["pricing"];
      await ai.startStep(run,step);await ai.completeStep(run,step,result,[]);
    }
    await ai.finish(run,"paused");
    const network=vi.fn(()=>Promise.reject(new Error("No live requests permitted")));vi.stubGlobal("fetch",network);
    await runAiJob(run.id);
    const state=await ai.state(startup.id),saved=state.runs.find(r=>r.id===run.id)!;
    expect(saved.status).toBe("needs_attention");expect(saved.steps).toHaveLength(6);
    expect(saved.steps.every(s=>s.round===0&&s.status==="completed")).toBe(true);
    expect(saved.steps.find(s=>s.role==="critic")?.result?.issues[0].topic).toBe("Unverified access");
    expect(network).not.toHaveBeenCalled();vi.unstubAllGlobals();
  });
  it("removes repeated question UI hints while preserving facts, unknowns and the raw snapshot",()=>{
    const raw={draft:{price:"GBP49/month",outcome:""},uncertainties:["No churn evidence"],questions:[{key:"retention",field:"context",text:"Why do the three current clients pay?",why:"UI explanation",placeholder:"UI hint",options:["Unknown"]}]};
    const compact=compactIntakeContext(raw) as typeof raw;
    expect(compact.draft).toEqual(raw.draft);expect(compact.uncertainties).toEqual(raw.uncertainties);
    expect(compact.questions[0]).toMatchObject({key:"retention",field:"context",text:raw.questions[0].text,options:["Unknown"]});
    expect(compact.questions[0]).not.toHaveProperty("why");expect(compact.questions[0]).not.toHaveProperty("placeholder");
    expect(raw.questions[0].why).toBe("UI explanation");
  });
  it("sends Standard tier and bounded tokens through the actual SDK request adapter",async()=>{
    let body:Record<string,unknown>|undefined;
    const network=(async(_url:unknown,init?:RequestInit)=>{
      body=JSON.parse(String(init?.body));
      return new Response(JSON.stringify({id:"resp_offline",object:"response",created_at:1,status:"completed",model:"gpt-6.1-sol",output:[{id:"msg_offline",type:"message",role:"assistant",status:"completed",content:[{type:"output_text",annotations:[],text:'{"ok":true}'}]}],usage:{input_tokens:10,output_tokens:5,total_tokens:15}}),{headers:{"content-type":"application/json"}});
    }) as typeof fetch;
    const provider=new OpenAIProvider({openAIClient:new OpenAI({apiKey:"offline-fixture",maxRetries:0,fetch:network}),useResponses:true});
    try{
      const agent=new Agent({name:"Offline cost boundary",model:"gpt-6.1-sol",instructions:"Synthetic request",outputType:z.object({ok:z.boolean()}),modelSettings:specialistModelSettings("critic",executionConfig("critic"))});
      const output=await new Runner({modelProvider:provider,tracingDisabled:true}).run(agent,"Offline fixture",{maxTurns:1});
      expect(output.finalOutput).toEqual({ok:true});
      expect(body).toMatchObject({service_tier:"default",max_output_tokens:8000,reasoning:{effort:"low"},store:false});
    }finally{await provider.close();}
  });
});
