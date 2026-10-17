/** Explicit, paid integration evaluation. Never runs as part of npm test or CI. */
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { getDatabase } from "../src/server/database";
import { Store } from "../src/server/store";
import { AiStore } from "../src/server/ai/store";
import { runAiJob } from "../src/server/ai/runtime";
import { demoProfile } from "../src/server/demo";
import { validatedProposal, type AiResult } from "../src/lib/domain/ai";
import { sectionKeys } from "../src/lib/domain/schemas";

async function main(){
  const ceiling=Number(process.env.AI_EVAL_MAX_USD);
  if(process.env.AI_ALLOW_PAID_TESTS!=="true"||!Number.isFinite(ceiling)||ceiling<=0||ceiling>7){console.error("Paid evaluation not started: set AI_ALLOW_PAID_TESTS=true and AI_EVAL_MAX_USD explicitly (0 < USD <= 7).");process.exitCode=1;return;}
  process.env.AI_RUN_BUDGET_USD=String(Math.min(ceiling,Number(process.env.AI_RUN_BUDGET_USD)||7));
  const db=await getDatabase(); const store=new Store(db),ai=new AiStore(db);
  try{
    const parentRunId=process.env.AI_EVAL_PARENT_RUN_ID;
    const [parent]=parentRunId?await db.query("SELECT startup_id FROM ai_runs WHERE id=$1",[parentRunId]):[];
    if(parentRunId&&!parent)throw new Error("evaluation_parent_missing");
    const startup=parent?(await store.workspace(String(parent.startup_id))).startup:await store.createStartup({...demoProfile,name:"Dispatch Note · live integration case",description:"An MVP that turns voice messages from small delivery teams into structured dispatch notes for the operations manager.",businessModel:"B2B",stage:"MVP",targetMarket:"Kazakhstan, starting in Almaty",customerSegment:"Operations managers at independent local courier teams with 5–20 drivers",context:"Synthetic evaluation case. One technical founder, 8 hours per week for sales, $300 total experiment budget. No customers, revenue or willingness-to-pay evidence. Drivers use WhatsApp and Telegram. Do not propose replacing the messaging workflow immediately.",customFields:{"Test goal":"Find 3 teams willing to join a time-bounded paid pilot. Commitment is unproven."},preferences:{...demoProfile.preferences,theme:"light"}});
    if(!(await store.workspace(startup.id)).activePlan)await store.generate(startup.id);
    const mode=process.env.AI_EVAL_MODE==="experiments"?"experiments":"full";
    const run=await ai.create(startup.id,{mode,...(parentRunId?{parentRunId}:{}),brief:process.env.AI_EVAL_BRIEF||(parentRunId?"This is a continuation of the same synthetic case. Reuse the already captured primary-source passages in the parent artifacts; no fresh web search is needed. Set freshResearch=false if no new research is performed. Preserve known gaps and do not repeat tool arithmetic. ":"")+"Research relevant alternatives and their public pricing where available. Recommend a narrow initial buyer and offer, a clearly labelled price hypothesis, and 6–10 feasible experiments for the next 30 days. Respect the $300 and 8h/week limits. Critic: reject invented proof, sales outcomes or irrelevant enterprise comparisons. Do not present Kazakhstan legal or tax assumptions as established facts.",requestId:randomUUID()});
    console.log(JSON.stringify({event:"started",startupId:startup.id,runId:run.id}));
    for(let i=0;i<12;i++){
      await runAiJob(run.id);
      const state=await ai.state(startup.id);const result=state.runs[0];
      console.log(JSON.stringify({event:"checkpoint",status:result.status,roles:result.steps.map(s=>`${s.role}:${s.round}:${s.status}`),inputTokens:result.inputTokens,outputTokens:result.outputTokens,costUsd:result.estimatedMicros/1e6,sources:result.sources.length,error:result.error}));
      if(!["queued","running","paused"].includes(result.status)){
        await mkdir(".data/ai-evals",{recursive:true});await writeFile(`.data/ai-evals/${run.id}.json`,JSON.stringify(await ai.export(startup.id),null,2));
        if(!["completed","needs_attention"].includes(result.status))throw new Error("live_run_did_not_complete");
        const latest=(role:string)=>result.steps.filter(s=>s.role===role&&s.status==="completed").at(-1)!;
        const [frozen]=await db.query("SELECT input_snapshot FROM ai_runs WHERE id=$1",[run.id]);
        const inherited=(frozen.input_snapshot as {parent:{role:string;result:AiResult}[]}).parent;
        const proposals=sectionKeys.map(key=>{const role=key==="pricing"?"monetizer":"strategist",proposal=latest(role)?.result||inherited.find(p=>p.role===role)?.result;return {key,valid:!!proposal&&!!validatedProposal(key,proposal),inherited:!latest(role)};});
        const experiments=latest("experimenter").result!.experiments;
        const report={startupId:startup.id,runId:run.id,status:result.status,proposals,experiments:experiments.length,sources:result.sources.length,costUsd:result.estimatedMicros/1e6,issues:latest("critic").result!.issues};
        console.log(JSON.stringify({event:"evaluation",...report}));
        await writeFile(".data/ai-evals/latest.json",JSON.stringify(report,null,2));
        if(proposals.some(p=>!p.valid)||experiments.length<6||!result.sources.length)throw new Error("live_quality_contract_failed");
        return;
      }
    }
    throw new Error("checkpoint_limit");
  }finally{await db.close();}
}
main().catch(()=>{console.error("Live AI evaluation failed. Inspect its persisted, access-controlled run; no provider error or secret was logged.");process.exitCode=1;});
