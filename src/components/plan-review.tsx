"use client";
import { useAnalysisCopy } from "@/ui/use-analysis-copy";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import type { AiStep } from "@/lib/domain/ai";
import { type PlanPreview, type PlanSelection } from "@/lib/domain/analysis";
import { planDraftSchema } from "@/lib/domain/analysis-drafts";
import type { Workspace } from "@/lib/domain/types";
import { ErrorNotice, Field, Spinner, useDirtyGuard } from "./ui";
import { useDraftRecovery } from "./draft-recovery";

export function PlanReview({endpoint,runId,step,workspace,onPreview,busy}:{endpoint:string;runId:string;step:AiStep;workspace:Workspace;onPreview:(preview:PlanPreview|null)=>void;busy:boolean}){
  const copy=useAnalysisCopy();
  const [selection,setSelection]=useState<PlanSelection|null>(null),[preview,setPreview]=useState<PlanPreview|null>(null),[error,setError]=useState<Error|null>(null),[loading,setLoading]=useState(true);
  const [touched,setTouched]=useState(false);
  useDirtyGuard(touched);
  useDraftRecovery(`plan-review:${runId}:${step.id}`,selection,touched,value=>{setSelection(planDraftSchema.parse(value));setTouched(true);});
  const signature=JSON.stringify(selection);
  useEffect(()=>{
    let live=true;
    onPreview(null);
    const timer=setTimeout(()=>{
      void api<PlanPreview>(endpoint,{method:"POST",body:JSON.stringify({action:"preview_plan",runId,stepId:step.id,...(selection?{selection}:{})})}).then(data=>{if(live){setPreview(data);if(!selection)setSelection(data.selection);onPreview({...data,selection:selection||data.selection});setLoading(false);setError(null);}}).catch(e=>{if(live){setError(e);setLoading(false);}});
    },selection?300:0);
    return()=>{live=false;clearTimeout(timer);};
  },[endpoint,runId,step.id,signature,onPreview]); // eslint-disable-line react-hooks/exhaustive-deps
  const change=(next:PlanSelection)=>{setSelection(next);setTouched(true);setLoading(true);onPreview(null);};
  const edit=(key:string,patch:Partial<PlanSelection["experimentEdits"][number]>)=>{
    if(!selection)return;
    const old=selection.experimentEdits.find(e=>e.key===key);
    const value={...old,key,reason:old?.reason||"Founder adjusted the proposed experiment before accepting it.",...patch};
    change({...selection,experimentEdits:[...selection.experimentEdits.filter(e=>e.key!==key),value]});
  };
  return <fieldset className="plan-review" disabled={busy}>
    <p className="info-notice">{copy("Review a single active plan. Retired suggestions stay in history. Completed work stays preserved; your custom, edited and in-progress work is retained unless you explicitly retire it here.")}</p>
    <ErrorNotice error={error}/>{loading&&<p role="status"><Spinner/>{copy("Checking this selection…")}</p>}
    {selection&&<>
      <fieldset className="plan-limits"><legend>{copy("Your work and cash limits")}</legend><Field name="plan-minutes" label={copy("Combined work capacity per week (minutes)")} type="number" value={selection.limits.weeklyMinutes?.toString()||""} onChange={v=>change({...selection,limits:{...selection.limits,weeklyMinutes:v?Number(v):null}})}/>
        <Field name="plan-resource-basis" label={copy("Basis for these limits")} textarea value={selection.limits.basis} onChange={v=>change({...selection,limits:{...selection.limits,basis:v}})}/>
        <p className="field-help">{copy("Additional weekly work not included in task estimates: delivery, support or other commitments. Enter minutes once; do not double-count work already in a task.")}</p>
        <div className="plan-week-totals">{selection.weeklyReserves.map((minutes,i)=><Field key={i} name={`plan-reserve-${i+1}`} label={copy(`Week ${i+1} extra minutes`)} type="number" value={String(minutes)} onChange={v=>change({...selection,weeklyReserves:selection.weeklyReserves.map((n,j)=>j===i?Number(v):n)})}/>)}</div>
        {selection.limits.budgets.map((b,i)=><div className="analysis-two-columns plan-budget-row" key={i}><Field name={`plan-currency-${i}`} label={copy("Budget currency")} className="analysis-currency" value={b.currency} maxLength={3} onChange={v=>change({...selection,limits:{...selection.limits,budgets:selection.limits.budgets.map((x,j)=>j===i?{...x,currency:v.toUpperCase()}:x)}})}/><Field name={`plan-budget-${i}`} label={copy("Total cash budget")} type="number" value={b.amount?.toString()??""} onChange={v=>change({...selection,limits:{...selection.limits,budgets:selection.limits.budgets.map((x,j)=>j===i?{...x,amount:v?Number(v):null}:x)}})}/><button type="button" className="button small ghost" aria-label={`${copy("Remove budget")} ${b.currency}`} onClick={()=>change({...selection,limits:{...selection.limits,budgets:selection.limits.budgets.filter((_,j)=>j!==i)}})}>{copy("Remove budget")}</button></div>)}
        <button type="button" className="button small ghost" disabled={selection.limits.budgets.length>=5} onClick={()=>change({...selection,limits:{...selection.limits,budgets:[...selection.limits.budgets,{currency:"USD",amount:null}]}})}>{copy("Add currency budget")}</button>
        <label className="plan-checkbox"><input type="checkbox" checked={selection.limits.confirmed} onChange={e=>change({...selection,limits:{...selection.limits,confirmed:e.target.checked}})}/>{copy("I confirm this allocation covers the proposed work, including delivery and support.")}</label>
      </fieldset>
      <details open><summary>{copy("Reconcile existing work")}</summary><div className="plan-existing-work">{workspace.tasks.filter(t=>!t.archived).map(t=>{
        const retiring=selection.retireTaskIds.includes(t.id),estimate=selection.retainedEstimates.find(x=>x.taskId===t.id);
        const costs=estimate?.costs||t.experiment?.costs||[{currency:selection.limits.budgets[0]?.currency||"USD",amount:null}];
        const remaining=estimate?estimate.effortMinutes:!t.edited?t.experiment?.effortMinutes??null:null;
        const estimateWork=(patch:Partial<PlanSelection["retainedEstimates"][number]>)=>change({...selection,retainedEstimates:[...selection.retainedEstimates.filter(x=>x.taskId!==t.id),{taskId:t.id,effortMinutes:remaining,costs,...patch}]});
        return <div key={t.id} className="plan-existing-task"><label className="plan-checkbox"><input type="checkbox" disabled={t.status==="done"} checked={retiring} onChange={e=>change({...selection,retireTaskIds:e.target.checked?[...selection.retireTaskIds,t.id]:selection.retireTaskIds.filter(id=>id!==t.id),retainedEstimates:selection.retainedEstimates.filter(x=>x.taskId!==t.id)})}/><span>{copy("Retire “")}{t.title}”<small>{copy("Week")} {t.week} · {t.source} · {t.status}{t.edited?" · edited":""}{t.status==="done"?" · preserved":""}</small></span></label>
        {!retiring&&["todo","in_progress"].includes(t.status)&&<Field name={`retained-minutes-${t.id}`} label={`Remaining minutes for ${t.title}`} type="number" value={(estimate?estimate.effortMinutes:!t.edited?t.experiment?.effortMinutes:null)?.toString()??""} onChange={v=>estimateWork({effortMinutes:v?Number(v):null})}/>}
        {!retiring&&["todo","in_progress"].includes(t.status)&&<div className="plan-retained-cash">{costs.map((cost,i)=><div className="analysis-two-columns" key={i}><Field name={`retained-currency-${t.id}-${i}`} label={`Cash currency for ${t.title}`} value={cost.currency} maxLength={3} onChange={v=>estimateWork({costs:costs.map((x,j)=>j===i?{...x,currency:v.toUpperCase()}:x)})}/><Field name={`retained-cash-${t.id}-${i}`} label={`Remaining ${cost.currency||"unknown currency"} cash for ${t.title}`} type="number" value={cost.amount?.toString()??""} onChange={v=>estimateWork({costs:costs.map((x,j)=>j===i?{...x,amount:v?Number(v):null}:x)})}/></div>)}<button type="button" className="button small ghost" onClick={()=>estimateWork({costs:costs.length?[]:[{currency:selection.limits.budgets[0]?.currency||"USD",amount:null}]})}>{costs.length?"Confirm no remaining cash outlay":"Add remaining cash costs"}</button></div>}
        </div>;
      })}{!workspace.tasks.some(t=>!t.archived)&&<p className="field-help">{copy("No existing tasks to reconcile.")}</p>}</div></details>
      <details><summary>{copy("Edit the proposal for your case")}</summary><p className="field-help">{copy("Adjust the actual scope and estimates before accepting. The original proposal and your changes remain in history.")}</p>{step.result!.experiments.map(e=>{
        const c=e.contract;if(!c)return null;const changed=selection.experimentEdits.find(x=>x.key===c.key);
        return <fieldset className="plan-experiment-edit" key={c.key}><legend>{e.title}</legend><Field name={`edit-plan-title-${c.key}`} label={copy("Task title")} value={changed?.title??e.title} onChange={v=>edit(c.key,{title:v})}/><Field name={`edit-plan-deliverable-${c.key}`} label={copy("Deliverable")} textarea value={changed?.deliverable??e.deliverable} onChange={v=>edit(c.key,{deliverable:v})}/><Field name={`edit-plan-method-${c.key}`} label={copy("Method")} textarea value={changed?.method??e.method} onChange={v=>edit(c.key,{method:v})}/><div className="analysis-two-columns"><Field name={`edit-plan-minutes-${c.key}`} label={copy("Estimated minutes")} type="number" value={(changed?.effortMinutes===undefined?c.effortMinutes:changed.effortMinutes)?.toString()??""} onChange={v=>edit(c.key,{effortMinutes:v?Number(v):null})}/><Field name={`edit-plan-week-${c.key}`} label={copy("Week (1–4)")} type="number" value={(changed?.week??e.week).toString()} onChange={v=>edit(c.key,{week:Number(v)})}/></div><Field name={`edit-plan-deadline-${c.key}`} label={copy("Decision deadline (day 1–30)")} type="number" value={(changed?.measurement?.deadlineDay??c.measurement.deadlineDay).toString()} onChange={v=>edit(c.key,{measurement:{...(changed?.measurement||c.measurement),deadlineDay:Number(v)}})}/>{(changed?.costs||c.costs).map((cost,i)=><div className="analysis-two-columns plan-budget-row" key={i}><Field name={`edit-plan-currency-${c.key}-${i}`} label={copy("Expense currency")} className="analysis-currency" value={cost.currency} maxLength={3} onChange={v=>edit(c.key,{costs:(changed?.costs||c.costs).map((x,j)=>j===i?{...x,currency:v.toUpperCase()}:x)})}/><Field name={`edit-plan-cost-${c.key}-${i}`} label={`Estimated ${cost.currency} cost`} type="number" value={cost.amount?.toString()??""} onChange={v=>edit(c.key,{costs:(changed?.costs||c.costs).map((x,j)=>j===i?{...x,amount:v?Number(v):null}:x)})}/><button type="button" className="button small ghost" onClick={()=>edit(c.key,{costs:(changed?.costs||c.costs).filter((_,j)=>j!==i)})}>{copy("Remove expense")}</button></div>)}<button type="button" className="button small ghost" disabled={(changed?.costs||c.costs).length>=5} onClick={()=>edit(c.key,{costs:[...(changed?.costs||c.costs),{currency:selection.limits.budgets[0]?.currency||"USD",amount:null}]})}>{copy("Add expense for this experiment")}</button><Field name={`edit-plan-reason-${c.key}`} label={copy("Reason for revision")} maxLength={1000} value={changed?.reason||""} onChange={v=>edit(c.key,{reason:v})}/></fieldset>;
      })}</details>
      {preview&&<section className="plan-capacity" aria-label={copy("Plan capacity review")}><h3>{copy("Capacity check")}</h3><div className="plan-week-totals">{preview.weeks.map(w=><div key={w.week}><span>{copy("Week")} {w.week}</span><strong>{w.minutes}  {copy("min")}</strong><small>{w.unknownTasks.length?`${w.unknownTasks.length} ${copy("unestimated")}`:copy("All tasks estimated")}</small></div>)}</div>{preview.spending.map(s=><p key={s.currency}>{s.currency} {s.amount}  {copy("estimated /")} {s.limit??copy("unknown")}  {copy("budget")}</p>)}{preview.blockers.length>0&&<div className="error-notice" role="alert"><strong>{copy("Resolve before applying")}</strong><ul>{preview.blockers.map((x,i)=><li key={i}>{copy(x)}</li>)}</ul></div>}{preview.unknowns.length>0&&<><ul className="plan-unknowns">{preview.unknowns.map((x,i)=><li key={i}>{copy(x)}</li>)}</ul><label className="plan-checkbox"><input type="checkbox" checked={selection.acknowledgeUnknowns} onChange={e=>change({...selection,acknowledgeUnknowns:e.target.checked})}/>{copy("I understand these uncertainties. Save this as a conditional plan, without claiming capacity is verified.")}</label></>}{preview.ready&&!preview.unknowns.length&&<p className="field-help">{copy("The stated estimates fit the stated limits. Actual effort and spending still need observation.")}</p>}</section>}
    </>}
  </fieldset>;
}
