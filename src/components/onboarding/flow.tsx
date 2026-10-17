"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, MotionConfig } from "motion/react";
import { ArrowLeft, ArrowRight, Check, ListChecks, MessagesSquare, SkipForward } from "lucide-react";
import type { Startup } from "@/lib/domain/types";
import { ProfileForm, type ProfileSeed } from "../profile-form";
import { useHydrated } from "../ui";
import { answer, emptyDraft, extract, missing, nextQuestion, nextIntakeQuestion, type IntakeDraft, type Question } from "../intake/extract";
import { FileAttach, type Attached } from "./files";
import { GuidedBrief, guidedToDraft, emptyGuided, type GuidedState } from "./guided";
import { LaunchSequence } from "./launch";
import { api } from "@/lib/client-api";
import { attachmentSchema, intakeDraftSchema, intakeRecordSchema, type IntakeRecord } from "@/lib/domain/intake-api";
import { startupInputSchema } from "@/lib/domain/schemas";
import { z } from "zod";

type Step = "choose" | "free" | "interpret" | "clarify" | "guided" | "confirm" | "launch";
type Saved = { step: Step; path: "free" | "guided" | null; text: string; files: Attached[]; asked: string[]; answers: { q: string; a: string }[]; draft: IntakeDraft; guided: GuidedState;
  sessionId:string; creationRequestId:string; created:Startup|null; pending:Record<string,{value:string;multi:string[]}>; guidedTopic:number; runAi:boolean;
  intake?:IntakeRecord; intakeAttempt?:{requestId:string;materialKey:string}; intakeMaterialKey?:string;intakeAdvance?:boolean;answerMaterialKey?:string;
};
const storeKey = "orbit:onboarding:v1";
const ease = [0.22, 1, 0.36, 1] as const;
const initial: Saved = { step: "choose", path: null, text: "", files: [], asked: [], answers: [], draft: emptyDraft(), guided: emptyGuided,sessionId:"",creationRequestId:"",created:null,pending:{},guidedTopic:0,runAi:false };
const materialKey=(text:string,files:Attached[])=>{let h=2166136261;for(const c of JSON.stringify([text,files])){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);};
const analysisOf=(s:Saved)=>s.path==="guided"?`Founder guided answers:\n${JSON.stringify(s.guided)}`:s.text;
function draftOf(s:Saved):IntakeDraft{
  const key=materialKey(analysisOf(s),s.files), interpretation=s.intakeMaterialKey===key&&s.intake?.status==="completed"?s.intake.draft:null;
  const text=interpretation??extract(s.text),files=extract(s.files.filter(f=>f.kind==="text").map(f=>f.text).join("\n\n"));
  let d=s.path==="guided"?guidedToDraft(s.guided):emptyDraft();
  for(const field of Object.keys(d.profile) as (keyof IntakeDraft["profile"])[]){const value=d.profile[field]||(interpretation?text.profile[field]:text.profile[field]||files.profile[field]);(d.profile as Record<string,string>)[field]=value;if(value&&!d.origin[field])d.origin[field]=interpretation?"ai":text.profile[field]?"text":"file";}
  for(const field of ["painPoint","outcome","price","pricingModel"] as const){const value=d.hints[field]||(interpretation?text.hints[field]:text.hints[field]||files.hints[field]);d.hints[field]=value;if(value&&!d.origin[field])d.origin[field]=interpretation?"ai":text.hints[field]?"text":"file";}
  if(!d.hints.channels.length)d.hints.channels=interpretation?text.hints.channels:text.hints.channels.length?text.hints.channels:files.hints.channels;
  for(const [field,origin] of Object.entries(s.draft.origin))if(origin==="answer"&&(!s.answerMaterialKey||s.answerMaterialKey===key))d=answer(d,field as Question["field"],field==="channels"?s.draft.hints.channels:field in s.draft.profile?(s.draft.profile as Record<string,string>)[field]:(s.draft.hints as unknown as Record<string,string>)[field]);
  return d;
}
function advanceReady(s:Saved):Saved{
  if(s.step!=="interpret"||!s.intakeAdvance||s.intake?.status!=="completed"||s.intakeMaterialKey!==materialKey(analysisOf(s),s.files))return s;
  const draft=draftOf(s),question=nextIntakeQuestion(draft,s.asked,s.intake.questions||[]);
  return {...s,intakeAdvance:false,draft,step:question?"clarify":"confirm"};
}
function restore(raw:string|null):Saved {
  try {
    const v=raw?JSON.parse(raw):{};
    if(!v||typeof v!=="object")throw new Error("invalid recovery");
    const recover=<T,>(schema:z.ZodType<T>,value:unknown,fallback:T):T=>{const p=schema.safeParse(value);return p.success?p.data:fallback;};
    const files=recover(z.array(attachmentSchema).max(3),v.files,[]);
    const p=startupInputSchema.safeParse(v.created?Object.fromEntries(Object.entries(v.created).filter(([k])=>!['id','revision','createdAt','updatedAt'].includes(k))):null);
    const created=p.success&&z.uuid().safeParse(v.created?.id).success?{...v.created,...p.data} as Startup:null;
    const step=recover(z.enum(['choose','free','interpret','clarify','guided','confirm','launch']),v.step,'choose');
    const guidedShape=Object.fromEntries(Object.entries(emptyGuided).map(([k,val])=>[k,Array.isArray(val)?z.array(z.string().max(200)).max(30):z.string().max(k==='price'?500:3000)]));
    const guided={...emptyGuided,...recover(z.object(guidedShape),v.guided,{})} as GuidedState;
    if(!['','B2B','B2C','B2G'].includes(guided.model))guided.model='';if(!['','Idea','MVP','Early Traction'].includes(guided.stage))guided.stage='';
    const saved:Saved={...initial,text:typeof v.text==='string'?v.text.slice(0,16000):"",files,created,step:step==='launch'&&!created?'confirm':step,path:recover(z.enum(['free','guided']).nullable(),v.path,null),runAi:v.runAi===true,
      sessionId:z.uuid().safeParse(v.sessionId).success?v.sessionId:crypto.randomUUID(),creationRequestId:z.uuid().safeParse(v.creationRequestId).success?v.creationRequestId:crypto.randomUUID(),
      asked:recover(z.array(z.string().max(40)).max(7),v.asked,[]),answers:recover(z.array(z.object({q:z.string().max(500),a:z.string().max(3000)})).max(7),v.answers,[]),
      draft:recover(intakeDraftSchema,v.draft,emptyDraft()),guided,pending:recover(z.record(z.string().max(40),z.object({value:z.string().max(3000),multi:z.array(z.string().max(120)).max(3)})),v.pending,{}),guidedTopic:Number.isInteger(v.guidedTopic)?Math.min(6,Math.max(0,v.guidedTopic)):0,
      intake:recover(intakeRecordSchema.optional(),v.intake,undefined) as IntakeRecord|undefined,intakeAttempt:recover(z.object({requestId:z.uuid(),materialKey:z.string().max(16)}).optional(),v.intakeAttempt,undefined),intakeMaterialKey:recover(z.string().max(16).optional(),v.intakeMaterialKey,undefined),intakeAdvance:v.intakeAdvance===true,answerMaterialKey:recover(z.string().max(16).optional(),v.answerMaterialKey,undefined)};
    saved.answerMaterialKey??=materialKey(analysisOf(saved),files);
    return advanceReady(saved);
  } catch { return {...initial,sessionId:crypto.randomUUID(),creationRequestId:crypto.randomUUID()}; }
}

/** Signals the free-form checklist looks for, in the order a founder usually tells the story. */
const checklist: { key: string; label: string; ok: (d: IntakeDraft) => boolean }[] = [
  { key: "name", label: "Name", ok: d => !!d.profile.name },
  { key: "what", label: "What you build", ok: d => !!d.profile.description },
  { key: "who", label: "Who has the problem", ok: d => !!d.profile.customerSegment },
  { key: "model", label: "Who pays", ok: d => !!d.profile.businessModel },
  { key: "where", label: "Where you start", ok: d => !!d.profile.targetMarket },
  { key: "stage", label: "How far along", ok: d => !!d.profile.stage },
  { key: "pain", label: "The pain, in their words", ok: d => !!d.hints.painPoint },
  { key: "price", label: "A price idea", ok: d => !!d.hints.price },
  { key: "channels", label: "Where customers are", ok: d => d.hints.channels.length > 0 },
];

export function OnboardingFlow() {
  const [s, setS] = useState<Saved>(initial);
  const [restored, setRestored] = useState(false);
  const [readingFiles,setReadingFiles]=useState(false);
  // Survive a refresh: everything except the created startup lives in this tab's storage.
  useEffect(() => {
    let raw: string | null = null;
    try { raw = sessionStorage.getItem(storeKey); } catch { /* fresh start */ }
    // Applied after mount so server and first client render match.
    void Promise.resolve().then(() => { setS(restore(raw)); setRestored(true); });
  }, []);
  useEffect(() => { if (restored) try { sessionStorage.setItem(storeKey, JSON.stringify(s)); } catch { /* memory only */ } }, [s, restored]);
  const go = (step: Step) => { if(readingFiles)return;setS(c => ({ ...c, step })); window.scrollTo({ top: 0 }); };
  useEffect(()=>{if(!restored)return;const frame=requestAnimationFrame(()=>(document.querySelector<HTMLElement>(s.step==="clarify"?"#clarify-input":s.step==="free"?"#free-text":"main h1")??document.querySelector<HTMLElement>("main h1"))?.focus({preventScroll:true}));return()=>cancelAnimationFrame(frame);},[s.step,restored]);
  const patch = (p: Partial<Saved>) => setS(c => ({ ...c, ...p }));
  const [access,setAccess]=useState<{configured:boolean;authorized:boolean}|null>(null);
  const [code,setCode]=useState("");const [showUnlock,setShowUnlock]=useState(false);const [aiError,setAiError]=useState("");const [analyzing,setAnalyzing]=useState(false);
  const checkAccess=()=>{setAiError("");return api<{configured:boolean;authorized:boolean}>("/api/intake").then(setAccess).catch(err=>setAiError(`AI access could not be checked. ${(err as Error).message}`));};
  useEffect(()=>{void api<{configured:boolean;authorized:boolean}>("/api/intake").then(setAccess).catch(err=>setAiError(`AI access could not be checked. ${(err as Error).message}`));},[]);
  const persist=(next:Saved)=>{setS(next);try{sessionStorage.setItem(storeKey,JSON.stringify(next));}catch{/* in memory */}};
  const analysisText=analysisOf(s);
  const key=materialKey(analysisText,s.files);
  async function analyze(newAttempt=false,unlocked=false){
    if(analyzing)return;setAiError("");
    if(!access?.authorized&&!unlocked){setShowUnlock(true);return;}
    const attempt=!newAttempt&&s.intakeAttempt?.materialKey===key?s.intakeAttempt:{requestId:crypto.randomUUID(),materialKey:key};
    persist({...s,...(s.answerMaterialKey&&s.answerMaterialKey!==key?{asked:[],answers:[],pending:{},draft:emptyDraft()}:{}),answerMaterialKey:key,step:"interpret",runAi:true,intakeAdvance:true,intakeAttempt:attempt});setAnalyzing(true);
    try{const result=await api<IntakeRecord>("/api/intake",{method:"POST",body:JSON.stringify({action:"analyze",payload:{requestId:attempt.requestId,text:analysisText,files:s.files}})});setS(c=>advanceReady({...c,intake:result,intakeMaterialKey:attempt.materialKey}));}
    catch(err){setAiError((err as Error).message);}finally{setAnalyzing(false);}
  }
  useEffect(()=>{
    const record=s.intake;if(!record||!["queued","running"].includes(record.status))return;
    let alive=true;const timer=setInterval(()=>{void api<IntakeRecord>(`/api/intake?id=${record.id}`).then(r=>{if(alive)setS(c=>c.intake?.id===r.id?advanceReady({...c,intake:r}):c);}).catch(err=>{if(alive)setAiError((err as Error).message);});},2500);
    return()=>{alive=false;clearInterval(timer);};
  },[s.intake?.id,s.intake?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const fileText = s.files.filter(f => f.kind === "text").map(f => f.text).join("\n\n");
  const freeDraft = useMemo(()=>draftOf(s),[s]);
  const draft = freeDraft;
  const question = nextIntakeQuestion(freeDraft,s.asked,s.runAi&&s.intakeMaterialKey===key&&s.intake?.status==="completed"?s.intake.questions||[]:[]);
  function toConfirm() { patch({ draft: freeDraft,intakeAdvance:false }); go("confirm"); }
  function manualContinue(){const changed=!!s.answerMaterialKey&&s.answerMaterialKey!==key;patch({runAi:false,intakeAdvance:false,draft:freeDraft,answerMaterialKey:key,...(changed?{asked:[],answers:[],pending:{}}:{})});go(nextQuestion(freeDraft,changed?[]:s.asked)?"clarify":"confirm");}
  function prepareAi(){patch({runAi:true,intakeAdvance:true});go("interpret");void(async()=>{try{const flags=access??await api<{configured:boolean;authorized:boolean}>("/api/intake");setAccess(flags);if(flags.configured)await analyze(false,flags.authorized);}catch(err){setAiError(`AI access could not be checked. ${(err as Error).message}`);}})();}
  const seed: ProfileSeed = useMemo(() => {
    const p = draft.profile;
    const custom: Record<string, string> = {};
    if (s.path === "guided") {
      if (s.guided.types.length) custom["Business type"] = s.guided.types.map(t => t === "Other" && s.guided.otherType.trim() ? s.guided.otherType.trim() : t).join(", ");
      if (s.guided.signals.length) custom["Stage signals"] = s.guided.signals.join(", ");
    }
    return { name: p.name, description: p.description, businessModel: p.businessModel || undefined, stage: p.stage || undefined, targetMarket: p.targetMarket, customerSegment: p.customerSegment, websiteUrl: p.websiteUrl,
      context: s.path === "free" ? s.text.slice(0, 5000) : "", customFields: custom } as ProfileSeed;
  }, [draft, s.path, s.guided, s.text]);

  return <MotionConfig reducedMotion="user"><div className="flow">
      <motion.div key={s.step} className="flow-step" initial={false} animate={{opacity:1,y:0}} transition={{duration:0.14,ease}}>
        {s.step === "choose" && <Choose onPick={path => { patch({ path }); go(path === "free" ? "free" : "guided"); }}/>}

        {s.step === "free" && <section className="flow-panel" aria-labelledby="free-title">
          <Back onClick={() => go("choose")}/>
          <p className="eyebrow">Free form</p>
          <h1 id="free-title" tabIndex={-1}>Tell us about your startup.</h1>
          <p className="lead">Write it the way you would explain it to a cofounder. Order doesn’t matter; half-sentences are fine.</p>
          <div className="compose">
            <div className="compose-main">
              <label className="sr-only" htmlFor="free-text">Your startup in your own words</label>
              <textarea id="free-text" className="compose-text" value={s.text} onChange={e => patch({ text: e.target.value })} autoFocus maxLength={16000}
                placeholder={"Fieldnote helps founders of small B2B SaaS teams turn customer interviews into product decisions.\nRight now notes are scattered across docs and calls…\nWe have an MVP and three pilot teams in Kazakhstan. Thinking $29 per workspace a month."}/>
              <FileAttach files={s.files} onChange={files => patch({ files })} onReading={setReadingFiles}/>
            </div>
            <aside className="compose-side" aria-label="What we picked up">
              <p className="label">Picked up <span className="faint">· {s.intakeMaterialKey===key&&s.intake?.status==="completed"?"AI interpretation; confirm below":"rules, not AI"}</span></p>
              <ul className="pickup">{checklist.map(c => { const ok = c.ok(freeDraft); return <li key={c.key} className={ok ? "ok" : ""}>
                <span className="pickup-dot" aria-hidden>{ok && <Check size={11} strokeWidth={3}/>}</span>{c.label}<span className="sr-only">{ok ? ": found" : ": not yet"}</span></li>; })}</ul>
              <p className="field-help">Anything still missing is asked next — {question ? "a few short questions" : "nothing left to ask"}.</p>
            </aside>
          </div>
          <div className="flow-actions">
            <button type="button" className="button primary" disabled={readingFiles||s.text.trim().length < 20 && !fileText} onClick={prepareAi}>Continue with AI<ArrowRight size={17} aria-hidden className="arrow"/></button>
            <button type="button" className="button ghost" disabled={readingFiles||s.text.trim().length < 20 && !fileText} onClick={manualContinue}>Continue without AI</button>
            <span className="field-help">{s.text.trim().length < 20 && !fileText ? "A couple of sentences is enough to start." : ""}</span>
          </div>
          <p className="field-help">AI reads your brief and asks only relevant unanswered questions. It sends text and readable attachment extracts to OpenAI and uses credits. The local reader is available without AI.</p>
        </section>}

        {s.step === "interpret" && <section className="flow-panel narrow" aria-labelledby="interpret-title">
          <Back onClick={()=>{patch({intakeAdvance:false});go(s.path==="guided"?"guided":"free");}}/>
          <p className="eyebrow">Your brief · AI discovery</p>
          <h1 id="interpret-title" tabIndex={-1}>{s.intakeMaterialKey===key&&["queued","running"].includes(s.intake?.status||"")?"Reading your startup brief…":"Let’s understand your startup."}</h1>
          <p className="lead">We read your actual words and material, identify what matters for this case and ask only what remains unanswered.</p>
          {(aiError||s.intakeMaterialKey===key&&s.intake?.error)&&<p className="field-error" role="alert">{aiError||s.intake?.error}</p>}
          {!access&&<div><p role="status">{aiError?"The AI connection has not been checked.":"Checking AI access…"}</p><button className="button" onClick={()=>void checkAccess()}>Retry AI connection</button></div>}
          {access&&!access.configured&&<p className="info-notice">AI is unavailable on this deployment. Your brief is retained. Configure OpenAI on the server or continue without AI.</p>}
          {access?.configured&&(!access.authorized||showUnlock)&&<form className="unlock" onSubmit={async e=>{e.preventDefault();setAiError("");try{await api("/api/intake",{method:"POST",body:JSON.stringify({action:"unlock",payload:{code}})});setAccess({configured:true,authorized:true});setShowUnlock(false);setCode("");await analyze(false,true);}catch(err){setAiError((err as Error).message);}}}><label htmlFor="intake-code">Owner access code</label><input id="intake-code" className="input" type="password" autoComplete="current-password" value={code} onChange={e=>setCode(e.target.value)}/><button className="button" disabled={!code||analyzing}>Unlock and analyze</button></form>}
          {access?.authorized&&<>
            {s.intakeMaterialKey===key&&["queued","running"].includes(s.intake?.status||"")?<p role="status">{s.intake?.status==="queued"?"Brief saved; waiting for the AI reader.":"AI is extracting facts and writing case-specific questions."} You can leave this page; the analysis is saved.</p>:<button className="button primary" disabled={analyzing} onClick={()=>void analyze(s.intakeMaterialKey===key&&s.intake?.status==="failed")}>{analyzing?"Sending your brief…":s.intakeMaterialKey===key&&s.intake?.status==="failed"?"Start a new paid interpretation":"Analyze my brief"}</button>}
            {s.intakeMaterialKey===key&&s.intake?.status==="queued"&&<button className="button small" disabled={analyzing} onClick={()=>void analyze()}>Recover saved interpretation</button>}
          </>}
          <p className="field-help">This analysis uses OpenAI credits. The server keeps the API key. AI work and documents require owner access; confirmed public demo fields remain editable by link.</p>
          <button className="text-link" onClick={manualContinue}>Continue without AI</button>
        </section>}

        {s.step === "clarify" && <Clarify ai={s.runAi} draft={freeDraft} asked={s.asked} answers={s.answers} question={question} pending={s.pending} onPending={(id,value)=>patch({pending:{...s.pending,[id]:value}})}
          onBack={() => go(s.path==="guided"?"guided":"free")} onDone={toConfirm}
          onAnswer={(q, value) => {
            const asked = [...s.asked, q.id];
            const nextDraft = value === null ? s.draft : answer(s.draft, q.field, value);
            const merged = value === null ? freeDraft : answer(freeDraft, q.field, value);
            setS(c => ({ ...c, asked, answers: value === null ? c.answers : [...c.answers, { q: q.text, a: Array.isArray(value) ? value.join(", ") : value }], draft: nextDraft }));
            // Nothing left to ask: go straight to the confirmation, no extra screen.
            if (!nextIntakeQuestion(merged,asked,s.runAi?s.intake?.questions||[]:[])) { setS(c => ({ ...c, draft: merged })); go("confirm"); }
          }}/>}

        {s.step === "guided" && <GuidedBrief value={s.guided} onChange={guided => patch({ guided })} onBack={() => go("choose")} onDone={prepareAi} onManualDone={manualContinue} files={s.files} onFiles={files => patch({ files })} topic={s.guidedTopic} onTopic={guidedTopic=>patch({guidedTopic})} readingFiles={readingFiles} onReading={setReadingFiles}/>}

        {s.step === "confirm" && <section className="flow-panel narrow" aria-labelledby="confirm-title">
          <Back onClick={() => go(s.path === "guided" ? "guided" : question ? "clarify" : "free")}/>
          <p className="eyebrow">Last check</p>
          <h1 id="confirm-title" tabIndex={-1}>Is this your startup?</h1>
          <p className="lead">Everything is editable. Tags show where each value came from; once you change it, it’s simply yours.</p>
          <p className="field-help">This is a synthetic public demo: the confirmed profile and saved strategy are editable by anyone with the link. AI material and history require owner access.</p>
          {access?.configured&&<label className="field-help"><input type="checkbox" checked={s.runAi} onChange={e=>patch({runAi:e.target.checked})}/> Run the AI specialists after creation. Uses OpenAI credits; proposals are reviewed before applying.</label>}
          {missing(draft).length > 0 && <p className="info-notice">Still empty: {missing(draft).map(f => ({ name: "name", description: "description", businessModel: "who pays", stage: "stage", targetMarket: "market", customerSegment: "customer" } as Record<string, string>)[f]).join(", ")}. Fill them in below.</p>}
          <div className="plate confirm-plate">
            <ProfileForm key={JSON.stringify(seed)} seed={seed} recoveryScope={`onboarding:${s.sessionId}`} creationRequestId={s.creationRequestId} origins={draft.origin as Record<string, string>} submitLabel="Create and launch"
              onSaved={startup => { setS(current=>{const next:Saved={...current,created:startup,step:"launch"};try{sessionStorage.setItem(storeKey,JSON.stringify(next));}catch{/* memory only */}return next;}); }}/>
          </div>
        </section>}

        {s.step === "launch" && s.created && <LaunchSequence startup={s.created} draft={draft} brief={briefOf(s)} materialText={analysisOf(s)} answers={s.answers} files={s.files} runAi={s.runAi} intakeId={s.intakeMaterialKey===key&&s.intake?.status==="completed"?s.intake.id:undefined}/>}
        {s.step==="launch"&&<button type="button" className="button ghost" onClick={()=>persist({...initial,sessionId:crypto.randomUUID(),creationRequestId:crypto.randomUUID()})}>Create another startup</button>}
      </motion.div>
  </div></MotionConfig>;
}

function briefOf(s: Saved) {
  const parts = [s.text.trim(),s.path==="guided"?`Founder guided answers:\n${JSON.stringify(s.guided)}`:"",...s.answers.map(x => `Q: ${x.q}\nA: ${x.a}`)];
  return parts.filter(Boolean).join("\n\n").slice(0, 16000);
}

function Back({ onClick }: { onClick: () => void }) {
  return <button type="button" className="text-link back-link" onClick={onClick}><ArrowLeft size={16} aria-hidden/>Back</button>;
}

function Choose({ onPick }: { onPick: (p: "free" | "guided") => void }) {
  // Both paths need the client; until hydration they stay visibly inactive.
  const hydrated = useHydrated();
  return <section className="flow-panel" aria-labelledby="choose-title">
    <p className="eyebrow">Create your startup</p>
    <h1 id="choose-title" tabIndex={-1}>How do you want to start?</h1>
    <p className="lead">Both paths end in the same place: a profile you confirm, strategy drafts and a 30-day plan. You can attach existing material on either.</p>
    <div className="choose-grid">
      <button type="button" className="choose-card" disabled={!hydrated} onClick={() => onPick("free")}>
        <MessagesSquare size={24} aria-hidden/>
        <span className="choose-title">Free form</span>
        <span className="choose-text">Write it in your own words. We pick out what we can and ask only for what’s missing — at most seven short questions.</span>
        <span className="choose-meta">~3 min · best if you already pitch it often</span>
        <span className="choose-go" aria-hidden><ArrowRight size={18}/></span>
      </button>
      <button type="button" className="choose-card" disabled={!hydrated} onClick={() => onPick("guided")}>
        <ListChecks size={24} aria-hidden/>
        <span className="choose-title">Guided brief</span>
        <span className="choose-text">Seven short topics. Precise choices where the answer is a choice, short open questions where it’s a thought.</span>
        <span className="choose-meta">~4 min · best if it’s still taking shape</span>
        <span className="choose-go" aria-hidden><ArrowRight size={18}/></span>
      </button>
    </div>
  </section>;
}

function Clarify({ ai,draft, asked, answers, question, onAnswer, onBack, onDone,pending,onPending }: {
  ai:boolean;draft: IntakeDraft; asked: string[]; answers: { q: string; a: string }[]; question: Question | null;
  onAnswer: (q: Question, value: string | string[] | null) => void; onBack: () => void; onDone: () => void;
  pending:Saved["pending"];onPending:(id:string,value:{value:string;multi:string[]})=>void;
}) {
  const left = missing(draft).length;
  return <section className="flow-panel narrow" aria-labelledby="clarify-title">
    <Back onClick={onBack}/>
    <p className="eyebrow">{ai?"Questions for your case · AI":"Required profile details · without AI"}</p>
    <h1 id="clarify-title" tabIndex={-1} className="sr-only">Clarifying questions</h1>
    <ol className="clarify-dots" aria-label={`Question ${asked.length + 1} of at most 7`}>{Array.from({ length: 7 }, (_, i) => <li key={i} className={i < asked.length ? "done" : i === asked.length ? "now" : ""}/>)}</ol>
    {answers.length > 0 && <ul className="clarify-log" aria-label="Your answers">{answers.map((x, i) => <li key={i}><span className="faint">{x.q}</span><span>{x.a}</span></li>)}</ul>}
    {question ? <QuestionCard key={question.id} question={question} left={left} onAnswer={onAnswer} onDone={onDone} pending={pending[question.id]} onPending={value=>onPending(question.id,value)}/>
      : <div className="clarify-card"><h2 className="clarify-q">That’s everything we needed.</h2><button type="button" className="button primary" onClick={onDone}>Review profile<ArrowRight size={17} aria-hidden/></button></div>}
  </section>;
}

function QuestionCard({ question, left, onAnswer, onDone,pending,onPending }: { question: Question; left: number; onAnswer: (q: Question, value: string | string[] | null) => void; onDone: () => void;pending?:{value:string;multi:string[]};onPending:(p:{value:string;multi:string[]})=>void }) {
  const value=pending?.value||"",multi=pending?.multi||[];
  const setValue=(value:string)=>onPending({value,multi});
  const setMulti=(change:(v:string[])=>string[])=>onPending({value,multi:change(multi)});
  const submit = (v: string | string[]) => { if (Array.isArray(v) ? v.length : String(v).trim()) onAnswer(question, v); };
  return <motion.div className="clarify-card" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.14, ease }}>
        <h2 className="clarify-q">{question.text}</h2>
        <p className="field-help">{question.why}</p>
        {question.kind === "choice"
          ? <div className="chip-row big" role="group" aria-label={question.text}>{question.options!.map(o => {
            const on = question.multi ? multi.includes(o) : false;
            return <button type="button" key={o} className={`chip ${on ? "on" : ""}`} aria-pressed={question.multi ? on : undefined}
              onClick={() => question.multi ? setMulti(m => m.includes(o) ? m.filter(x => x !== o) : m.length < (question.field==="channels"?3:8) ? [...m, o] : m) : submit(o)}>{o}</button>;
          })}</div>
          : <form className="clarify-form" onSubmit={e => { e.preventDefault(); submit(value); }}>
            <label className="sr-only" htmlFor="clarify-input">{question.text}</label>
            <textarea id="clarify-input" autoFocus className="input" rows={3} value={value} onChange={e => setValue(e.target.value)} placeholder={question.placeholder} maxLength={question.field==="context"?3000:question.field==="description"?2000:question.field==="name"?120:question.field==="targetMarket"?200:500}/>
            <button className="button primary" disabled={!value.trim()}>Answer</button>
          </form>}
        {question.kind === "choice" && <form className="clarify-form other" onSubmit={e => { e.preventDefault(); submit(question.multi?[...multi,value].filter(Boolean).slice(0,question.field==="channels"?3:8):value); }}>
          <label className="sr-only" htmlFor="clarify-other">Something else</label>
          <input id="clarify-other" className="input" value={value} onChange={e => setValue(e.target.value)} placeholder="Something else…"/>
          {value.trim() && <button className="button small">Use this</button>}
        </form>}
        <div className="clarify-actions">
          {question.multi && <button type="button" className="button primary small" disabled={!multi.length} onClick={() => submit(multi)}>Answer</button>}
          <button type="button" className="button ghost small" onClick={() => onAnswer(question, null)}><SkipForward size={14} aria-hidden/>Skip</button>
          <button type="button" className="text-link finish" onClick={onDone}>{left ? `Finish now · ${left} required left for the profile` : "Finish now"}</button>
        </div>
  </motion.div>;
}
