"use client";
import { useAnalysisCopy } from "@/ui/use-analysis-copy";
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
import { useDisplay } from "@/ui/display";
import type { MessageKey } from "@/ui/i18n/en";

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
const checklist: { key: string; ok: (d: IntakeDraft) => boolean }[] = [
  { key: "name", ok: d => !!d.profile.name },
  { key: "what", ok: d => !!d.profile.description },
  { key: "who", ok: d => !!d.profile.customerSegment },
  { key: "model", ok: d => !!d.profile.businessModel },
  { key: "where", ok: d => !!d.profile.targetMarket },
  { key: "stage", ok: d => !!d.profile.stage },
  { key: "pain", ok: d => !!d.hints.painPoint },
  { key: "price", ok: d => !!d.hints.price },
  { key: "channels", ok: d => d.hints.channels.length > 0 },
];

export function OnboardingFlow() {
  const copy=useAnalysisCopy();
  const { t, tk, locale } = useDisplay();
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
  const checkAccess=()=>{setAiError("");return api<{configured:boolean;authorized:boolean}>("/api/intake").then(setAccess).catch(err=>setAiError(`${t("ob.accessFailed")} ${(err as Error).message}`));};
  useEffect(()=>{void api<{configured:boolean;authorized:boolean}>("/api/intake").then(setAccess).catch(err=>setAiError(`${t("ob.accessFailed")} ${(err as Error).message}`));},[t]);
  const persist=(next:Saved)=>{setS(next);try{sessionStorage.setItem(storeKey,JSON.stringify(next));}catch{/* in memory */}};
  const analysisText=analysisOf(s);
  const key=materialKey(analysisText,s.files);
  async function analyze(newAttempt=false,unlocked=false){
    if(analyzing)return;setAiError("");
    if(!access?.authorized&&!unlocked){setShowUnlock(true);return;}
    const attempt=!newAttempt&&s.intakeAttempt?.materialKey===key?s.intakeAttempt:{requestId:crypto.randomUUID(),materialKey:key};
    persist({...s,...(s.answerMaterialKey&&s.answerMaterialKey!==key?{asked:[],answers:[],pending:{},draft:emptyDraft()}:{}),answerMaterialKey:key,step:"interpret",runAi:true,intakeAdvance:true,intakeAttempt:attempt});setAnalyzing(true);
    try{const result=await api<IntakeRecord>("/api/intake",{method:"POST",body:JSON.stringify({action:"analyze",payload:{requestId:attempt.requestId,text:analysisText,files:s.files,locale}})});setS(c=>advanceReady({...c,intake:result,intakeMaterialKey:attempt.materialKey}));}
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
  function prepareAi(){patch({runAi:true,intakeAdvance:true});go("interpret");void(async()=>{try{const flags=access??await api<{configured:boolean;authorized:boolean}>("/api/intake");setAccess(flags);if(flags.configured)await analyze(false,flags.authorized);}catch(err){setAiError(`${t("ob.accessFailed")} ${(err as Error).message}`);}})();}
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
          <h1 id="free-title" tabIndex={-1}>{t("ob.free.title")}</h1>
          <p className="lead">{t("ob.free.lede")}</p>
          <div className="compose">
            <div className="compose-main">
              <label className="sr-only" htmlFor="free-text">{t("ob.free.label")}</label>
              <textarea id="free-text" className="compose-text" value={s.text} onChange={e => patch({ text: e.target.value })} autoFocus maxLength={16000}
                placeholder={t("ob.free.placeholder")}/>
              <FileAttach files={s.files} onChange={files => patch({ files })} onReading={setReadingFiles}/>
            </div>
            <aside className="compose-side" aria-label={t("ob.pickedUp")}>
              <p className="label">{t("ob.pickedUp")} <span className="faint">· {s.intakeMaterialKey===key&&s.intake?.status==="completed"?t("ob.pickedAi"):t("ob.pickedRules")}</span></p>
              <ul className="pickup">{checklist.map(c => { const ok = c.ok(freeDraft); return <li key={c.key} className={ok ? "ok" : ""}>
                <span className="pickup-dot" aria-hidden>{ok && <Check size={11} strokeWidth={3}/>}</span>{t(`ob.check.${c.key}` as MessageKey)}<span className="sr-only">{ok ? `: ${t("ob.found")}` : `: ${t("ob.notYet")}`}</span></li>; })}</ul>
              <p className="field-help">{question ? t("ob.askNext") : t("ob.nothingLeft")}</p>
            </aside>
          </div>
          <div className="flow-actions">
            <button type="button" className="button primary" disabled={readingFiles||s.text.trim().length < 20 && !fileText} onClick={prepareAi}>{t("ob.withAi")}<ArrowRight size={17} aria-hidden className="arrow"/></button>
            <button type="button" className="button ghost" disabled={readingFiles||s.text.trim().length < 20 && !fileText} onClick={manualContinue}>{t("ob.withoutAi")}</button>
            <span className="field-help">{s.text.trim().length < 20 && !fileText ? t("ob.coupleSentences") : ""}</span>
          </div>
          <p className="field-help">{t("ob.aiNote")}</p>
        </section>}

        {s.step === "interpret" && <section className="flow-panel narrow" aria-labelledby="interpret-title">
          <Back onClick={()=>{patch({intakeAdvance:false});go(s.path==="guided"?"guided":"free");}}/>
          <h1 id="interpret-title" tabIndex={-1}>{s.intakeMaterialKey===key&&["queued","running"].includes(s.intake?.status||"")?t("ob.reading"):t("ob.understand")}</h1>
          <p className="lead">{t("ob.interpretLede")}</p>
          {(aiError||s.intakeMaterialKey===key&&s.intake?.error)&&<p className="field-error" role="alert">{copy(aiError||s.intake?.error||"")}</p>}
          {!access&&<div><p role="status">{aiError?t("ob.notChecked"):t("ob.checking")}</p><button className="button" onClick={()=>void checkAccess()}>{t("ob.retryAi")}</button></div>}
          {access&&!access.configured&&<p className="info-notice">{t("ob.aiUnavailable")}</p>}
          {access?.configured&&(!access.authorized||showUnlock)&&<form className="unlock" onSubmit={async e=>{e.preventDefault();setAiError("");try{await api("/api/intake",{method:"POST",body:JSON.stringify({action:"unlock",payload:{code}})});setAccess({configured:true,authorized:true});setShowUnlock(false);setCode("");await analyze(false,true);}catch(err){setAiError((err as Error).message);}}}><label htmlFor="intake-code">{t("ob.code")}</label><input id="intake-code" className="input" type="password" autoComplete="current-password" value={code} onChange={e=>setCode(e.target.value)}/><button className="button" disabled={!code||analyzing}>{t("ob.unlock")}</button></form>}
          {access?.authorized&&<>
            {s.intakeMaterialKey===key&&["queued","running"].includes(s.intake?.status||"")?<p role="status">{s.intake?.status==="queued"?t("ob.queued"):t("ob.running")} {t("ob.canLeave")}</p>:<button className="button primary" disabled={analyzing} onClick={()=>void analyze(s.intakeMaterialKey===key&&s.intake?.status==="failed")}>{analyzing?t("ob.sending"):s.intakeMaterialKey===key&&s.intake?.status==="failed"?t("ob.newPaid"):t("ob.analyze")}</button>}
            {s.intakeMaterialKey===key&&s.intake?.status==="queued"&&<button className="button small" disabled={analyzing} onClick={()=>void analyze()}>{t("ob.recover")}</button>}
          </>}
          <p className="field-help">{t("ob.creditsNote")}</p>
          <button className="text-link" onClick={manualContinue}>{t("ob.withoutAi")}</button>
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
          <h1 id="confirm-title" tabIndex={-1}>{t("ob.confirm.title")}</h1>
          <p className="lead">{t("ob.confirm.lede")}</p>
          <p className="field-help">{t("ob.confirm.demo")}</p>
          {access?.configured&&<label className="field-help"><input type="checkbox" checked={s.runAi} onChange={e=>patch({runAi:e.target.checked})}/> {t("ob.runAi")}</label>}
          {missing(draft).length > 0 && <p className="info-notice">{t("ob.stillEmpty", { list: missing(draft).map(f => tk(`profile.${f}`)).join(", ") })}</p>}
          <div className="plate confirm-plate">
            <ProfileForm key={JSON.stringify(seed)} seed={seed} recoveryScope={`onboarding:${s.sessionId}`} creationRequestId={s.creationRequestId} origins={draft.origin as Record<string, string>} submitLabel={t("ob.createLaunch")}
              onSaved={startup => { setS(current=>{const next:Saved={...current,created:startup,step:"launch"};try{sessionStorage.setItem(storeKey,JSON.stringify(next));}catch{/* memory only */}return next;}); }}/>
          </div>
        </section>}

        {s.step === "launch" && s.created && <LaunchSequence startup={s.created} draft={draft} brief={briefOf(s)} materialText={analysisOf(s)} answers={s.answers} files={s.files} runAi={s.runAi} intakeId={s.intakeMaterialKey===key&&s.intake?.status==="completed"?s.intake.id:undefined}/>}
        {s.step==="launch"&&<button type="button" className="button ghost" onClick={()=>persist({...initial,sessionId:crypto.randomUUID(),creationRequestId:crypto.randomUUID()})}>{t("ob.another")}</button>}
      </motion.div>
  </div></MotionConfig>;
}

function briefOf(s: Saved) {
  const parts = [s.text.trim(),s.path==="guided"?`Founder guided answers:\n${JSON.stringify(s.guided)}`:"",...s.answers.map(x => `Q: ${x.q}\nA: ${x.a}`)];
  return parts.filter(Boolean).join("\n\n").slice(0, 16000);
}

function Back({ onClick }: { onClick: () => void }) {
  const { t } = useDisplay();
  return <button type="button" className="text-link back-link" onClick={onClick}><ArrowLeft size={16} aria-hidden/>{t("ob.back")}</button>;
}

function Choose({ onPick }: { onPick: (p: "free" | "guided") => void }) {
  // Both paths need the client; until hydration they stay visibly inactive.
  const hydrated = useHydrated();
  const { t } = useDisplay();
  return <section className="flow-panel" aria-labelledby="choose-title">
    <h1 id="choose-title" tabIndex={-1}>{t("ob.choose.title")}</h1>
    <p className="lead">{t("ob.choose.lede")}</p>
    <div className="choose-grid">
      <button type="button" className="choose-card" disabled={!hydrated} onClick={() => onPick("free")}>
        <MessagesSquare size={24} aria-hidden/>
        <span className="choose-title">{t("ob.free.name")}</span>
        <span className="choose-text">{t("ob.free.text")}</span>
        <span className="choose-meta">{t("ob.free.meta")}</span>
        <span className="choose-go" aria-hidden><ArrowRight size={18}/></span>
      </button>
      <button type="button" className="choose-card" disabled={!hydrated} onClick={() => onPick("guided")}>
        <ListChecks size={24} aria-hidden/>
        <span className="choose-title">{t("ob.guided.name")}</span>
        <span className="choose-text">{t("ob.guided.text")}</span>
        <span className="choose-meta">{t("ob.guided.meta")}</span>
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
  const { t } = useDisplay();
  return <section className="flow-panel narrow" aria-labelledby="clarify-title">
    <Back onClick={onBack}/>
    <p className="eyebrow">{ai ? t("ob.clarify.ai") : t("ob.clarify.rules")}</p>
    <h1 id="clarify-title" tabIndex={-1} className="sr-only">{t("ob.clarify.title")}</h1>
    <ol className="clarify-dots" aria-label={t("ob.clarify.count", { n: asked.length + 1 })}>{Array.from({ length: 7 }, (_, i) => <li key={i} className={i < asked.length ? "done" : i === asked.length ? "now" : ""}/>)}</ol>
    {answers.length > 0 && <ul className="clarify-log" aria-label={t("ob.yourAnswers")}>{answers.map((x, i) => <li key={i}><span className="faint">{x.q}</span><span>{x.a}</span></li>)}</ul>}
    {question ? <QuestionCard key={question.id} question={question} left={left} onAnswer={onAnswer} onDone={onDone} pending={pending[question.id]} onPending={value=>onPending(question.id,value)}/>
      : <div className="clarify-card"><h2 className="clarify-q">{t("ob.everything")}</h2><button type="button" className="button primary" onClick={onDone}>{t("ob.review")}<ArrowRight size={17} aria-hidden/></button></div>}
  </section>;
}

function QuestionCard({ question, left, onAnswer, onDone,pending,onPending }: { question: Question; left: number; onAnswer: (q: Question, value: string | string[] | null) => void; onDone: () => void;pending?:{value:string;multi:string[]};onPending:(p:{value:string;multi:string[]})=>void }) {
  const { t, tk } = useDisplay();
  // Rule questions (id = field) are localised; AI questions arrive already written for this founder.
  const ruled = question.id === question.field;
  const text = ruled ? tk(`q.${question.field}.text`, undefined, question.text) : question.text;
  const why = ruled ? tk(`q.${question.field}.why`, undefined, question.why) : question.why;
  const placeholder = ruled && question.placeholder ? tk(`q.${question.field}.ph`, undefined, question.placeholder) : question.placeholder;
  const optionLabel = (o: string) => question.field === "stage" ? tk(`stage.${o}`, undefined, o) : question.field === "targetMarket" ? tk(`market.${o}`, undefined, o) : o;
  const value=pending?.value||"",multi=pending?.multi||[];
  const setValue=(value:string)=>onPending({value,multi});
  const setMulti=(change:(v:string[])=>string[])=>onPending({value,multi:change(multi)});
  const submit = (v: string | string[]) => { if (Array.isArray(v) ? v.length : String(v).trim()) onAnswer(question, v); };
  return <motion.div className="clarify-card" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.14, ease }}>
        <h2 className="clarify-q">{text}</h2>
        <p className="field-help">{why}</p>
        {question.kind === "choice"
          ? <div className="chip-row big" role="group" aria-label={text}>{question.options!.map(o => {
            const on = question.multi ? multi.includes(o) : false;
            return <button type="button" key={o} className={`chip ${on ? "on" : ""}`} aria-pressed={question.multi ? on : undefined}
              onClick={() => question.multi ? setMulti(m => m.includes(o) ? m.filter(x => x !== o) : m.length < (question.field==="channels"?3:8) ? [...m, o] : m) : submit(o)}>{optionLabel(o)}</button>;
          })}</div>
          : <form className="clarify-form" onSubmit={e => { e.preventDefault(); submit(value); }}>
            <label className="sr-only" htmlFor="clarify-input">{text}</label>
            <textarea id="clarify-input" autoFocus className="input" rows={3} value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder} maxLength={question.field==="context"?3000:question.field==="description"?2000:question.field==="name"?120:question.field==="targetMarket"?200:500}/>
            <button className="button primary" disabled={!value.trim()}>{t("ob.answer")}</button>
          </form>}
        {question.kind === "choice" && <form className="clarify-form other" onSubmit={e => { e.preventDefault(); submit(question.multi?[...multi,value].filter(Boolean).slice(0,question.field==="channels"?3:8):value); }}>
          <label className="sr-only" htmlFor="clarify-other">{t("ob.other")}</label>
          <input id="clarify-other" className="input" value={value} onChange={e => setValue(e.target.value)} placeholder={t("ob.otherPh")}/>
          {value.trim() && <button className="button small">{t("ob.useThis")}</button>}
        </form>}
        <div className="clarify-actions">
          {question.multi && <button type="button" className="button primary small" disabled={!multi.length} onClick={() => submit(multi)}>{t("ob.answer")}</button>}
          <button type="button" className="button ghost small" onClick={() => onAnswer(question, null)}><SkipForward size={14} aria-hidden/>{t("ob.skip")}</button>
          <button type="button" className="text-link finish" onClick={onDone}>{left ? t("ob.finishLeft", { n: left }) : t("ob.finish")}</button>
        </div>
  </motion.div>;
}
