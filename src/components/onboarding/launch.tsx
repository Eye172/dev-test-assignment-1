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
import { writeDraft } from "../draft-recovery";
import type { Attached } from "./files";

type State = "wait" | "run" | "done" | "skip" | "fail";
type LaunchStep = { id: string; label: string; state: State; note?: string };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Turn onboarding hints into unsaved section drafts. The strategy editor opens them as drafts; nothing is saved for the founder. */
function seedDrafts(startupId: string, d: IntakeDraft): SectionKey[] {
  const note = "Drafted from your onboarding answers. Review, edit and save to keep it.";
  const drafts: Partial<Record<SectionKey, unknown>> = {};
  const { hints: h, profile: p } = d;
  if (h.painPoint || p.customerSegment) drafts.icp = { buyerType: p.customerSegment, industry: "", painPoint: h.painPoint, buyingTrigger: "" };
  if (h.painPoint || h.outcome) drafts.value = { problem: h.painPoint, outcome: h.outcome, differentiation: "", proof: "" };
  if (h.channels.length) drafts.channels = { channels: h.channels.map(name => ({ name, reason: "" })), firstExperiment: "" };
  if (h.price || h.pricingModel) drafts.pricing = { model: h.pricingModel, initialPrice: h.price, paymentUnit: "", rationale: "" };
  for (const [key, data] of Object.entries(drafts) as [SectionKey, unknown][]) {
    const empty = emptySection(key);
    writeDraft(`strategy:${startupId}:${key}`, { data: sectionSchemas[key].parse(data), notes: note, revision: 0, baseline: JSON.stringify({ data: empty.data, notes: empty.notes }) });
  }
  return Object.keys(drafts) as SectionKey[];
}

/**
 * The transition after creation. Every segment lights only when its real step finishes; AI segments follow the
 * server's run journal. It never blocks: the workspace is one click away from the first second.
 */
export function LaunchSequence({ startup, draft, brief, files }: { startup: Startup; draft: IntakeDraft; brief: string; files: Attached[] }) {
  const router = useRouter();
  const base = `/startups/${startup.id}`;
  const [steps, setSteps] = useState<LaunchStep[]>([
    { id: "profile", label: "Profile saved", state: "done" },
    { id: "material", label: files.length ? `Reading ${files.length} file${files.length > 1 ? "s" : ""}` : "Your material", state: "wait" },
    { id: "drafts", label: "Strategy drafts from your words", state: "wait" },
    { id: "plan", label: "30-day plan", state: "wait" },
    { id: "ai", label: "AI specialists", state: "wait" },
  ]);
  const [run, setRun] = useState<AiRun | null>(null);
  const [finished, setFinished] = useState(false);
  const started = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const set = (id: string, state: State, note?: string) => setSteps(s => s.map(x => x.id === id ? { ...x, state, note: note ?? x.note } : x));

  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState(""); const [unlockError, setUnlockError] = useState("");
  // AI is optional: it starts when the owner is unlocked, and never blocks opening the workspace.
  async function startAi() {
    set("ai", "run");
    try {
      const state = await api<AiStudioState>(`/api/startups/${startup.id}/ai`);
      if (!state.configured || !state.authorized) { setNeedsCode(state.configured); set("ai", "skip", state.configured ? "Locked — unlock below or later" : "Not configured on this deployment"); setFinished(true); return; }
      setNeedsCode(false);
      const created = await api<{ id: string }>(`/api/startups/${startup.id}/ai`, { method: "POST", body: JSON.stringify({ action: "create", payload: { mode: "full", brief, requestId: crypto.randomUUID() } }) });
      set("ai", "run", "Working — you can keep going");
      setFinished(true);
      for (let i = 0; i < 200 && alive.current; i++) {
        await sleep(document.visibilityState === "visible" ? 3000 : 8000);
        if (!alive.current) break;
        const latest = (await api<AiStudioState>(`/api/startups/${startup.id}/ai`)).runs.find(r => r.id === created.id);
        if (!latest) continue;
        setRun(latest);
        if (["completed", "needs_attention", "failed", "cancelled", "paused"].includes(latest.status)) {
          set("ai", latest.status === "completed" || latest.status === "needs_attention" ? "done" : "fail", latest.status.replace("_", " ")); break;
        }
      }
    } catch { set("ai", "skip", "Unavailable right now — start it later from the workspace"); setFinished(true); }
  }
  async function unlock(e: React.FormEvent) {
    e.preventDefault(); setUnlockError("");
    try { await api(`/api/startups/${startup.id}/ai`, { method: "POST", body: JSON.stringify({ action: "unlock", payload: { code } }) }); setCode(""); await startAi(); }
    catch (err) { setUnlockError((err as Error).message); }
  }

  useEffect(() => {
    if (started.current) return; started.current = true;
    (async () => {
      const read = files.filter(f => f.kind === "text").length;
      set("material", "run"); await sleep(250);
      set("material", files.length ? (read === files.length ? "done" : "skip") : "skip",
        files.length ? (read === files.length ? `${read} read` : `${read} read · ${files.length - read} need AI access`) : "Nothing attached");
      set("drafts", "run"); await sleep(250);
      const seeded = seedDrafts(startup.id, draft);
      set("drafts", seeded.length ? "done" : "skip", seeded.length ? `${seeded.length} section draft${seeded.length > 1 ? "s" : ""} to review` : "Nothing to draft yet");
      set("plan", "run");
      try { await api<Workspace>(`/api/startups/${startup.id}/roadmap`, { method: "POST" }); set("plan", "done", "Generated from your profile"); }
      catch { set("plan", "fail", "Couldn’t generate — try again on the roadmap"); }
      await startAi();
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const open = () => router.push(`${base}?from=onboarding`);
  const segments = run ? run.steps.filter(s => s.round === 0) : [];
  const doneCount = steps.filter(s => s.state === "done" || s.state === "skip" || s.state === "fail").length;
  return <section className="launch" aria-labelledby="launch-title">
    <div className="launch-orbit" aria-hidden>
      <svg viewBox="-110 -110 220 220">
        <circle r="96" className="lo-track"/>
        {steps.map((st, i) => {
          const len = 2 * Math.PI * 96 / steps.length;
          return <circle key={st.id} r="96" className={`lo-seg ${st.state}`} strokeDasharray={`${len - 6} ${2 * Math.PI * 96 - len + 6}`} strokeDashoffset={-i * len} transform="rotate(-90)"/>;
        })}
        {segments.length > 0 && segments.map((st, i) => {
          const len = 2 * Math.PI * 70 / segments.length;
          return <circle key={st.id} r="70" className={`lo-seg inner ${st.status === "completed" ? "done" : st.status === "running" ? "run" : st.status === "failed" ? "fail" : "wait"}`} strokeDasharray={`${len - 5} ${2 * Math.PI * 70 - len + 5}`} strokeDashoffset={-i * len} transform="rotate(-90)"/>;
        })}
        <g className="lo-core"><circle r="34"/></g>
      </svg>
      <span className="lo-count num">{doneCount}<small>/{steps.length}</small></span>
    </div>
    <div className="launch-copy">
      <p className="eyebrow">{startup.name}</p>
      <h1 id="launch-title" tabIndex={-1}>{finished ? "Your workspace is ready." : "Setting up your workspace…"}</h1>
      <ol className="launch-steps" aria-live="polite">{steps.map(st => <li key={st.id} className={st.state}>
        <span className="ls-icon" aria-hidden>{st.state === "done" ? <Check size={13} strokeWidth={3}/> : st.state === "skip" ? <Minus size={13}/> : st.state === "fail" ? <X size={13}/> : <span className="ls-dot"/>}</span>
        <span className="ls-label">{st.label}</span>{st.note && <span className="ls-note">{st.note}</span>}
      </li>)}</ol>
      {needsCode && <form className="unlock" onSubmit={unlock}>
        <label className="sr-only" htmlFor="launch-code">Owner access code</label>
        <input id="launch-code" className="input" type="password" autoComplete="off" value={code} onChange={e => setCode(e.target.value)} placeholder="Owner access code for AI"/>
        <button className="button small" disabled={!code}>Unlock and start</button>
        {unlockError && <p className="field-error" role="alert">{unlockError}</p>}
      </form>}
      {segments.length > 0 && <ul className="launch-agents">{segments.map(st => <li key={st.id} className={st.status}>{agentCatalog[st.role].short}</li>)}</ul>}
      <div className="flow-actions">
        <button type="button" className="button primary" onClick={open}>{finished ? "See what was prepared" : "Open workspace now"}<ArrowRight size={17} aria-hidden className="arrow"/></button>
        {run && !["completed", "needs_attention", "failed", "cancelled"].includes(run.status) && <span className="field-help">AI keeps working in the background; results appear in your workspace.</span>}
      </div>
    </div>
  </section>;
}
