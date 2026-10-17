import { describe, expect, it } from "vitest";
import { memoryDraftSchema, planDraftSchema } from "@/lib/domain/analysis-drafts";
import { memoryDataSchema, planSelectionSchema, reviewedExperiments, experimentContractSchema } from "@/lib/domain/analysis";
import { receiptFetch, type ProviderReceipt } from "@/server/ai/provider-receipts";
import { hypothesis, result } from "./fixtures/analysis-case";

describe("unfinished analysis drafts and provider receipts",()=>{
  it("restores unfinished memory without relaxing the save contract",()=>{
    const draft={kind:"hypothesis",proposal:{...hypothesis("draft"),statement:"",rationale:"",reviewWhen:""}};
    expect(memoryDraftSchema.parse(draft)).toEqual(draft);
    expect(memoryDataSchema.safeParse(draft).success).toBe(false);
    expect(memoryDraftSchema.safeParse({...draft,kind:"other"}).success).toBe(false);
  });
  it("restores blank budgets, scope and temporarily invalid numeric edits",()=>{
    const draft={retireTaskIds:[],retainedEstimates:[],limits:{weeklyMinutes:0,budgets:[{currency:"",amount:null}],basis:"",confirmed:false},acknowledgeUnknowns:false,experimentEdits:[{key:"e1",title:"",week:0,reason:""}]};
    expect(planDraftSchema.parse(draft)).toEqual(draft);
    expect(planSelectionSchema.safeParse(draft).success).toBe(false);
  });
  it("preserves the experiment assumption bound when recording founder revisions",()=>{
    const r=result();r.experiments=[{title:"Original task",deliverable:"Observe five recent cases",rationale:"Test the workflow",week:1,hypothesis:"This workflow recurs",method:"Observe examples",metric:"Cases",threshold:"Three of five",effort:"30 minutes",dependencies:[],contract:{key:"e1",hypothesisRefs:[],decisionRefs:[],dependsOn:[],effortMinutes:30,costs:[],measurement:{unit:"cases",minimumSample:5,success:"Three qualify",failure:"Five screened; fewer than three qualify",inconclusive:"Fewer than five screened",deadlineDay:7},assumptions:Array.from({length:6},(_,i)=>`Explicit assumption ${i}`),existingTaskIds:[]}}];
    const selection=planSelectionSchema.parse({retireTaskIds:[],retainedEstimates:[],limits:{weeklyMinutes:120,budgets:[],basis:"Founder estimate",confirmed:true},acknowledgeUnknowns:false,experimentEdits:[{key:"e1",title:"Founder-scoped task",reason:"Narrow the audience"}]});
    const edited=reviewedExperiments(r,selection)[0];
    expect(edited.title).toBe("Founder-scoped task");expect(experimentContractSchema.parse(edited.contract).assumptions).toHaveLength(6);
    expect(r.experiments[0].title).toBe("Original task");
  });
  it("retains reported usage from an incomplete response without retaining model content",async()=>{
    const receipts:ProviderReceipt[]=[];
    const network=(async()=>new Response(JSON.stringify({id:"resp_fixture",status:"incomplete",incomplete_details:{reason:"max_output_tokens"},output:[{type:"reasoning",content:"Private model content"}],usage:{input_tokens:123,output_tokens:8000,output_tokens_details:{reasoning_tokens:7900}}}),{headers:{"content-type":"application/json"}})) as typeof fetch;
    const response=await receiptFetch(r=>receipts.push(r),network)("https://api.openai.com/v1/responses",{method:"POST"});
    expect(receipts).toEqual([{id:"resp_fixture",status:"incomplete",reason:"max_output_tokens",inputTokens:123,outputTokens:8000,reasoningTokens:7900,webSearchCalls:0}]);
    expect(JSON.stringify(receipts)).not.toContain("Private model content");expect((await response.json()).status).toBe("incomplete");
  });
});
