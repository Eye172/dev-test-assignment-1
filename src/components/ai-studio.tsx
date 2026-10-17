"use client";
import { useAnalysisCopy } from "@/ui/use-analysis-copy";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { z } from "zod";
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleDashed, FlaskConical, LockKeyhole, Play, Plus, Search, ShieldCheck, Square, Users } from "lucide-react";
import { api } from "@/lib/client-api";
import { agentCatalog, aiRoles, modeRoles, roleSections, runModes, type AiEvidence, type AiResult, type AiRole, type AiRun, type AiSource, type AiStep, type AiStudioState, type RunMode } from "@/lib/domain/ai";
import type { SectionKey } from "@/lib/domain/schemas";
import type { StrategyData, Workspace } from "@/lib/domain/types";
import { Dialog, ErrorNotice, Field, Spinner, useDirtyGuard } from "./ui";
import { useWorkspace } from "./workspace";
import { AnalysisBoard } from "./analysis-board";
import { PlanReview } from "./plan-review";
import type { MemoryItem, PlanPreview } from "@/lib/domain/analysis";
import { clearDraft, clearSubmittedDraft, useDraftRecovery } from "./draft-recovery";
import { useDisplay } from "@/ui/display";
import { AiInsightsPanel } from "@/ui/screens/ai-insights";

const modes:Record<RunMode,{label:string;description:string}>={full:{label:"ai.mode.full",description:"ai.mode.full.d"},research:{label:"ai.mode.research",description:"ai.mode.research.d"},strategy:{label:"ai.mode.strategy",description:"ai.mode.strategy.d"},pricing:{label:"ai.mode.pricing",description:"ai.mode.pricing.d"},experiments:{label:"ai.mode.experiments",description:"ai.mode.experiments.d"},review:{label:"ai.mode.review",description:"ai.mode.review.d"}};
const statusText:Record<AiRun["status"],string>={queued:"ai.st.queued",running:"ai.st.running",paused:"ai.st.paused",completed:"ai.st.completed",needs_attention:"ai.st.needs_attention",failed:"ai.st.failed",cancelled:"ai.st.cancelled"};
const money=(micros:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:3}).format(micros/1000000);
const active=(run:AiRun)=>["queued","running","paused"].includes(run.status);
function mostRecent(steps:AiStep[],role:AiRole){return steps.filter(s=>s.role===role).sort((a,b)=>b.round-a.round)[0];}
const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
function SourceLinks({urls,sources}:{urls:string[];sources:AiSource[]}) {
  const copy=useAnalysisCopy();
  return urls.length?<span className="ai-citations">{urls.map((url,i)=>{const source=sources.find(s=>s.url===url);return <a key={url} href={url} target="_blank" rel="noopener noreferrer" title={source?.title||url}>[{i+1}] {new URL(url).hostname.replace(/^www\./,"")}<ArrowUpRight size={11} aria-hidden/><span className="sr-only">  {copy("(opens in a new tab)")}</span></a>;})}</span>:null;
}

export function AiStudio() {
  const copy=useAnalysisCopy();
  const {workspace,setWorkspace,notify,track}=useWorkspace();
  const { locale, t, tk } = useDisplay();
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
  const selectRun=(id:string)=>{
    setSelected(id);
    const url=new URL(window.location.href);url.searchParams.set("run",id);
    window.history.replaceState(null,"",`${url.pathname}${url.search}${url.hash}`);
  };
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
    if(!state?.authorized)return;
    const current=state.runs.find(r=>r.id===autoResume.current&&active(r))||state.runs.find(active);
    if(current)autoResume.current=current.id;
    const paused=current?.status==="paused"?current:undefined;
    if(!paused)return;
    const checkpoint=`${paused.id}:${paused.updatedAt}`;if(resumedCheckpoints.current.has(checkpoint))return;
    resumedCheckpoints.current.add(checkpoint);
    void api(endpoint,{method:"POST",body:JSON.stringify({action:"resume",runId:paused.id})}).then(load).catch(e=>setError(e as Error));
  },[state,endpoint,load]);
  useEffect(()=>{let alive=true;void api<AiStudioState>(endpoint).then(data=>{if(alive){const requested=new URLSearchParams(window.location.search).get("run");const current=data.runs.find(r=>r.id===requested)||data.runs.find(active);if(current){setSelected(current.id);setRole(current.steps.find(s=>s.status==="running")?.role||current.steps[0]?.role||"intake");if(active(current))autoResume.current=current.id;}setState(data);setLoaded(true);}}).catch(e=>{if(alive){setError(e);setLoaded(true);}});return()=>{alive=false;};},[endpoint]);
  useEffect(()=>{
    if(!state?.authorized)return;
    let stopped=false;let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{
      if(stopped)return;
      try{const data=await api<AiStudioState>(endpoint);if(!stopped)setState(data);}catch(e){if(!stopped)setError(e as Error);}
      if(!stopped)timer=setTimeout(poll,running?(document.hidden?10000:3000):15000);
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
    const result=await perform({action:"create",payload:{mode:submitted.mode,brief:submitted.brief,requestId:submitted.requestId,parentRunId:submitted.parent,locale}}) as {id:string}|undefined;
    if(result){autoResume.current=result.id;selectRun(result.id);setRole(modeRoles[submitted.mode][0]);setBrief(current=>current===submitted.brief?"":current);setParent(current=>current===submitted.parent?null:current);setMode(current=>current==="review"?"full":current);setRequestId(current=>current===submitted.requestId?null:current);notify(t("ai.started"));}
  };
  const apply=async()=>{
    if(!run||!review)return;
    const result=await track(perform({action:"apply",runId:run.id,stepId:review.step.id,target:review.target,...(review.target==="roadmap"&&planPreview?{plan:{selection:planPreview.selection,previewHash:planPreview.hash}}:{})})) as Workspace|undefined;
    if(result){setWorkspace(result);if(review.target==="roadmap")clearSubmittedDraft(`plan-review:${run.id}:${review.step.id}`,planPreview?.selection);setReview(null);setPlanPreview(null);notify(review.target==="roadmap"?t("ai.planSaved"):t("ai.proposalSaved"));}
  };
  const followUp=()=>{if(!run)return;setParent(run.id);setRequestId(null);requestAnimationFrame(()=>{document.getElementById("field-ai-brief")?.focus();document.getElementById("ai-composer")?.scrollIntoView({behavior:workspace.startup.preferences.motion==="reduced"?"instant":"smooth",block:"center"});});};
  return <div className="ai-studio">
    <div className="page-heading"><div><h1 tabIndex={-1}>{t("ai.title")}</h1><p className="lead">{t("ai.lede")}</p></div>
      {state?.authorized&&<div className="page-heading-actions"><a className="button small ghost" href={`${endpoint}?export=1`} download><ArrowDownToLine size={15} aria-hidden/>{t("ai.history")}</a><button className="button small ghost" disabled={busy} onClick={()=>void perform({action:"lock"}).catch(()=>{})}><LockKeyhole size={15} aria-hidden/>{t("ai.lock")}</button></div>}
    </div>
    <ErrorNotice error={error} onRetry={()=>{setError(null);void load().catch(setError);}}/>
    {!loaded?<p role="status"><Spinner/>{t("ai.opening")}</p>:!state?.authorized?<section className="ai-access plate">
      <div className="ai-access-art instrument" aria-hidden><span className="ai-orbit-ring"/><span className="ai-orbit-core"><Users size={34}/></span>{aiRoles.map((r,i)=><span className="ai-orbit-node" key={r} style={{"--node":i} as React.CSSProperties}>{String(i+1).padStart(2,"0")}</span>)}</div>
      <div><h2>{t("ai.meet")}</h2><p className="muted">{t("ai.meetLede")}</p>
      {state?.configured?<form onSubmit={e=>{e.preventDefault();void perform({action:"unlock",payload:{code}}).then(()=>setCode("")).catch(()=>{});}}><Field name="ai-access" label={t("ai.code")} type="password" value={code} onChange={setCode} maxLength={256} autoComplete="current-password"/><button className="button primary" disabled={busy||!code} aria-busy={busy}>{busy?<Spinner/>:<LockKeyhole size={16} aria-hidden/>}{t("ai.unlock")}<ArrowRight size={16} aria-hidden/></button></form>:<p className="info-notice">{t("ai.notConfigured")}</p>}
      <p className="field-help">{t("ai.keyNote")}</p></div>
    </section>:<>
      {!composerVisible&&<div className="ai-new-question"><p className="field-help">{t("ai.reviewBelow")}</p><button className="button small" onClick={()=>setComposerOpen(true)}><Plus size={15} aria-hidden/>{t("ai.newQuestion")}</button></div>}
      {composerVisible&&<section className="ai-composer plate" id="ai-composer" aria-labelledby="brief-title">
        <div className="ai-composer-head"><div><h2 id="brief-title">{parent ? t("ai.buildOn") : t("ai.what")}</h2></div><span className="ai-model-tag">{copy("OpenAI · live agents")}</span></div>
        <form onSubmit={e=>{e.preventDefault();void start().catch(()=>{});}}>
          <Field name="ai-brief" label={t("ai.brief")} textarea value={brief} maxLength={6000} minRows={110} onChange={v=>{setBrief(v);setRequestId(null);}} placeholder={t("ai.briefPh")} help={t("ai.briefHelp")}/>
          <div className="ai-mode-list" role="group" aria-label={t("ai.scope")}>{runModes.map(m=><button type="button" key={m} className={mode===m?"selected":""} aria-pressed={mode===m} disabled={busy||m==="review"&&!parent} onClick={()=>{setMode(m);setRequestId(null);}}>{m==="full"&&<Users size={14} aria-hidden/>}{tk(modes[m].label)}</button>)}</div>
          <div className="ai-composer-foot"><p className="field-help">{tk(modes[mode].description)}<br/>{t("ai.limits", { run: state.limits.runBudgetUsd, day: state.limits.dailyBudgetUsd })}</p><button className="button primary" disabled={busy||!!running||!state.configured} aria-busy={busy}>{busy?<Spinner/>:<Play size={15} aria-hidden/>}{running ? t("ai.inProgress") : t("ai.start")}<ArrowUpRight size={16} aria-hidden/></button></div>
          {parent&&<p className="ai-followup-tag">{t("ai.followingUp")} <button type="button" className="text-link" onClick={()=>{setParent(null);if(mode==="review")setMode("full");}}>{t("ai.clear")}</button></p>}
        </form>
      </section>}
      {state.runs.length>0&&<div className="ai-run-toolbar"><label>{t("ai.run")} <select aria-label={t("ai.run")} value={run?.id} onChange={e=>selectRun(e.target.value)}>{state.runs.map((r,i)=><option key={r.id} value={r.id}>{i===0?`${t("ai.latest")} · `:""}{tk(modes[r.mode].label)} · {new Date(r.createdAt).toLocaleString()} · {tk(statusText[r.status])}</option>)}</select></label><span className="field-help">{t("ai.historyStays")}</span></div>}
      {!run&&<AnalysisBoard state={state} busy={busy} mutate={perform} onReview={(s,target)=>{setPlanPreview(null);setReview({step:s,target});}} onObserve={ids=>{setEvidenceTargets(ids);setEvidenceOpen(true);}}/>}
      {run&&<>
        <section className="ai-console instrument" aria-label={t("ai.progress")}>
          <div className="ai-console-heading"><div><span className={`ai-live-light ${run.status}`} aria-hidden/><span role="status">{tk(statusText[run.status])}</span><span className="ai-console-mode">{tk(modes[run.mode].label)}</span></div><div className="ai-run-controls">{active(run)&&<><button className="button small" disabled={busy} onClick={()=>void perform({action:"resume",runId:run.id}).catch(()=>{})}><Play size={13} aria-hidden/>{run.status==="paused"?t("ai.resume"):t("ai.recover")}</button><button className="button small ghost" disabled={busy} onClick={()=>void perform({action:"cancel",runId:run.id}).catch(()=>{})}><Square size={12} aria-hidden/>{t("common.cancel")}</button></>}{!active(run)&&<button className="button small" onClick={followUp}>{t("ai.followUp")}<ArrowRight size={14} aria-hidden/></button>}</div></div>
          <div className="ai-sequence" role="group" aria-label={t("ai.results")}>{modeRoles[run.mode].map((r,i)=>{const s=mostRecent(run.steps,r);return <button key={r} type="button" onClick={()=>chooseRole(r)} className={`ai-stage ${role===r?"selected":""} ${s?.status||"queued"}`} aria-pressed={role===r}><span className="ai-stage-number">{s?.status==="completed"?<Check size={16} aria-hidden/>:s?.status==="running"?<span className="ai-stage-pulse"/>:String(i+1).padStart(2,"0")}</span><span>{tk(`ai.role.${r}`, undefined, agentCatalog[r].short)}<small>{s?.round?`${t("ai.revised")} · `:""}{tk(`ai.step.${s?.status||"queued"}`)}</small></span></button>;})}</div>
          <div className="ai-telemetry"><span>{copy(run.events.at(-1)?.message||t("ai.waiting"))}</span><span className="num">{(run.inputTokens+run.outputTokens).toLocaleString()}  {copy("tokens · ≈")} {money(run.estimatedMicros)}</span></div>
        </section>
        {run.stale&&<p className="info-notice"><CircleDashed size={16} aria-hidden/>{t("ai.stale")}</p>}
        {run.error&&<ErrorNotice error={copy(run.error)}/>}
        <AiInsightsPanel run={run}/>
        <AnalysisBoard state={state} run={run} busy={busy} mutate={perform} onReview={(s,target)=>{setPlanPreview(null);setReview({step:s,target});}} onObserve={ids=>{setEvidenceTargets(ids);setEvidenceOpen(true);}}/>
        <details className="ai-specialist-details" id="ai-specialist-proposals"><summary>{t("ai.proposals")}</summary>
        <div className="ai-workbench">
          <section className="ai-artifact plate" aria-labelledby="artifact-title">
            <div className="ai-artifact-heading"><div><p className="eyebrow">{t(`agent.${role}.name`)}{step?.round?` · ${t("ai.revised")}`:""}</p><h2 id="artifact-title" tabIndex={-1}>{step?.result?.title||t(`agent.${role}.desc`)}</h2></div><span className="ai-role-index">{String(aiRoles.indexOf(role)+1).padStart(2,"0")}</span></div>
            {step?.result?<Artifact result={step.result} sources={run.sources}/>:<div className="ai-waiting">{step?.status==="running"?<><Spinner/><p>{copy("This specialist is working with your brief.")}</p></>:step?.status==="failed"?<p>{copy(step.error||"")}</p>:<><CircleDashed size={32} aria-hidden/><p>{copy(step?"This role starts after its dependencies are ready.":"This specialist is outside the selected scope.")}</p></>}<p className="field-help">{copy("Only completed, persisted results appear here.")}</p></div>}
            {step?.result&&<div className="ai-proposal-actions">{roleSections[role].filter(k=>step.result?.strategy[k]).map(target=>{const applied=run.applications.some(a=>a.stepId===step.id&&a.target===target);return <button key={target} className="button small" disabled={busy||run.stale||active(run)||applied||run.status==="failed"||run.status==="cancelled"} onClick={()=>{setPlanPreview(null);setReview({step,target});}}>{applied?<Check size={14} aria-hidden/>:<Search size={14} aria-hidden/>}{applied ? t("ai.applied") : `${t("ai.review")}: ${t(`section.${target}`)}`}</button>;})}
            {role==="experimenter"&&step.result.experiments.length>0&&<button className="button primary small" disabled={busy||run.stale||active(run)||run.status==="failed"||run.status==="cancelled"||run.applications.some(a=>a.stepId===step.id&&a.target==="roadmap")} onClick={()=>{setPlanPreview(null);setReview({step,target:"roadmap"});}}><FlaskConical size={15} aria-hidden/>{run.applications.some(a=>a.stepId===step.id&&a.target==="roadmap") ? t("ai.planApplied") : t("ai.reviewPlan")}</button>}</div>}
          </section>
          <aside className="ai-side-notes">
            <section className="ai-side-section"><h3>{t("ai.gate")}</h3>{mostRecent(run.steps,"critic")?.result?<>{mostRecent(run.steps,"critic")!.result!.issues.length?mostRecent(run.steps,"critic")!.result!.issues.map((issue,i)=><div key={i} className={`ai-issue ${issue.severity}`}><span>{issue.severity} · {agentCatalog[issue.target].short}</span><h4>{issue.topic}</h4><p>{issue.reason}</p><p className="field-help">{copy("Next:")} {issue.correction}</p></div>):<p className="muted">{t("ai.noIssues")}</p>}</>:<p className="muted">{t("ai.criticChecks")}</p>}<p className="field-help">{t("ai.oneRound")}</p></section>
            <details className="ai-side-section"><summary>{t("ai.sources")} <span className="num">{run.sources.length}</span><ChevronDown size={14} aria-hidden/></summary>{run.sources.length?<ol className="ai-source-ledger">{run.sources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}<ArrowUpRight size={12} aria-hidden/><span className="sr-only">  {copy("(opens in a new tab)")}</span></a><small>{new URL(s.url).hostname}  {copy("· retrieved")} {s.accessedAt.slice(0,10)}</small></li>)}</ol>:<p className="field-help">{t("ai.noSources")}</p>}</details>
            <details className="ai-side-section"><summary>{t("ai.journal")}<ChevronDown size={14} aria-hidden/></summary><ol className="ai-journal">{run.events.map(e=><li key={e.seq}><time>{e.createdAt.slice(11,19)}  {copy("UTC")}</time><p>{copy(e.message)}</p></li>)}</ol><p className="field-help">{step?.model}  {copy("· usage estimate at configured model rates; provider billing may differ.")}</p></details>
            <div className="ai-side-section"><Link className="text-link" href={`/startups/${workspace.startup.id}/strategy`}>{t("ov.openStrategy")}<ArrowUpRight size={14} aria-hidden/></Link><br/><Link className="text-link" href={`/startups/${workspace.startup.id}/roadmap`}>{t("ov.openRoadmap")}<ArrowUpRight size={14} aria-hidden/></Link></div>
          </aside>
        </div>
        </details>
      </>}
      {!run&&<div className="ai-first-run"><ShieldCheck size={22} aria-hidden/><p><strong>{t("ai.boundaries")}</strong> {t("ai.boundariesText")}</p></div>}
      <section className="ai-observations plate" aria-labelledby="observations-title"><div className="plate-head"><div><h2 id="observations-title">{t("ai.realWorld")}</h2></div><button className="button small" onClick={()=>setEvidenceOpen(true)}><Plus size={15} aria-hidden/>{t("ai.record")}</button></div><p className="muted">{t("ai.realWorldText")}</p>
        {state.evidence.length?<ul className="ai-evidence-list">{[...state.evidence].reverse().map(e=><li key={e.id}><span className="ai-evidence-type">{copy(e.kind)} · {copy(e.interpretation)}</span><p>{e.observation}</p><small>{e.observedOn} · {e.method}{e.sampleSize?` · n=${e.sampleSize}`:""}</small>{e.limitations&&<p className="field-help">{copy("Limitations:")} {e.limitations}</p>}{e.sourceUrl&&<a href={e.sourceUrl} className="text-link" target="_blank" rel="noopener noreferrer">{copy("Founder-provided reference")}<ArrowUpRight size={12} aria-hidden/></a>}</li>)}</ul>:<p className="field-help">{t("ai.noObservations")}</p>}
      </section>
      <Dialog open={!!review} onClose={()=>{if(!busy)setReview(null);}} title={review?.target==="roadmap" ? t("ai.reviewPlan") : `${t("ai.review")}: ${review ? t(`section.${review.target as SectionKey}`) : ""}`} locked={busy} className="ai-review-dialog">
        {review&&<div className="ai-review-body"><p className="muted">{t("ai.applyNote")}</p>{review.target==="roadmap"&&run?<PlanReview endpoint={endpoint} runId={run.id} step={review.step} workspace={workspace} onPreview={setPlanPreview} busy={busy}/>:review.target!=="roadmap"?<div className="ai-comparison"><div><h3>{t("ai.savedNow")}</h3><StrategyFields data={workspace.sections.find(s=>s.key===review.target)!.data}/></div><div><h3>{t("ai.proposed")}</h3><StrategyFields data={review.step.result!.strategy[review.target]!}/></div></div>:null}
        <ErrorNotice error={error}/><div className="ai-review-foot"><button className="button primary" disabled={busy||!!run?.stale||review.target==="roadmap"&&!planPreview?.ready} onClick={()=>void apply().catch(()=>{})}>{busy?<Spinner/>:<Check size={15} aria-hidden/>}{review.target==="roadmap" ? t("ai.applyPlan") : t("ai.applyProposal")}</button><button className="button ghost" disabled={busy} onClick={()=>setReview(null)}>{t("ai.keep")}</button></div></div>}
      </Dialog>
      {evidenceOpen&&<EvidenceDialog open onClose={()=>{setEvidenceOpen(false);setEvidenceTargets([]);}} workspace={workspace} memory={state.memory||[]} initialTargets={evidenceTargets} onSave={async input=>{await perform({action:"evidence",payload:input},t("ai.observed"));setEvidenceOpen(false);setEvidenceTargets([]);}}/>}
    </>}
  </div>;
}

function Artifact({result,sources}:{result:AiResult;sources:AiSource[]}) {
  const copy=useAnalysisCopy();
  return <motion.div className="ai-artifact-content" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{duration:.25}}>
    <p className="ai-summary">{result.summary}</p>
    {!!result.recommendations.length&&<div className="ai-recommendations">{result.recommendations.map((r,i)=><article key={i}><span className="ai-rec-index">{String(i+1).padStart(2,"0")}</span><div><h3>{r.title}</h3><p>{r.detail}</p><SourceLinks urls={r.sourceUrls} sources={sources}/>{!!r.tradeoffs.length&&<p className="ai-tradeoff"><strong>{copy("Tradeoff")}</strong> {r.tradeoffs.join(" ")}</p>}<p className="ai-next-test"><FlaskConical size={14} aria-hidden/><span>{r.nextTest}</span></p></div></article>)}</div>}
    {!!result.experiments.length&&<ExperimentList experiments={result.experiments}/>}
    {!!result.claims.length&&<details className="ai-claims"><summary>{copy("Evidence & assumptions")} <span className="num">{result.claims.length}</span></summary>{result.claims.map((c,i)=><div key={i} className="ai-claim"><span className={`ai-claim-kind ${c.kind}`}>{c.kind.replaceAll("_"," ")}</span><p>{c.statement}</p><SourceLinks urls={c.sourceUrls} sources={sources}/>{c.limitation&&<p className="field-help">{c.limitation}</p>}</div>)}</details>}
    {!!result.questions.length&&<section className="ai-questions"><h3>{copy("What would change the decision?")}</h3>{result.questions.map((q,i)=><div key={i}><p>{q.question}</p><small>{q.why}</small></div>)}</section>}
    {!!result.issues.length&&<section className="ai-inline-issues"><h3>{copy("Review notes")}</h3>{result.issues.map((i,j)=><div key={j} className={`ai-issue ${i.severity}`}><span>{i.severity} · {agentCatalog[i.target].short}</span><h4>{i.topic}</h4><p>{i.reason}</p><p className="field-help">{i.correction}</p></div>)}</section>}
  </motion.div>;
}
function ExperimentList({experiments}:{experiments:AiResult["experiments"]}) {
  const copy=useAnalysisCopy();
  return <ol className="ai-experiments">{experiments.map((e,i)=><li key={i}><span className="ai-experiment-week">W{e.week}</span><div><h3>{e.title}</h3><p>{e.hypothesis}</p><p className="muted">{e.method}</p><dl><div><dt>{copy("Deliverable")}</dt><dd>{e.deliverable}</dd></div><div><dt>{copy("Measure")}</dt><dd>{e.metric}</dd></div><div><dt>{copy("Decide when")}</dt><dd>{e.threshold}</dd></div><div><dt>{copy("Effort")}</dt><dd>{e.effort}</dd></div>{!!e.dependencies.length&&<div><dt>{copy("Depends on")}</dt><dd>{e.dependencies.join(" · ")}</dd></div>}</dl></div></li>)}</ol>;
}
function StrategyFields({data}:{data:StrategyData}) {
  const render=(v:unknown):string=>Array.isArray(v)?v.map(x=>typeof x==="object"&&x?Object.values(x).join(" · "):String(x)).join("\n\n"):String(v||"Not yet recorded");
  return <dl className="ai-strategy-fields">{Object.entries(data).map(([key,value])=><div key={key}><dt>{key.replace(/([A-Z])/g," $1")}</dt><dd>{render(value)}</dd></div>)}</dl>;
}
function EvidenceDialog({open,onClose,workspace,onSave,memory,initialTargets}:{open:boolean;onClose:()=>void;workspace:Workspace;memory:MemoryItem[];initialTargets:string[];onSave:(input:Omit<AiEvidence,"id"|"createdAt">)=>Promise<void>}) {
  const copy=useAnalysisCopy();
  const [attempt,setAttempt]=useState<{signature:string;id:string}|null>(null);
  const [observation,setObservation]=useState("");const [method,setMethod]=useState("");const [limitations,setLimitations]=useState("");const [kind,setKind]=useState<AiEvidence["kind"]>("interview");const [interpretation,setInterpretation]=useState<AiEvidence["interpretation"]>("inconclusive");const [taskId,setTaskId]=useState("");const [sample,setSample]=useState("");const [date,setDate]=useState(localDate);const [source,setSource]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState<Error|null>(null);
  const [hypothesisIds,setHypothesisIds]=useState(initialTargets);
  const [baseline]=useState(()=>JSON.stringify({observation:"",method:"",limitations:"",kind:"interview",interpretation:"inconclusive",taskId:"",sample:"",date:localDate(),source:"",hypothesisIds:initialTargets}));
  const dirty=JSON.stringify({observation,method,limitations,kind,interpretation,taskId,sample,date,source,hypothesisIds})!==baseline,draftKey=`ai-evidence:${workspace.startup.id}`;
  const draft={observation,method,limitations,kind,interpretation,taskId,sample,date,source,hypothesisIds,attempt};
  useDirtyGuard(dirty);
  useDraftRecovery(draftKey,draft,dirty,value=>{const d=z.object({observation:z.string(),method:z.string(),limitations:z.string(),kind:z.enum(["interview","commitment","payment","analytics","other"]),interpretation:z.enum(["inconclusive","supports","contradicts"]),taskId:z.string(),sample:z.string(),date:z.string(),source:z.string(),hypothesisIds:z.array(z.uuid()),attempt:z.object({signature:z.string(),id:z.uuid()}).nullable()}).parse(value);setObservation(d.observation);setMethod(d.method);setLimitations(d.limitations);setKind(d.kind);setInterpretation(d.interpretation);setTaskId(d.taskId);setSample(d.sample);setDate(d.date);setSource(d.source);setHypothesisIds(d.hypothesisIds);setAttempt(d.attempt);});
  return <Dialog open={open} onClose={()=>{if(!dirty||window.confirm("Discard this unsaved observation?")){clearDraft(draftKey);onClose();}}} title={copy("Record an observation")} locked={busy}><form onSubmit={e=>{e.preventDefault();setBusy(true);setError(null);const payload={taskId:taskId||null,kind,observation,interpretation,sampleSize:sample?Number(sample):null,sourceUrl:source,method,observedOn:date,limitations,hypothesisIds};const signature=JSON.stringify(payload);const currentAttempt=attempt?.signature===signature?attempt:{signature,id:crypto.randomUUID()};setAttempt(currentAttempt);const submitted={...draft,attempt:currentAttempt};void onSave({...payload,requestId:currentAttempt.id}).then(()=>{clearSubmittedDraft(draftKey,submitted);setAttempt(null);setObservation("");setMethod("");setLimitations("");setSource("");setSample("");}).catch(setError).finally(()=>setBusy(false));}}><fieldset disabled={busy} className="ai-evidence-form">
    <p className="muted">{copy("Record what you observed separately from what you believe it means. User-reported payments are not independently verified transactions.")}</p>
    <label>{copy("Related task")}<select value={taskId} onChange={e=>setTaskId(e.target.value)}><option value="">{copy("General observation")}</option>{workspace.tasks.map(t=><option key={t.id} value={t.id}>{t.title}{t.archived?" (history)":""}</option>)}</select></label>
    <fieldset className="analysis-evidence-targets"><legend>{copy("Which hypotheses does this bear on?")}</legend>{memory.filter(m=>m.data.kind==="hypothesis"&&m.status!=="superseded").map(m=><label key={m.id} className="plan-checkbox"><input type="checkbox" checked={hypothesisIds.includes(m.id)} onChange={e=>setHypothesisIds(e.target.checked?[...hypothesisIds,m.id]:hypothesisIds.filter(id=>id!==m.id))}/>{m.data.kind==="hypothesis"?m.data.proposal.statement:""}</label>)}{!memory.some(m=>m.data.kind==="hypothesis")&&<p className="field-help">{copy("No hypotheses recorded yet. You may save a general observation.")}</p>}</fieldset>
    <div className="ai-form-pair"><label>{copy("Evidence type")}<select value={kind} onChange={e=>setKind(e.target.value as AiEvidence["kind"])}>{["interview","commitment","payment","analytics","other"].map(v=><option key={v} value={v}>{copy(v)}</option>)}</select></label><label>{copy("Interpretation")}<select value={interpretation} onChange={e=>setInterpretation(e.target.value as AiEvidence["interpretation"])}>{["inconclusive","supports","contradicts"].map(v=><option key={v} value={v}>{copy(v)}</option>)}</select></label></div>
    <Field name="observation" label={copy("What happened?")} required value={observation} onChange={setObservation} textarea maxLength={5000} help="Specific behavior, a quote or a measured outcome. Minimum 10 characters."/>
    <Field name="evidence-method" label={copy("How was it observed?")} required value={method} onChange={setMethod} maxLength={1000}/>
    <div className="ai-form-pair"><Field name="evidence-date" label={copy("Observation date")} type="date" value={date} onChange={setDate}/><Field name="sample-size" label={copy("Sample size (optional)")} type="number" value={sample} onChange={setSample}/></div>
    <Field name="evidence-url" label={copy("Reference URL (optional)")} type="url" value={source} onChange={setSource}/><Field name="evidence-limitations" label={copy("Limitations & context")} value={limitations} onChange={setLimitations} textarea maxLength={1500} help="Selection bias, missing data, what this does not establish."/>
    <ErrorNotice error={error}/><button className="button primary" disabled={busy||observation.trim().length<10||method.trim().length<3||!date}>{busy?<Spinner/>:<Check size={15} aria-hidden/>}{copy("Save observation")}</button>
  </fieldset></form></Dialog>;
}
