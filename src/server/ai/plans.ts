import "server-only";
import { randomUUID } from "node:crypto";
import { planSelectionSchema, reviewedExperiments, type PlanPreview, type PlanSelection } from "@/lib/domain/analysis";
import type { AiResult } from "@/lib/domain/ai";
import type { Workspace } from "@/lib/domain/types";
import type { SqlExecutor } from "../database";
import { fingerprint } from "./identity";

export function buildPlanPreview(workspace:Workspace,result:AiResult,input?:PlanSelection):PlanPreview {
  const active=workspace.tasks.filter(t=>!t.archived);
  const candidates=active.filter(t=>t.status==="todo"&&!t.edited&&t.source!=="custom").map(t=>t.id);
  const selection=planSelectionSchema.parse(input||{retireTaskIds:candidates,retainedEstimates:[],limits:result.analysis?.planLimits||{weeklyMinutes:null,budgets:[],basis:"Resource limits were not supplied by the legacy artifact.",confirmed:false},acknowledgeUnknowns:false});
  const blockers:string[]=[],unknowns:string[]=[];
  const experiments=reviewedExperiments(result,selection);
  for(const e of experiments)for(const id of e.contract?.existingTaskIds||[]){
    const old=workspace.tasks.find(t=>t.id===id);
    if(old?.status==="done"||old&&!old.archived&&!selection.retireTaskIds.includes(id))blockers.push(`${e.title}: overlapping existing work must be reconciled; completed experiments cannot be repeated as new evidence.`);
  }
  if(new Set(selection.experimentEdits.map(e=>e.key)).size!==selection.experimentEdits.length)blockers.push("An experiment has competing edits.");
  for(const edit of selection.experimentEdits)if(!result.experiments.some(e=>e.contract?.key===edit.key))blockers.push("An edit references an absent experiment.");
  if(new Set(selection.retireTaskIds).size!==selection.retireTaskIds.length)blockers.push("A task is selected for retirement more than once.");
  if(new Set(selection.retainedEstimates.map(x=>x.taskId)).size!==selection.retainedEstimates.length)blockers.push("A retained task has competing estimates.");
  for(const id of selection.retireTaskIds){const t=active.find(t=>t.id===id);if(!t)blockers.push("A selected task is no longer active.");else if(t.status==="done")blockers.push("Completed work must remain preserved; archive it separately if needed.");}
  for(const e of selection.retainedEstimates)if(!active.some(t=>t.id===e.taskId&&!selection.retireTaskIds.includes(t.id)))blockers.push("An estimate references a task that is not being retained.");
  const weeks=[1,2,3,4].map(week=>({week,minutes:selection.weeklyReserves[week-1],unknownTasks:[] as string[]}));
  const amounts=new Map<string,number>();
  const add=(week:number,title:string,minutes:number|null,costs:{currency:string;amount:number|null}[])=>{
    const bucket=weeks[week-1];if(minutes===null)bucket.unknownTasks.push(title);else bucket.minutes+=minutes;
    for(const cost of costs){if(cost.amount===null)unknowns.push(`${title}: ${cost.currency} spending is unknown.`);else amounts.set(cost.currency,(amounts.get(cost.currency)||0)+cost.amount);}
  };
  for(const e of experiments){add(e.week,e.title,e.contract?.effortMinutes??null,e.contract?.costs||[]);const day=e.contract?.measurement.deadlineDay;if(day!==undefined&&(day<(e.week-1)*7+1||day>(e.week===4?30:e.week*7)))blockers.push(`${e.title}: the deadline must remain within the assigned week.`);}
  for(const t of active.filter(t=>!selection.retireTaskIds.includes(t.id)&&["todo","in_progress"].includes(t.status))){
    const override=selection.retainedEstimates.find(e=>e.taskId===t.id);
    add(t.week,t.title,override?override.effortMinutes:(!t.edited?t.experiment?.effortMinutes??null:null),override?.costs||(!t.edited?t.experiment?.costs||[]:[]));
    if(!override&&(t.edited||!t.experiment))unknowns.push(`${t.title}: retained-work cash costs have not been reviewed.`);
  }
  if(!selection.limits.confirmed)unknowns.push("The combined work/cash allocation is provisional and needs founder confirmation.");
  if(selection.limits.weeklyMinutes===null)unknowns.push("Weekly capacity is unknown.");
  for(const w of weeks){
    if(w.unknownTasks.length)unknowns.push(`Week ${w.week}: ${w.unknownTasks.length} tasks have no effort estimate.`);
    if(selection.limits.weeklyMinutes!==null&&w.minutes>selection.limits.weeklyMinutes)blockers.push(`Week ${w.week} needs ${w.minutes} minutes; capacity is ${selection.limits.weeklyMinutes}.`);
  }
  const budgets=new Map<string,number|null>();for(const b of selection.limits.budgets){if(budgets.has(b.currency))blockers.push(`Use one total budget for ${b.currency}.`);budgets.set(b.currency,b.amount);}
  const spending=[...amounts].map(([currency,amount])=>({currency,amount,limit:budgets.get(currency)??null}));
  for(const s of spending){if(s.limit===null)unknowns.push(`No confirmed spending ceiling for ${s.currency}.`);else if(s.amount>s.limit+1e-8)blockers.push(`${s.currency} spending ${s.amount} exceeds the ${s.limit} budget.`);}
  for(const e of experiments)for(const dep of e.contract?.dependsOn||[]){const previous=experiments.find(x=>x.contract?.key===dep);if(!previous)blockers.push(`${e.title}: an experiment dependency is missing.`);else if(previous.week>e.week||previous.contract!.measurement.deadlineDay>e.contract!.measurement.deadlineDay)blockers.push(`${e.title}: dependency is scheduled after this experiment.`);}
  const hash=fingerprint({workspace:{profileRevision:workspace.startup.revision,tasks:workspace.tasks.map(t=>[t.id,t.revision]),sections:workspace.sections.map(s=>[s.key,s.revision])},result,selection});
  return {hash,selection,retireCandidates:candidates,protectedTaskIds:active.filter(t=>!candidates.includes(t.id)).map(t=>t.id),weeks,spending,blockers,unknowns:[...new Set(unknowns)],ready:!blockers.length&&(!unknowns.length||selection.acknowledgeUnknowns)};
}
export async function applyExperimentPlan(tx:SqlExecutor,startupId:string,runId:string,stepId:string,workspace:Workspace,result:AiResult,preview:PlanPreview){
  const planId=randomUUID();
  await tx.query("UPDATE ai_plans SET status='superseded' WHERE startup_id=$1 AND status='active'",[startupId]);
  await tx.query("INSERT INTO ai_plans(id,startup_id,run_id,step_id,status,selection,preview) VALUES($1,$2,$3,$4,'active',$5::jsonb,$6::jsonb)",[planId,startupId,runId,stepId,JSON.stringify(preview.selection),JSON.stringify(preview)]);
  for(const id of preview.selection.retireTaskIds)await tx.query("UPDATE roadmap_tasks SET archived=true,superseded_by_plan=$3,revision=revision+1,updated_at=now() WHERE id=$1 AND startup_id=$2",[id,startupId,planId]);
  for(const [index,e] of reviewedExperiments(result,preview.selection).entries()){
    const id=randomUUID();
    const criteria=e.contract?`Success: ${e.contract.measurement.success}\nFailure: ${e.contract.measurement.failure}\nInconclusive: ${e.contract.measurement.inconclusive}\nDeadline: day ${e.contract.measurement.deadlineDay}`:`Decision threshold: ${e.threshold}`;
    await tx.query("INSERT INTO roadmap_tasks(id,startup_id,rule_key,title,deliverable,rationale,week,notes,source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'ai')",[id,startupId,`ai:${stepId}:${index}`,e.title,e.deliverable,e.rationale,e.week,`Hypothesis: ${e.hypothesis}\nMethod: ${e.method}\nMetric: ${e.metric}\n${criteria}\nEffort: ${e.effort}\nDependencies: ${(e.contract?.dependsOn||e.dependencies).join(", ")||"None"}`]);
    if(e.contract)await tx.query("INSERT INTO ai_experiments(task_id,plan_id,proposal_key,contract) VALUES($1,$2,$3,$4::jsonb)",[id,planId,e.contract.key,JSON.stringify(e.contract)]);
  }
  // Explicit estimates for preserved work belong to this plan's audit trail, not its editable notes.
  void workspace;
}
