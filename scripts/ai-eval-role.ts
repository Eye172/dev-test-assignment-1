/** Explicitly paid component diagnostic against existing synthetic parent artifacts.
 * Does not claim an end-to-end run and never applies a proposal. */
import OpenAI from "openai";
import { OpenAIProvider } from "@openai/agents";
import { randomUUID } from "node:crypto";
import { mkdir,writeFile } from "node:fs/promises";
import { getDatabase } from "../src/server/database";
import { AiStore } from "../src/server/ai/store";
import { executeSpecialist,safeAiError } from "../src/server/ai/runtime";
import { receiptFetch,type ProviderReceipt } from "../src/server/ai/provider-receipts";

const ceiling=Number(process.env.AI_EVAL_MAX_USD);
if(process.env.AI_ALLOW_PAID_TESTS!=="true"||!Number.isFinite(ceiling)||ceiling<=0||ceiling>7)throw new Error("Paid diagnostic not started: set AI_ALLOW_PAID_TESTS=true and AI_EVAL_MAX_USD explicitly (0 < USD <= 7).");
process.env.AI_RUN_BUDGET_USD=String(Math.min(ceiling,Number(process.env.AI_RUN_BUDGET_USD)||7));
const db=await getDatabase(),ai=new AiStore(db);
const receipts:{current:ProviderReceipt|null}={current:null};
const provider=new OpenAIProvider({openAIClient:new OpenAI({maxRetries:0,timeout:200000,fetch:receiptFetch(r=>{receipts.current=r;})}),useResponses:true});
try {
  const parentId=process.env.AI_EVAL_PARENT_RUN_ID;
  if(!parentId)throw new Error("Choose an existing synthetic parent run explicitly.");
  const [parent]=await db.query("SELECT startup_id FROM ai_runs WHERE id=$1",[parentId]);
  const startupId=String(parent.startup_id);
  const created=await ai.create(startupId,{mode:"pricing",brief:"Paid integration diagnostic for the monetization role using the already captured synthetic-case evidence. Do not conduct fresh research. Complete your assigned role concisely.",parentRunId:parentId,requestId:randomUUID()});
  const run=(await ai.lease(created.id))!,step=(await ai.steps(run.id)).find(s=>s.role==="monetizer")!;
  await ai.startStep(run,step);
  console.log(JSON.stringify({event:"role_diagnostic_started",runId:run.id,startupId,role:step.role}));
  try {await executeSpecialist(ai,run,step,provider,receipts);await ai.cancel(startupId,run.id);}
  catch(error){await ai.finish(run,"failed",safeAiError(error),step.id);process.exitCode=1;}
  await mkdir(".data/ai-evals",{recursive:true});
  await writeFile(`.data/ai-evals/${run.id}.json`,JSON.stringify(await ai.export(startupId),null,2));
  const saved=(await ai.steps(run.id)).find(s=>s.id===step.id)!;
  console.log(JSON.stringify({event:"role_diagnostic_finished",runId:run.id,status:saved.status,inputTokens:saved.inputTokens,outputTokens:saved.outputTokens,error:saved.error}));
} finally {await provider.close();await db.close();}
