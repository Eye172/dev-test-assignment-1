"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { z } from "zod";
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleDashed, FlaskConical, LockKeyhole, Play, Plus, Search, ShieldCheck, Square, Users } from "lucide-react";
import { api } from "@/lib/client-api";
import { agentCatalog, aiRoles, modeRoles, roleSections, runModes, type AiEvidence, type AiResult, type AiRole, type AiRun, type AiSource, type AiStep, type AiStudioState, type RunMode } from "@/lib/domain/ai";
import { sectionTitles } from "@/lib/domain/completion";
import type { SectionKey } from "@/lib/domain/schemas";
import type { StrategyData, Workspace } from "@/lib/domain/types";
import { Dialog, ErrorNotice, Field, Spinner, useDirtyGuard } from "./ui";
import { useWorkspace } from "./workspace";
import { AnalysisBoard } from "./analysis-board";
import { PlanReview } from "./plan-review";
import type { MemoryItem, PlanPreview } from "@/lib/domain/analysis";
import { clearDraft, clearSubmittedDraft, useDraftRecovery } from "./draft-recovery";

const modes:Record<RunMode,{label:string;description:string}>={full:{label:"Full team",description:"Research → strategy → pricing → experiments → critique"},research:{label:"Research",description:"Compare competitors, alternatives and current sources"},strategy:{label:"Strategy",description:"Sharpen the buyer, promise and route to market"},pricing:{label:"Pricing",description:"Explore an offer, payment unit and price test"},experiments:{label:"Experiments",description:"Design the next 30 days from your saved decisions"}};
const statusText:Record<AiRun["status"],string>={queued:"Queued",running:"Team working",paused:"Checkpoint saved",completed:"Ready to review",needs_attention:"Review with concerns",failed:"Run stopped",cancelled:"Cancelled"};
const money=(micros:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:3}).format(micros/1000000);
const active=(run:AiRun)=>["queued","running","paused"].includes(run.status);
function mostRecent(steps:AiStep[],role:AiRole){return steps.filter(s=>s.role===role).sort((a,b)=>b.round-a.round)[0];}
const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
function SourceLinks({urls,sources}:{urls:string[];sources:AiSource[]}) {
  return urls.length?<span className="ai-citations">{urls.map((url,i)=>{const source=sources.find(s=>s.url===url);return <a key={url} href={url} target="_blank" rel="noopener noreferrer" title={source?.title||url}>[{i+1}] {new URL(url).hostname.replace(/^www\./,"")}<ArrowUpRight size={11} aria-hidden/><span className="sr-only"> (opens in a new tab)</span></a>;})}</span>:null;
}

export function AiStudio() {
  const {workspace,setWorkspace,notify,track}=useWorkspace();
  const endpoint=`/api/startups/${workspace.startup.id}/ai`;
  const [state,setState]=useState<AiStudioState|null>(null);
  const [selected,setSelected]=useState<string|null>(null);
  const [role,setRole]=useState<AiRole>("researcher");
  const [composerOpen,setComposerOpen]=useState(false);
  const [mode,setMode]=useState<RunMode>("full");
  const [brief,setBrief]=useState("");
  const [parent,setParent]=useState<string|null>(null);
  const [code,setCode]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<Error|null>(null);
  const [evidenceOpen,setEvidenceOpen]=useState(false);
  const [evidenceTargets,setEvidenceTargets]=useState<string[]>([]);
  const [planPreview,setPlanPreview]=useState<PlanPreview|null>(null);
  const [review,setReview]=useState<{step:AiStep;target:SectionKey|"roadmap"}|null>(null);
  const [requestId,setRequestId]=useState<string|null>(null);
  const inFlight=useRef(false);
  const autoResume=useRef<string|null>(null);
  const resumedCheckpoints=useRef(new Set<string>());
  const [loaded,setLoaded]=useState(false);
  const run=state?.runs.find(r=>r.id===selected)||state?.runs[0];
  const running=state?.runs.find(active);
  const composerVisible=!state?.runs.length||composerOpen||!!brief.trim()||!!parent;
  const chooseRole=(next:AiRole)=>{setRole(next);const panel=document.getElementById("ai-specialist-proposals") as HTMLDetailsElement|null;if(panel)panel.open=true;requestAnimationFrame(()=>{document.getElementById("artifact-title")?.focus({preventScroll:true});document.getElementById("ai-specialist-proposals")?.scrollIntoView({behavior:workspace.startup.preferences.motion==="reduced"||matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth",block:"start"});});};
  const step=run?mostRecent(run.steps,role):undefined;
  useDirtyGuard(!!brief.trim());
  useDraftRecovery(`ai-brief:${workspace.startup.id}`,{mode,brief,parent,requestId},!!brief.trim(),value=>{
    const d=z.object({mode:z.enum(runModes),brief:z.string().max(6000),parent:z.uuid().nullable(),requestId:z.uuid().nullable()}).parse(value);
    setMode(d.mode);setBrief(d.brief);setParent(d.parent);setRequestId(d.requestId);
  });
  const load=useCallback(async()=>{const data=await api<AiStudioState>(endpoint);setState(data);setLoaded(true);return data;},[endpoint]);
  useEffect(()=>{
    const paused=state?.runs.find(r=>r.id===autoResume.current&&r.status==="paused");
    if(!paused)return;
    const checkpoint=`${paused.id}:${paused.updatedAt}`;if(resumedCheckpoints.current.has(checkpoint))return;
    resumedCheckpoints.current.add(checkpoint);
    void api(endpoint,{method:"POST",body:JSON.stringify({action:"resume",runId:paused.id})}).then(load).catch(e=>setError(e as Error));
  },[state,endpoint,load]);
  useEffect(()=>{let alive=true;void api<AiStudioState>(endpoint).then(data=>{if(alive){setState(data);setLoaded(true);}}).catch(e=>{if(alive){setError(e);setLoaded(true);}});return()=>{alive=false;};},[endpoint]);
  useEffect(()=>{
    if(!state?.authorized)return;
    let stopped=false;let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{
      if(stopped)return;
      if(!document.hidden)try{const data=await api<AiStudioState>(endpoint);if(!stopped)setState(data);}catch(e){if(!stopped)setError(e as Error);}
      if(!stopped)timer=setTimeout(poll,running?3000:15000);
    };
    timer=setTimeout(poll,running?2000:15000);return()=>{stopped=true;clearTimeout(timer);};
  },[endpoint,state?.authorized,!!running]); // eslint-disable-line react-hooks/exhaustive-deps
  const perform=async(payload:unknown,success?:string)=>{
    if(inFlight.current)return;inFlight.current=true;setBusy(true);setError(null);
    try{const data=await api<unknown>(endpoint,{method:"POST",body:JSON.stringify(payload)});try{await load();}catch{setError(new Error("Your change was saved, but the latest studio view could not be loaded. Refresh the view; do not submit the same observation again."));}if(success)notify(success);return data;}catch(e){setError(e as Error);throw e;}finally{inFlight.current=false;setBusy(false);}
  };
  const start=async()=>{
    const attemptId=requestId||crypto.randomUUID();setRequestId(attemptId);
    const submitted={mode,brief,parent,requestId:attemptId};
    const result=await perform({action:"create",payload:{mode:submitted.mode,brief:submitted.brief,requestId:submitted.requestId,parentRunId:submitted.parent}}) as {id:string}|undefined;
    if(result){autoResume.current=result.id;setSelected(result.id);setRole(submitted.mode==="experiments"?"experimenter":"researcher");setBrief(current=>current===submitted.brief?"":current);setParent(current=>current===submitted.parent?null:current);setRequestId(current=>current===submitted.requestId?null:current);notify("Brief saved. The team has started.");}
  };
  const apply=async()=>{
    if(!run||!review)return;
    const result=await track(perform({action:"apply",runId:run.id,stepId:review.step.id,target:review.target,...(review.target==="roadmap"&&planPreview?{plan:{selection:planPreview.selection,previewHash:planPreview.hash}}:{})})) as Workspace|undefined;
    if(result){setWorkspace(result);if(review.target==="roadmap")clearSubmittedDraft(`plan-review:${run.id}:${review.step.id}`,planPreview?.selection);setReview(null);setPlanPreview(null);notify(review.target==="roadmap"?"Reviewed plan saved; superseded suggestions retained in history":"Reviewed proposal saved to strategy");}
  };
  const followUp=()=>{if(!run)return;setParent(run.id);setRequestId(null);requestAnimationFrame(()=>{document.getElementById("field-ai-brief")?.focus();document.getElementById("ai-composer")?.scrollIntoView({behavior:workspace.startup.preferences.motion==="reduced"?"instant":"smooth",block:"center"});});};
  return <div className="ai-studio">
    <div className="page-heading"><div><p className="eyebrow">Research. Decide. Test.</p><h1 tabIndex={-1}>Research & decisions</h1><p className="lead">Compare your alternatives, challenge the assumptions and choose a feasible next step.</p></div>
      {state?.authorized&&<div className="page-heading-actions"><a className="button small ghost" href={`${endpoint}?export=1`} download><ArrowDownToLine size={15} aria-hidden/>History</a><button className="button small ghost" disabled={busy} onClick={()=>void perform({action:"lock"}).catch(()=>{})}><LockKeyhole size={15} aria-hidden/>Lock</button></div>}
    </div>
    <ErrorNotice error={error} onRetry={()=>{setError(null);void load().catch(setError);}}/>
    {!loaded?<p role="status"><Spinner/>Opening your studio…</p>:!state?.authorized?<section className="ai-access plate">
      <div className="ai-access-art instrument" aria-hidden><span className="ai-orbit-ring"/><span className="ai-orbit-core"><Users size={34}/></span>{aiRoles.map((r,i)=><span className="ai-orbit-node" key={r} style={{"--node":i} as React.CSSProperties}>{String(i+1).padStart(2,"0")}</span>)}</div>
      <div><p className="eyebrow">Six perspectives. One direction.</p><h2>Meet your GTM team.</h2><p className="muted">Researcher, strategist, monetization specialist, experiment designer, brief interpreter and an independent evidence critic.</p>
      {state?.configured?<form onSubmit={e=>{e.preventDefault();void perform({action:"unlock",payload:{code}}).then(()=>setCode("")).catch(()=>{});}}><Field name="ai-access" label="Studio access code" type="password" value={code} onChange={setCode} maxLength={256} autoComplete="current-password"/><button className="button primary" disabled={busy||!code} aria-busy={busy}>{busy?<Spinner/>:<LockKeyhole size={16} aria-hidden/>}Unlock studio<ArrowRight size={16} aria-hidden/></button></form>:<p className="info-notice">The owner needs to add the OpenAI API key and an access code to the server environment.</p>}
      <p className="field-help">The server keeps the API key. AI briefs and observations require owner access. Profile and strategy remain part of the shared demo.</p></div>
    </section>:<>
      {!composerVisible&&<div className="ai-new-question"><p className="field-help">Review the saved findings and decisions below, or open a new question.</p><button className="button small" onClick={()=>setComposerOpen(true)}><Plus size={15} aria-hidden/>New question</button></div>}
      {composerVisible&&<section className="ai-composer plate" id="ai-composer" aria-labelledby="brief-title">
        <div className="ai-composer-head"><div><p className="eyebrow">{parent?"Build on a previous run":"Start where you are"}</p><h2 id="brief-title">What should we work through?</h2></div><span className="ai-model-tag">OpenAI · live agents</span></div>
        <form onSubmit={e=>{e.preventDefault();void start().catch(()=>{});}}>
          <Field name="ai-brief" label="Your brief" textarea value={brief} maxLength={6000} minRows={110} onChange={v=>{setBrief(v);setRequestId(null);}} placeholder="e.g. We have two weeks and $300 to find our first 3 paying customers. Compare the alternatives, challenge our pricing and design a test we can actually run." help="Your saved profile, strategy, tasks and recorded observations travel with this brief. Add goals, constraints or a question in your own words."/>
          <div className="ai-mode-list" role="group" aria-label="Specialist scope">{runModes.map(m=><button type="button" key={m} className={mode===m?"selected":""} aria-pressed={mode===m} disabled={busy} onClick={()=>{setMode(m);setRequestId(null);}}>{m==="full"&&<Users size={14} aria-hidden/>}{modes[m].label}</button>)}</div>
          <div className="ai-composer-foot"><p className="field-help">{modes[mode].description}<br/>Run estimate limit ${state.limits.runBudgetUsd} · shared daily limit ${state.limits.dailyBudgetUsd}. Sent to OpenAI when you start.</p><button className="button primary" disabled={busy||!!running||!state.configured} aria-busy={busy}>{busy?<Spinner/>:<Play size={15} aria-hidden/>}{running?"Run in progress":"Start the team"}<ArrowUpRight size={16} aria-hidden/></button></div>
          {parent&&<p className="ai-followup-tag">Following up from saved specialist artifacts <button type="button" className="text-link" onClick={()=>setParent(null)}>Clear</button></p>}
        </form>
      </section>}
      {state.runs.length>0&&<div className="ai-run-toolbar"><label>Run <select aria-label="Select run" value={run?.id} onChange={e=>setSelected(e.target.value)}>{state.runs.map((r,i)=><option key={r.id} value={r.id}>{i===0?"Latest · ":""}{modes[r.mode].label} · {new Date(r.createdAt).toLocaleString()} · {statusText[r.status]}</option>)}</select></label><span className="field-help">History stays after refresh</span></div>}
      {!run&&<AnalysisBoard state={state} busy={busy} mutate={perform} onReview={(s,target)=>{setPlanPreview(null);setReview({step:s,target});}} onObserve={ids=>{setEvidenceTargets(ids);setEvidenceOpen(true);}}/>}
      {run&&<>
        <section className="ai-console instrument" aria-label="Specialist progress">
          <div className="ai-console-heading"><div><span className={`ai-live-light ${run.status}`} aria-hidden/><span role="status">{statusText[run.status]}</span><span className="ai-console-mode">{modes[run.mode].label}</span></div><div className="ai-run-controls">{active(run)&&<><button className="button small" disabled={busy} onClick={()=>void perform({action:"resume",runId:run.id}).catch(()=>{})}><Play size={13} aria-hidden/>{run.status==="paused"?"Resume":"Recover worker"}</button><button className="button small ghost" disabled={busy} onClick={()=>void perform({action:"cancel",runId:run.id}).catch(()=>{})}><Square size={12} aria-hidden/>Cancel</button></>}{!active(run)&&<button className="button small" onClick={followUp}>Follow up<ArrowRight size={14} aria-hidden/></button>}</div></div>
          <div className="ai-sequence" role="group" aria-label="Specialist results">{modeRoles[run.mode].map((r,i)=>{const s=mostRecent(run.steps,r);return <button key={r} type="button" onClick={()=>chooseRole(r)} className={`ai-stage ${role===r?"selected":""} ${s?.status||"queued"}`} aria-pressed={role===r}><span className="ai-stage-number">{s?.status==="completed"?<Check size={16} aria-hidden/>:s?.status==="running"?<span className="ai-stage-pulse"/>:String(i+1).padStart(2,"0")}</span><span>{agentCatalog[r].short}<small>{s?.round?"Revised · ":""}{s?.status||"queued"}</small></span></button>;})}</div>
          <div className="ai-telemetry"><span>{run.events.at(-1)?.message||"Waiting for the worker"}</span><span className="num">{(run.inputTokens+run.outputTokens).toLocaleString()} tokens · ≈ {money(run.estimatedMicros)}</span></div>
        </section>
        {run.stale&&<p className="info-notice"><CircleDashed size={16} aria-hidden/>Your saved context has changed. These proposals remain in history; start a follow-up before applying them.</p>}
        {run.error&&<ErrorNotice error={run.error}/>}
        <AnalysisBoard state={state} run={run} busy={busy} mutate={perform} onReview={(s,target)=>{setPlanPreview(null);setReview({step:s,target});}} onObserve={ids=>{setEvidenceTargets(ids);setEvidenceOpen(true);}}/>
        <details className="ai-specialist-details" id="ai-specialist-proposals"><summary>Specialist proposals and saved strategy changes</summary>
        <div className="ai-workbench">
          <section className="ai-artifact plate" aria-labelledby="artifact-title">
            <div className="ai-artifact-heading"><div><p className="eyebrow">{agentCatalog[role].name}{step?.round?" · revised":""}</p><h2 id="artifact-title" tabIndex={-1}>{step?.result?.title||agentCatalog[role].description}</h2></div><span className="ai-role-index">{String(aiRoles.indexOf(role)+1).padStart(2,"0")}</span></div>
            {step?.result?<Artifact result={step.result} sources={run.sources}/>:<div className="ai-waiting">{step?.status==="running"?<><Spinner/><p>This specialist is working with your brief.</p></>:step?.status==="failed"?<p>{step.error}</p>:<><CircleDashed size={32} aria-hidden/><p>{step?"This role starts after its dependencies are ready.":"This specialist is outside the selected scope."}</p></>}<p className="field-help">Only completed, persisted results appear here.</p></div>}
            {step?.result&&<div className="ai-proposal-actions">{roleSections[role].filter(k=>step.result?.strategy[k]).map(target=>{const applied=run.applications.some(a=>a.stepId===step.id&&a.target===target);return <button key={target} className="button small" disabled={busy||run.stale||active(run)||applied||run.status==="failed"||run.status==="cancelled"} onClick={()=>{setPlanPreview(null);setReview({step,target});}}>{applied?<Check size={14} aria-hidden/>:<Search size={14} aria-hidden/>}{applied?"Applied":`Review ${sectionTitles[target]}`}</button>;})}
            {role==="experimenter"&&step.result.experiments.length>0&&<button className="button primary small" disabled={busy||run.stale||active(run)||run.status==="failed"||run.status==="cancelled"||run.applications.some(a=>a.stepId===step.id&&a.target==="roadmap")} onClick={()=>{setPlanPreview(null);setReview({step,target:"roadmap"});}}><FlaskConical size={15} aria-hidden/>{run.applications.some(a=>a.stepId===step.id&&a.target==="roadmap")?"Plan applied":"Review experiment plan"}</button>}</div>}
          </section>
          <aside className="ai-side-notes">
            <section className="ai-side-section"><p className="eyebrow">The quality gate</p><h3>Challenge before commitment.</h3>{mostRecent(run.steps,"critic")?.result?<>{mostRecent(run.steps,"critic")!.result!.issues.length?mostRecent(run.steps,"critic")!.result!.issues.map((issue,i)=><div key={i} className={`ai-issue ${issue.severity}`}><span>{issue.severity} · {agentCatalog[issue.target].short}</span><h4>{issue.topic}</h4><p>{issue.reason}</p><p className="field-help">Next: {issue.correction}</p></div>):<p className="muted">No unresolved issues raised by the critic. This is an internal review, not market validation.</p>}</>:<p className="muted">The critic checks sources, contradictions, practicality and unsupported claims after the specialists finish.</p>}<p className="field-help">One correction round at most. Remaining disagreements stay visible.</p></section>
            <details className="ai-side-section"><summary>Sources <span className="num">{run.sources.length}</span><ChevronDown size={14} aria-hidden/></summary>{run.sources.length?<ol className="ai-source-ledger">{run.sources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}<ArrowUpRight size={12} aria-hidden/><span className="sr-only"> (opens in a new tab)</span></a><small>{new URL(s.url).hostname} · retrieved {s.accessedAt.slice(0,10)}</small></li>)}</ol>:<p className="field-help">No sources retrieved in this run yet.</p>}</details>
            <details className="ai-side-section"><summary>Run journal<ChevronDown size={14} aria-hidden/></summary><ol className="ai-journal">{run.events.map(e=><li key={e.seq}><time>{e.createdAt.slice(11,19)} UTC</time><p>{e.message}</p></li>)}</ol><p className="field-help">{step?.model} · usage estimate at configured model rates; provider billing may differ.</p></details>
            <div className="ai-side-section"><Link className="text-link" href={`/startups/${workspace.startup.id}/strategy`}>Open saved strategy<ArrowUpRight size={14} aria-hidden/></Link><br/><Link className="text-link" href={`/startups/${workspace.startup.id}/roadmap`}>Open roadmap<ArrowUpRight size={14} aria-hidden/></Link></div>
          </aside>
        </div>
        </details>
      </>}
      {!run&&<div className="ai-first-run"><ShieldCheck size={22} aria-hidden/><p><strong>A working team, with boundaries.</strong> Actual web research, typed proposals, an evidence critic and your final say. Nothing is applied automatically.</p></div>}
      <section className="ai-observations plate" aria-labelledby="observations-title"><div className="plate-head"><div><p className="eyebrow">Close the loop</p><h2 id="observations-title">What happened in the real world?</h2></div><button className="button small" onClick={()=>setEvidenceOpen(true)}><Plus size={15} aria-hidden/>Record observation</button></div><p className="muted">Interviews, commitments, payments and counter-evidence inform the next run. A completed task alone proves nothing about demand.</p>
        {state.evidence.length?<ul className="ai-evidence-list">{[...state.evidence].reverse().map(e=><li key={e.id}><span className="ai-evidence-type">{e.kind} · {e.interpretation}</span><p>{e.observation}</p><small>{e.observedOn} · {e.method}{e.sampleSize?` · n=${e.sampleSize}`:""}</small>{e.limitations&&<p className="field-help">Limitations: {e.limitations}</p>}{e.sourceUrl&&<a href={e.sourceUrl} className="text-link" target="_blank" rel="noopener noreferrer">Founder-provided reference<ArrowUpRight size={12} aria-hidden/></a>}</li>)}</ul>:<p className="field-help">No observations yet. These remain separate from strategy completeness and task progress.</p>}
      </section>
      <Dialog open={!!review} onClose={()=>{if(!busy)setReview(null);}} title={review?.target==="roadmap"?"Review experiment plan":`Review ${review?sectionTitles[review.target as SectionKey]:"proposal"}`} locked={busy} className="ai-review-dialog">
        {review&&<div className="ai-review-body"><p className="muted">Applying shares the selected strategy or task content through the demo workspace link. Private briefs, observations and decision memory stay owner-gated. Previous values and your section notes are retained.</p>{review.target==="roadmap"&&run?<PlanReview endpoint={endpoint} runId={run.id} step={review.step} workspace={workspace} onPreview={setPlanPreview} busy={busy}/>:review.target!=="roadmap"?<div className="ai-comparison"><div><h3>Saved now</h3><StrategyFields data={workspace.sections.find(s=>s.key===review.target)!.data}/></div><div><h3>Proposed</h3><StrategyFields data={review.step.result!.strategy[review.target]!}/></div></div>:null}
        <ErrorNotice error={error}/><div className="ai-review-foot"><button className="button primary" disabled={busy||!!run?.stale||review.target==="roadmap"&&!planPreview?.ready} onClick={()=>void apply().catch(()=>{})}>{busy?<Spinner/>:<Check size={15} aria-hidden/>}Apply reviewed {review.target==="roadmap"?"plan":"proposal"}</button><button className="button ghost" disabled={busy} onClick={()=>setReview(null)}>Keep current</button></div></div>}
      </Dialog>
      {evidenceOpen&&<EvidenceDialog open onClose={()=>{setEvidenceOpen(false);setEvidenceTargets([]);}} workspace={workspace} memory={state.memory||[]} initialTargets={evidenceTargets} onSave={async input=>{await perform({action:"evidence",payload:input},"Observation recorded for the next run");setEvidenceOpen(false);setEvidenceTargets([]);}}/>}
    </>}
  </div>;
}

function Artifact({result,sources}:{result:AiResult;sources:AiSource[]}) {
  return <motion.div className="ai-artifact-content" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{duration:.25}}>
    <p className="ai-summary">{result.summary}</p>
    {!!result.recommendations.length&&<div className="ai-recommendations">{result.recommendations.map((r,i)=><article key={i}><span className="ai-rec-index">{String(i+1).padStart(2,"0")}</span><div><h3>{r.title}</h3><p>{r.detail}</p><SourceLinks urls={r.sourceUrls} sources={sources}/>{!!r.tradeoffs.length&&<p className="ai-tradeoff"><strong>Tradeoff</strong> {r.tradeoffs.join(" ")}</p>}<p className="ai-next-test"><FlaskConical size={14} aria-hidden/><span>{r.nextTest}</span></p></div></article>)}</div>}
    {!!result.experiments.length&&<ExperimentList experiments={result.experiments}/>}
    {!!result.claims.length&&<details className="ai-claims"><summary>Evidence & assumptions <span className="num">{result.claims.length}</span></summary>{result.claims.map((c,i)=><div key={i} className="ai-claim"><span className={`ai-claim-kind ${c.kind}`}>{c.kind.replaceAll("_"," ")}</span><p>{c.statement}</p><SourceLinks urls={c.sourceUrls} sources={sources}/>{c.limitation&&<p className="field-help">{c.limitation}</p>}</div>)}</details>}
    {!!result.questions.length&&<section className="ai-questions"><h3>What would change the decision?</h3>{result.questions.map((q,i)=><div key={i}><p>{q.question}</p><small>{q.why}</small></div>)}</section>}
    {!!result.issues.length&&<section className="ai-inline-issues"><h3>Review notes</h3>{result.issues.map((i,j)=><div key={j} className={`ai-issue ${i.severity}`}><span>{i.severity} · {agentCatalog[i.target].short}</span><h4>{i.topic}</h4><p>{i.reason}</p><p className="field-help">{i.correction}</p></div>)}</section>}
  </motion.div>;
}
function ExperimentList({experiments}:{experiments:AiResult["experiments"]}) {
  return <ol className="ai-experiments">{experiments.map((e,i)=><li key={i}><span className="ai-experiment-week">W{e.week}</span><div><h3>{e.title}</h3><p>{e.hypothesis}</p><p className="muted">{e.method}</p><dl><div><dt>Deliverable</dt><dd>{e.deliverable}</dd></div><div><dt>Measure</dt><dd>{e.metric}</dd></div><div><dt>Decide when</dt><dd>{e.threshold}</dd></div><div><dt>Effort</dt><dd>{e.effort}</dd></div>{!!e.dependencies.length&&<div><dt>Depends on</dt><dd>{e.dependencies.join(" · ")}</dd></div>}</dl></div></li>)}</ol>;
}
function StrategyFields({data}:{data:StrategyData}) {
  const render=(v:unknown):string=>Array.isArray(v)?v.map(x=>typeof x==="object"&&x?Object.values(x).join(" · "):String(x)).join("\n\n"):String(v||"Not yet recorded");
  return <dl className="ai-strategy-fields">{Object.entries(data).map(([key,value])=><div key={key}><dt>{key.replace(/([A-Z])/g," $1")}</dt><dd>{render(value)}</dd></div>)}</dl>;
}
function EvidenceDialog({open,onClose,workspace,onSave,memory,initialTargets}:{open:boolean;onClose:()=>void;workspace:Workspace;memory:MemoryItem[];initialTargets:string[];onSave:(input:Omit<AiEvidence,"id"|"createdAt">)=>Promise<void>}) {
  const [attempt,setAttempt]=useState<{signature:string;id:string}|null>(null);
  const [observation,setObservation]=useState("");const [method,setMethod]=useState("");const [limitations,setLimitations]=useState("");const [kind,setKind]=useState<AiEvidence["kind"]>("interview");const [interpretation,setInterpretation]=useState<AiEvidence["interpretation"]>("inconclusive");const [taskId,setTaskId]=useState("");const [sample,setSample]=useState("");const [date,setDate]=useState(localDate);const [source,setSource]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState<Error|null>(null);
  const [hypothesisIds,setHypothesisIds]=useState(initialTargets);
  const [baseline]=useState(()=>JSON.stringify({observation:"",method:"",limitations:"",kind:"interview",interpretation:"inconclusive",taskId:"",sample:"",date:localDate(),source:"",hypothesisIds:initialTargets}));
  const dirty=JSON.stringify({observation,method,limitations,kind,interpretation,taskId,sample,date,source,hypothesisIds})!==baseline,draftKey=`ai-evidence:${workspace.startup.id}`;
  const draft={observation,method,limitations,kind,interpretation,taskId,sample,date,source,hypothesisIds,attempt};
  useDirtyGuard(dirty);
  useDraftRecovery(draftKey,draft,dirty,value=>{const d=z.object({observation:z.string(),method:z.string(),limitations:z.string(),kind:z.enum(["interview","commitment","payment","analytics","other"]),interpretation:z.enum(["inconclusive","supports","contradicts"]),taskId:z.string(),sample:z.string(),date:z.string(),source:z.string(),hypothesisIds:z.array(z.uuid()),attempt:z.object({signature:z.string(),id:z.uuid()}).nullable()}).parse(value);setObservation(d.observation);setMethod(d.method);setLimitations(d.limitations);setKind(d.kind);setInterpretation(d.interpretation);setTaskId(d.taskId);setSample(d.sample);setDate(d.date);setSource(d.source);setHypothesisIds(d.hypothesisIds);setAttempt(d.attempt);});
  return <Dialog open={open} onClose={()=>{if(!dirty||window.confirm("Discard this unsaved observation?")){clearDraft(draftKey);onClose();}}} title="Record an observation" locked={busy}><form onSubmit={e=>{e.preventDefault();setBusy(true);setError(null);const payload={taskId:taskId||null,kind,observation,interpretation,sampleSize:sample?Number(sample):null,sourceUrl:source,method,observedOn:date,limitations,hypothesisIds};const signature=JSON.stringify(payload);const currentAttempt=attempt?.signature===signature?attempt:{signature,id:crypto.randomUUID()};setAttempt(currentAttempt);const submitted={...draft,attempt:currentAttempt};void onSave({...payload,requestId:currentAttempt.id}).then(()=>{clearSubmittedDraft(draftKey,submitted);setAttempt(null);setObservation("");setMethod("");setLimitations("");setSource("");setSample("");}).catch(setError).finally(()=>setBusy(false));}}><fieldset disabled={busy} className="ai-evidence-form">
    <p className="muted">Record what you observed separately from what you believe it means. User-reported payments are not independently verified transactions.</p>
    <label>Related task<select value={taskId} onChange={e=>setTaskId(e.target.value)}><option value="">General observation</option>{workspace.tasks.map(t=><option key={t.id} value={t.id}>{t.title}{t.archived?" (history)":""}</option>)}</select></label>
    <fieldset className="analysis-evidence-targets"><legend>Which hypotheses does this bear on?</legend>{memory.filter(m=>m.data.kind==="hypothesis"&&m.status!=="superseded").map(m=><label key={m.id} className="plan-checkbox"><input type="checkbox" checked={hypothesisIds.includes(m.id)} onChange={e=>setHypothesisIds(e.target.checked?[...hypothesisIds,m.id]:hypothesisIds.filter(id=>id!==m.id))}/>{m.data.kind==="hypothesis"?m.data.proposal.statement:""}</label>)}{!memory.some(m=>m.data.kind==="hypothesis")&&<p className="field-help">No hypotheses recorded yet. You may save a general observation.</p>}</fieldset>
    <div className="ai-form-pair"><label>Evidence type<select value={kind} onChange={e=>setKind(e.target.value as AiEvidence["kind"])}>{["interview","commitment","payment","analytics","other"].map(v=><option key={v}>{v}</option>)}</select></label><label>Interpretation<select value={interpretation} onChange={e=>setInterpretation(e.target.value as AiEvidence["interpretation"])}>{["inconclusive","supports","contradicts"].map(v=><option key={v}>{v}</option>)}</select></label></div>
    <Field name="observation" label="What happened?" required value={observation} onChange={setObservation} textarea maxLength={5000} help="Specific behavior, a quote or a measured outcome. Minimum 10 characters."/>
    <Field name="evidence-method" label="How was it observed?" required value={method} onChange={setMethod} maxLength={1000}/>
    <div className="ai-form-pair"><Field name="evidence-date" label="Observation date" type="date" value={date} onChange={setDate}/><Field name="sample-size" label="Sample size (optional)" type="number" value={sample} onChange={setSample}/></div>
    <Field name="evidence-url" label="Reference URL (optional)" type="url" value={source} onChange={setSource}/><Field name="evidence-limitations" label="Limitations & context" value={limitations} onChange={setLimitations} textarea maxLength={1500} help="Selection bias, missing data, what this does not establish."/>
    <ErrorNotice error={error}/><button className="button primary" disabled={busy||observation.trim().length<10||method.trim().length<3||!date}>{busy?<Spinner/>:<Check size={15} aria-hidden/>}Save observation</button>
  </fieldset></form></Dialog>;
}
