import { randomUUID } from "node:crypto";
import type { Database } from "@/server/database";
import { Store } from "@/server/store";
import { AiStore } from "@/server/ai/store";
import { demoProfile, demoStrategy } from "@/server/demo";
import { aiResultSchema, type AiResult } from "@/lib/domain/ai";
import { analysisSchema, type SourcePage } from "@/lib/domain/analysis";
import { executionInput } from "@/server/ai/context";
import { fingerprint } from "@/server/ai/identity";
const analysis=()=>analysisSchema.parse({version:2,findings:[],research:null,hypotheses:[],decisions:[],planLimits:null,resolutions:[],sourceChecks:[]});
export const result=():AiResult=>aiResultSchema.parse({title:"Synthetic case evaluation fixture",summary:"Offline contract fixture, not market evidence",claims:[],recommendations:[],questions:[],strategy:{icp:null,value:null,channels:null,pricing:null,assumptions:null},experiments:[],issues:[],analysis:analysis()});
export const hypothesis=(key:string)=>({id:null,key,statement:`A screened buyer experiences recurring workflow ${key}`,risk:"high" as const,rationale:"A case-specific hypothesis, not observed demand",reviewWhen:"Revise after screened observations contradict the workflow",findingRefs:[],evidenceIds:[]});
const decision=()=>({id:null,key:"segment",question:"Which initial workflow should we test?",options:[{key:"narrow",label:"Repeated separate-record work",benefits:["Observable work to compare"],drawbacks:["Potentially difficult to reach"],findingRefs:[]},{key:"broad",label:"All messenger users",benefits:["More contacts"],drawbacks:["May have no separate recordkeeping need"],findingRefs:[]}],selectedOption:"narrow",rationale:"Prioritize an observable job before price testing",counterargument:"The qualifying workflow may be uncommon",reopenWhen:"Screened observations fail to find recurring work",hypothesisRefs:["h1"],findingRefs:[],evidenceIds:[]});
const experiments=(hypothesisId:string,decisionId:string)=>Array.from({length:6},(_,i)=>({title:`Observe workflow decision ${i+1}`,week:Math.min(4,Math.floor(i/2)+1),deliverable:"Screened observations with a recorded next decision",rationale:"Challenge the actual buyer workflow",hypothesis:"The named workflow recurs",method:"Observe a recent example without leading questions",metric:"Recent demonstrated workflows",threshold:"Three of five cases; short coverage is inconclusive",effort:"30 founder minutes",dependencies:i?[`e${i}`]:[],contract:{key:`e${i+1}`,hypothesisRefs:[hypothesisId],decisionRefs:[decisionId],dependsOn:i?[`e${i}`]:[],effortMinutes:30,costs:[{currency:"USD",amount:5}],measurement:{unit:"screened cases",minimumSample:5,success:"Three demonstrate recurring work; continue comparison",failure:"Five screened and fewer than three qualify; revise segment",inconclusive:"Fewer than five screened; do not infer price rejection",deadlineDay:Math.min(28,(Math.floor(i/2)+1)*7)},assumptions:["Convenience samples do not establish market prevalence"],existingTaskIds:[]}}));

export async function seedAnalysisCase(db:Database,options:{unsupported?:boolean;custom?:boolean;badPassage?:boolean}={}){
  const store=new Store(db),ai=new AiStore(db);
  const startup=await store.createStartup({...demoProfile,name:`Synthetic evidence fixture ${randomUUID().slice(0,6)}`,context:"Four total founder hours weekly, $50 experiment budget. No customer validation."});
  await store.generate(startup.id);
  const custom=options.custom?await store.createTask(startup.id,{title:"Founder-owned visit",deliverable:"A recent-work observation",week:1}):null;
  const created=await ai.create(startup.id,{mode:"full",brief:"Case-specific offline fixture; preserve the current work and confirm references",requestId:randomUUID()});
  const run=(await ai.lease(created.id))!;
  let captured:SourcePage|undefined;
  for(const role of ["intake","researcher","strategist","monetizer","experimenter","critic"] as const){
    const step=(await ai.steps(run.id)).find(s=>s.role===role)!;
    await ai.startStep(run,step);
    const preceding=(await ai.steps(run.id)).filter(s=>s.status==="completed");
    await ai.saveInput(run,step,await executionInput(ai,run,step,preceding));
    const r=result(),a=r.analysis!;
    if(role==="researcher"){
      const id=randomUUID(),text="Synthetic vendor price: USD 12 per account per month, billed annually upfront. No claim about courier outcomes.";
      captured={id,runId:run.id,url:"https://example.com/synthetic-pricing",title:"Synthetic pricing fixture",accessedAt:new Date().toISOString(),contentHash:fingerprint(text),status:"captured",limitation:"Fixture, not actual vendor research",passages:[{id:`${id}:p1`,text}]};
      await ai.capture(run,step,captured);
      a.findings=[{id:null,key:"price",statement:"Synthetic vendor advertises USD 12 per account/month with annual upfront billing",kind:"source_reported",passageIds:[options.badPassage?`${randomUUID()}:p1`:captured.passages[0].id],evidenceIds:[],limitation:"List price is not willingness to pay"}];
      a.research={question:"Does a separate record add value beyond current work?",scope:"Synthetic workflow only",axes:[{key:"workflow",label:"Work preserved",why:"Avoid unnecessary adoption"},{key:"output",label:"Required output",why:"Compare usable records, not feature counts"}],alternatives:[{key:"idea",name:"Our synthetic idea",category:"idea",buyer:"Manager",job:"Produce checked records",workflow:"Proposed assisted output",switchingCosts:"Extra transfer step",pricing:{description:"Untested",currency:null,amount:null,unit:null,period:null,conditions:"No tested offer",findingRefs:[]},findingRefs:[],relevance:"Founder proposal"},{key:"manual",name:"Current chat",category:"manual",buyer:"Same manager",job:"Keep operations moving",workflow:"Current messenger",switchingCosts:"No change",pricing:{description:"Unmeasured existing effort",currency:null,amount:null,unit:null,period:null,conditions:"No measured time baseline",findingRefs:[]},findingRefs:[],relevance:"Default alternative"}],cells:[{alternativeKey:"idea",axisKey:"workflow",value:"Proposed existing chat retained",basis:"inferred",findingRefs:[],limitation:"Not observed"},{alternativeKey:"idea",axisKey:"output",value:"Checked fields",basis:"inferred",findingRefs:[],limitation:"Untested"},{alternativeKey:"manual",axisKey:"workflow",value:"Current chat",basis:"inferred",findingRefs:[],limitation:"Synthetic brief"},{alternativeKey:"manual",axisKey:"output",value:"Unknown record need",basis:"unknown",findingRefs:[],limitation:"Observe the buyer"}],ideaAdvantages:[{statement:"Potentially useful checked fields",findingRefs:[],test:"Observe correction time"}],ideaDisadvantages:[{statement:"Extra handoff may outweigh value",findingRefs:[],test:"Compare the full workflow"}],coverage:{searchedFor:["Synthetic contract"],exclusions:["No real market scan"],gaps:["No customer outcomes"],stopReason:"Offline test fixture",freshResearch:false},nextChecks:["Observe a recent workflow"]};
    }
    if(role==="strategist"){
      Object.assign(r.strategy,{icp:demoStrategy.icp,value:demoStrategy.value,channels:demoStrategy.channels,assumptions:demoStrategy.assumptions});
      a.hypotheses=[hypothesis("h1"),hypothesis("h2"),hypothesis("h3")];a.decisions=[decision()];
    }
    if(role==="monetizer")r.strategy.pricing=demoStrategy.pricing;
    if(role==="experimenter"){
      const memory=await ai.analysis.memory(startup.id);
      r.experiments=experiments(memory.find(m=>m.data.kind==="hypothesis")!.id,memory.find(m=>m.data.kind==="decision")!.id);
      a.planLimits={weeklyMinutes:240,budgets:[{currency:"USD",amount:50}],basis:"Explicit combined-work and cash limits in the synthetic brief",confirmed:true};
    }
    if(role==="critic")a.sourceChecks=(await ai.analysis.findings(startup.id)).filter(f=>f.runId===run.id).map(f=>({findingId:f.id!,outcome:options.unsupported?"does_not_support":"supports",reason:options.unsupported?"The passage does not establish the asserted outcome":"The synthetic passage states the exact currency, unit and annual condition"}));
    await ai.completeStep(run,step,r,captured&&role==="researcher"?[{url:captured.url,title:captured.title,accessedAt:captured.accessedAt,method:"open_page"}]:[]);
  }
  await ai.finish(run,options.unsupported||options.badPassage?"needs_attention":"completed");
  const steps=await ai.steps(run.id);
  return {startup,run,steps,custom,captured:captured!,specialist:(role:string)=>steps.find(s=>s.role===role)!};
}
