"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Minus, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { agentCatalog, type AiRun, type AiStudioState } from "@/lib/domain/ai";
import { sectionSchemas, type SectionKey } from "@/lib/domain/schemas";
import { emptySection } from "@/lib/domain/completion";
import type { Startup, Workspace } from "@/lib/domain/types";
import type { IntakeDraft } from "../intake/extract";
import { readDraft, writeDraft } from "../draft-recovery";
import type { Attached } from "./files";
import { useDisplay } from "@/ui/display";

type State = "wait" | "run" | "done" | "skip" | "fail";
type LaunchStep = { id: string; label: string; state: State; note?: string };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Turn onboarding hints into unsaved section drafts. The strategy editor opens them as drafts; nothing is saved for the founder. */
function seedDrafts(startup: Startup, d: IntakeDraft, note: string): {seeded:SectionKey[];invalid:SectionKey[]} {
  const drafts: Partial<Record<SectionKey, unknown>> = {};
  const { hints: h } = d;
  const p=startup;
  if (h.painPoint || p.customerSegment) drafts.icp = { buyerType: p.customerSegment, industry: "", painPoint: h.painPoint, buyingTrigger: "" };
  if (h.painPoint || h.outcome) drafts.value = { problem: h.painPoint, outcome: h.outcome, differentiation: "", proof: "" };
  if (h.channels.length) drafts.channels = { channels: h.channels.map(name => ({ name, reason: "" })), firstExperiment: "" };
  if (h.price || h.pricingModel) drafts.pricing = { model: h.pricingModel, initialPrice: h.price, paymentUnit: "", rationale: "" };
  const seeded:SectionKey[]=[],invalid:SectionKey[]=[];
  for (const [key, data] of Object.entries(drafts) as [SectionKey, unknown][]) {
    const empty = emptySection(key);
    const parsed=sectionSchemas[key].safeParse(data);
    if(!parsed.success){invalid.push(key);continue;}
    const storageKey=`strategy:${startup.id}:${key}`;
    if(readDraft(storageKey)===null)writeDraft(storageKey, { data: parsed.data, notes: note, revision: 0, baseline: JSON.stringify({ data: empty.data, notes: empty.notes }) });
    seeded.push(key);
  }
  return {seeded,invalid};
}

type Attempt={seeded?:boolean;planReady?:boolean;runId?:string;payload?:{mode:"full";brief:string;requestId:string;intakeId?:string;locale?:"en"|"ru"|"kk";material:import("@/lib/domain/intake-api").FounderMaterial}};
const attemptKey=(id:string)=>`orbit:launch:v2:${id}`;
function readAttempt(id:string):Attempt {try{const v=JSON.parse(sessionStorage.getItem(attemptKey(id))||"{}");return v&&typeof v==='object'?v:{};}catch{return {};}}
function saveAttempt(id:string,p:Attempt){try{sessionStorage.setItem(attemptKey(id),JSON.stringify(p));}catch{/* Current component keeps the attempt if storage is unavailable. */}}

/**
 * The transition after creation. Every segment lights only when its real step finishes; AI segments follow the
 * server's run journal. It never blocks: the workspace is one click away from the first second.
 */
export function LaunchSequence({ startup, draft, brief,materialText,answers, files,runAi=false,intakeId }: { startup: Startup; draft: IntakeDraft; brief: string;materialText:string;answers:{q:string;a:string}[]; files: Attached[];runAi?:boolean;intakeId?:string }) {
  const router = useRouter();
  const { t, locale } = useDisplay();
  const base = `/startups/${startup.id}`;
  const [steps, setSteps] = useState<LaunchStep[]>([
    { id: "profile", label: t("ln.profile"), state: "done" },
    { id: "material", label: files.length ? t("ln.reading", { n: files.length }) : t("ln.material"), state: "wait" },
    { id: "drafts", label: t("ln.drafts"), state: "wait" },
    { id: "plan", label: t("rm.title"), state: "wait" },
    { id: "ai", label: t("ln.ai"), state: "wait" },
  ]);
  const [run, setRun] = useState<AiRun | null>(null);
  const [finished, setFinished] = useState(false);
  const started = useRef(false);
  const alive = useRef(false);
  useEffect(() => {alive.current=true;return () => { alive.current = false; };}, []);
  const attempt=useRef<Attempt>({});
  const aiBusy=useRef(false);
  const [retry,setRetry]=useState(false);
  const updateAttempt=(p:Partial<Attempt>)=>{attempt.current={...attempt.current,...p};saveAttempt(startup.id,attempt.current);};
  const set = (id: string, state: State, note?: string) => setSteps(s => s.map(x => x.id === id ? { ...x, state, note: note ?? x.note } : x));

  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState(""); const [unlockError, setUnlockError] = useState("");
  // AI is optional: it starts when the owner is unlocked, and never blocks opening the workspace.
  async function startAi() {
    if(aiBusy.current)return;aiBusy.current=true;setRetry(false);
    set("ai", "run");
    try {
      const state = await api<AiStudioState>(`/api/startups/${startup.id}/ai`);
      if (!state.configured || !state.authorized) { setNeedsCode(state.configured); set("ai", "fail", state.configured ? t("ln.aiLocked") : t("ln.aiNotConfigured")); setFinished(true); return; }
      setNeedsCode(false);
      if(!attempt.current.payload)updateAttempt({payload:{mode:"full",locale,brief:brief.slice(0,6000),requestId:crypto.randomUUID(),...(intakeId?{intakeId}:{}),material:{text:materialText,files,answers:answers.map(x=>({question:x.q,answer:x.a}))}}});
      const created = await api<{ id: string }>(`/api/startups/${startup.id}/ai`, { method: "POST", body: JSON.stringify({ action: "create", payload: attempt.current.payload }) });
      updateAttempt({runId:created.id});
      setRun((await api<AiStudioState>(`/api/startups/${startup.id}/ai`)).runs.find(r=>r.id===created.id)||null);
      set("ai", "run", t("ln.working"));
      setFinished(true);
      const checkpoints=new Set<string>();
      while (alive.current) {
        await sleep(document.visibilityState === "visible" ? 3000 : 8000);
        if (!alive.current) break;
        const latest = (await api<AiStudioState>(`/api/startups/${startup.id}/ai`)).runs.find(r => r.id === created.id);
        if (!latest) continue;
        setRun(latest);
        if(latest.status==="paused"&&!checkpoints.has(latest.updatedAt)){checkpoints.add(latest.updatedAt);set("ai","run",t("ln.checkpoint"));await api(`/api/startups/${startup.id}/ai`,{method:"POST",body:JSON.stringify({action:"resume",runId:latest.id})});}
        if (["completed", "needs_attention", "failed", "cancelled"].includes(latest.status)) {
          set("ai", latest.status === "completed" || latest.status === "needs_attention" ? "done" : "fail", latest.status.replace("_", " ")); break;
        }
      }
    } catch (err) { set("ai", "fail", `${(err as Error).message} ${t("ln.retryNote")}`);setRetry(true);setFinished(true); }
    finally{aiBusy.current=false;}
  }
  async function unlock(e: React.FormEvent) {
    e.preventDefault(); setUnlockError("");
    try { await api(`/api/startups/${startup.id}/ai`, { method: "POST", body: JSON.stringify({ action: "unlock", payload: { code } }) }); setCode(""); await startAi(); }
    catch (err) { setUnlockError((err as Error).message); }
  }

  useEffect(() => {
    if (started.current) return; started.current = true;
    attempt.current=readAttempt(startup.id);
    // Seed synchronously, before navigation or network work can open another editor.
    const result=attempt.current.seeded?null:seedDrafts(startup,draft,t("ln.draftNote"));
    if(result)updateAttempt({seeded:true});
    (async () => {
      const read = files.filter(f => f.kind === "text").length;
      set("material", files.length ? (read === files.length ? "done" : "skip") : "skip",
        files.length ? t("ln.extracts", { read, unread: files.length - read }) : t("ln.nothing"));
      set("drafts", result?.seeded.length ? "done" : "skip", result ? t("ln.draftsReady", { n: result.seeded.length }) : t("ln.previous"));
      if(runAi||attempt.current.payload)set("plan","skip",t("ln.planAi"));
      else{set("plan", "run");
        try { if(!attempt.current.planReady){await api<Workspace>(`/api/startups/${startup.id}/roadmap`, { method: "POST", body: JSON.stringify({ locale }) });updateAttempt({planReady:true});} set("plan", "done", t("ln.planDone")); }
        catch { set("plan", "fail", t("ln.planFail")); }}
      if(runAi||attempt.current.payload)await startAi();else{set("ai","skip",t("ln.aiOptional"));setFinished(true);}
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const open = () => router.push(run||runAi||attempt.current.payload?`${base}/ai${attempt.current.runId?`?run=${attempt.current.runId}`:""}`:`${base}?from=onboarding`);
  const segments = run ? run.steps.filter(s => s.round === 0) : [];
  const aiState=steps.find(s=>s.id==="ai")?.state;
  const title=needsCode?t("ln.t.unlock"):aiState==="fail"?t("ln.t.stopped"):run?.status==="completed"?t("ln.t.ready"):run?.status==="needs_attention"?t("ln.t.concerns"):aiState==="run"?t("ln.t.working"):finished?t("ln.t.workspace"):t("ln.t.saving");
  return <section className="launch" aria-labelledby="launch-title">
    <div className="launch-context plate">
      <h2>{startup.name}</h2><p>{startup.description}</p>
      <p className="field-help">{startup.customerSegment} · {startup.targetMarket} · {t(`stage.${startup.stage}`)}</p>
      {run&&<p role="status">{t("ln.stepsSaved", { done: run.steps.filter(s=>s.status==="completed").length, total: run.steps.length })}</p>}
    </div>
    <div className="launch-copy">
      <h1 id="launch-title" tabIndex={-1}>{title}</h1>
      <ol className="launch-steps" aria-live="polite">{steps.map(st => <li key={st.id} className={st.state}>
        <span className="ls-icon" aria-hidden>{st.state === "done" ? <Check size={13} strokeWidth={3}/> : st.state === "skip" ? <Minus size={13}/> : st.state === "fail" ? <X size={13}/> : <span className="ls-dot"/>}</span>
        <span className="ls-label">{st.label}</span>{st.note && <span className="ls-note">{st.note}</span>}
      </li>)}</ol>
      {needsCode && <form className="unlock" onSubmit={unlock}>
        <label className="sr-only" htmlFor="launch-code">{t("ob.code")}</label>
        <input id="launch-code" className="input" type="password" autoComplete="off" value={code} onChange={e => setCode(e.target.value)} placeholder={t("ob.code")}/>
        <button className="button small" disabled={!code}>{t("ob.unlock")}</button>
        {unlockError && <p className="field-error" role="alert">{unlockError}</p>}
      </form>}
      {!needsCode&&!run&&finished&&<button type="button" className="button small" disabled={steps.some(st=>st.id==="ai"&&st.state==="run")} onClick={()=>void startAi()}>{retry ? t("ln.retry") : t("ln.run")}</button>}
      <p className="field-help">{t("ln.aiNote")}</p>
      {segments.length > 0 && <ul className="launch-agents">{segments.map(st => <li key={st.id} className={st.status}>{agentCatalog[st.role].short}</li>)}</ul>}
      <div className="flow-actions">
        <button type="button" className="button primary" onClick={open}>{run||runAi||aiState==="run" ? t("ln.openAi") : finished ? t("ln.seePrepared") : t("ln.openNow")}<ArrowRight size={17} aria-hidden className="arrow"/></button>
        {run && !["completed", "needs_attention", "failed", "cancelled"].includes(run.status) && <span className="field-help">{t("ln.checkpointsNote")}</span>}
      </div>
    </div>
  </section>;
}
