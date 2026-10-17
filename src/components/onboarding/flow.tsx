"use client";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, ListChecks, MessagesSquare, SkipForward } from "lucide-react";
import type { Startup } from "@/lib/domain/types";
import { ProfileForm, type ProfileSeed } from "../profile-form";
import { useHydrated } from "../ui";
import { answer, emptyDraft, extract, missing, nextQuestion, type IntakeDraft, type Question } from "../intake/extract";
import { FileAttach, type Attached } from "./files";
import { GuidedBrief, guidedToDraft, emptyGuided, type GuidedState } from "./guided";
import { LaunchSequence } from "./launch";

type Step = "choose" | "free" | "clarify" | "guided" | "confirm" | "launch";
type Saved = { step: Step; path: "free" | "guided" | null; text: string; files: Attached[]; asked: string[]; answers: { q: string; a: string }[]; draft: IntakeDraft; guided: GuidedState };
const storeKey = "orbit:onboarding:v1";
const ease = [0.22, 1, 0.36, 1] as const;
const initial: Saved = { step: "choose", path: null, text: "", files: [], asked: [], answers: [], draft: emptyDraft(), guided: emptyGuided };

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
  const [created, setCreated] = useState<Startup | null>(null);
  const [dir, setDir] = useState(1);
  // Survive a refresh: everything except the created startup lives in this tab's storage.
  useEffect(() => {
    let raw: string | null = null;
    try { raw = sessionStorage.getItem(storeKey); } catch { /* fresh start */ }
    // Applied after mount so server and first client render match.
    void Promise.resolve().then(() => { if (raw) setS({ ...initial, ...JSON.parse(raw) }); setRestored(true); });
  }, []);
  useEffect(() => { if (restored && s.step !== "launch") try { sessionStorage.setItem(storeKey, JSON.stringify(s)); } catch { /* memory only */ } }, [s, restored]);
  const go = (step: Step, back = false) => { setDir(back ? -1 : 1); setS(c => ({ ...c, step })); requestAnimationFrame(() => document.querySelector<HTMLElement>("main h1, main h2")?.focus({ preventScroll: true })); window.scrollTo({ top: 0 }); };
  const patch = (p: Partial<Saved>) => setS(c => ({ ...c, ...p }));

  const fileText = s.files.filter(f => f.kind === "text").map(f => f.text).join("\n\n");
  // Free text is re-read on every change; answers given in the clarifying step always win over extraction.
  const freeDraft = useMemo(() => {
    const fromText = extract(s.text);
    const fromFiles = extract(fileText);
    const merged = emptyDraft();
    for (const k of Object.keys(merged.profile) as (keyof IntakeDraft["profile"])[]) {
      const v = fromText.profile[k] || fromFiles.profile[k];
      (merged.profile as Record<string, string>)[k] = v; if (v) merged.origin[k] = fromText.profile[k] ? "text" : "file";
    }
    for (const k of ["painPoint", "outcome", "price", "pricingModel"] as const) { const v = fromText.hints[k] || fromFiles.hints[k]; merged.hints[k] = v; if (v) merged.origin[k] = fromText.hints[k] ? "text" : "file"; }
    merged.hints.channels = fromText.hints.channels.length ? fromText.hints.channels : fromFiles.hints.channels;
    let d = merged;
    for (const [field, value] of Object.entries(s.draft.origin)) if (value === "answer") {
      d = answer(d, field as Question["field"], field === "channels" ? s.draft.hints.channels : field in s.draft.profile ? (s.draft.profile as Record<string, string>)[field] : (s.draft.hints as unknown as Record<string, string>)[field]);
    }
    return d;
  }, [s.text, fileText, s.draft]);
  const draft = s.path === "guided" ? guidedToDraft(s.guided) : freeDraft;
  const question = nextQuestion(freeDraft, s.asked);

  function toConfirm() { patch({ draft: s.path === "guided" ? guidedToDraft(s.guided) : freeDraft }); go("confirm"); }
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

  return <div className="flow">
    <AnimatePresence mode="wait" custom={dir} initial={false}>
      <motion.div key={s.step} custom={dir} className="flow-step"
        variants={{ in: (d: number) => ({ opacity: 0, x: 24 * d }), on: { opacity: 1, x: 0 }, out: (d: number) => ({ opacity: 0, x: -16 * d }) }}
        initial="in" animate="on" exit="out" transition={{ duration: 0.28, ease }}>
        {s.step === "choose" && <Choose onPick={path => { patch({ path }); go(path === "free" ? "free" : "guided"); }}/>}

        {s.step === "free" && <section className="flow-panel" aria-labelledby="free-title">
          <Back onClick={() => go("choose", true)}/>
          <p className="eyebrow">Free form</p>
          <h1 id="free-title" tabIndex={-1}>Tell us about your startup.</h1>
          <p className="lead">Write it the way you would explain it to a cofounder. Order doesn’t matter; half-sentences are fine.</p>
          <div className="compose">
            <div className="compose-main">
              <label className="sr-only" htmlFor="free-text">Your startup in your own words</label>
              <textarea id="free-text" className="compose-text" value={s.text} onChange={e => patch({ text: e.target.value })} autoFocus
                placeholder={"Fieldnote helps founders of small B2B SaaS teams turn customer interviews into product decisions.\nRight now notes are scattered across docs and calls…\nWe have an MVP and three pilot teams in Kazakhstan. Thinking $29 per workspace a month."}/>
              <FileAttach files={s.files} onChange={files => patch({ files })} aiReading={false}/>
            </div>
            <aside className="compose-side" aria-label="What we picked up">
              <p className="label">Picked up <span className="faint">· rules, not AI</span></p>
              <ul className="pickup">{checklist.map(c => { const ok = c.ok(freeDraft); return <li key={c.key} className={ok ? "ok" : ""}>
                <span className="pickup-dot" aria-hidden>{ok && <Check size={11} strokeWidth={3}/>}</span>{c.label}<span className="sr-only">{ok ? ": found" : ": not yet"}</span></li>; })}</ul>
              <p className="field-help">Anything still missing is asked next — {question ? "a few short questions" : "nothing left to ask"}.</p>
            </aside>
          </div>
          <div className="flow-actions">
            <button type="button" className="button primary" disabled={s.text.trim().length < 20 && !fileText} onClick={() => question ? go("clarify") : toConfirm()}>Continue<ArrowRight size={17} aria-hidden className="arrow"/></button>
            <span className="field-help">{s.text.trim().length < 20 && !fileText ? "A couple of sentences is enough to start." : ""}</span>
          </div>
        </section>}

        {s.step === "clarify" && <Clarify draft={freeDraft} asked={s.asked} answers={s.answers} question={question}
          onBack={() => go("free", true)} onDone={toConfirm}
          onAnswer={(q, value) => {
            const asked = [...s.asked, q.field];
            const nextDraft = value === null ? s.draft : answer(s.draft, q.field, value);
            const merged = value === null ? freeDraft : answer(freeDraft, q.field, value);
            setS(c => ({ ...c, asked, answers: value === null ? c.answers : [...c.answers, { q: q.text, a: Array.isArray(value) ? value.join(", ") : value }], draft: nextDraft }));
            // Nothing left to ask: go straight to the confirmation, no extra screen.
            if (!nextQuestion(merged, asked)) { setS(c => ({ ...c, draft: merged })); go("confirm"); }
          }}/>}

        {s.step === "guided" && <GuidedBrief value={s.guided} onChange={guided => patch({ guided })} onBack={() => go("choose", true)} onDone={toConfirm} files={s.files} onFiles={files => patch({ files })}/>}

        {s.step === "confirm" && <section className="flow-panel narrow" aria-labelledby="confirm-title">
          <Back onClick={() => go(s.path === "guided" ? "guided" : question ? "clarify" : "free", true)}/>
          <p className="eyebrow">Last check</p>
          <h1 id="confirm-title" tabIndex={-1}>Is this your startup?</h1>
          <p className="lead">Everything is editable. Tags show where each value came from; once you change it, it’s simply yours.</p>
          {missing(draft).length > 0 && <p className="info-notice">Still empty: {missing(draft).map(f => ({ name: "name", description: "description", businessModel: "who pays", stage: "stage", targetMarket: "market", customerSegment: "customer" } as Record<string, string>)[f]).join(", ")}. Fill them in below.</p>}
          <div className="plate confirm-plate">
            <ProfileForm key={s.path} seed={seed} origins={draft.origin as Record<string, string>} submitLabel="Create and launch"
              onSaved={startup => { setCreated(startup); try { sessionStorage.removeItem(storeKey); } catch { /* ignore */ } go("launch"); }}/>
          </div>
        </section>}

        {s.step === "launch" && created && <LaunchSequence startup={created} draft={draft} brief={briefOf(s)} files={s.files}/>}
      </motion.div>
    </AnimatePresence>
  </div>;
}

function briefOf(s: Saved) {
  const parts = [s.text.trim(), ...s.answers.map(x => `Q: ${x.q}\nA: ${x.a}`), ...s.files.filter(f => f.kind === "text").map(f => `File ${f.name}:\n${f.text}`)];
  return parts.filter(Boolean).join("\n\n").slice(0, 6000);
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

function Clarify({ draft, asked, answers, question, onAnswer, onBack, onDone }: {
  draft: IntakeDraft; asked: string[]; answers: { q: string; a: string }[]; question: Question | null;
  onAnswer: (q: Question, value: string | string[] | null) => void; onBack: () => void; onDone: () => void;
}) {
  const left = missing(draft).length;
  return <section className="flow-panel narrow" aria-labelledby="clarify-title">
    <Back onClick={onBack}/>
    <p className="eyebrow">A few details · rules, not AI</p>
    <h1 id="clarify-title" tabIndex={-1} className="sr-only">Clarifying questions</h1>
    <ol className="clarify-dots" aria-label={`Question ${asked.length + 1} of at most 7`}>{Array.from({ length: 7 }, (_, i) => <li key={i} className={i < asked.length ? "done" : i === asked.length ? "now" : ""}/>)}</ol>
    {answers.length > 0 && <ul className="clarify-log" aria-label="Your answers">{answers.map((x, i) => <li key={i}><span className="faint">{x.q}</span><span>{x.a}</span></li>)}</ul>}
    {question ? <AnimatePresence mode="wait"><QuestionCard key={question.id} question={question} left={left} onAnswer={onAnswer} onDone={onDone}/></AnimatePresence>
      : <div className="clarify-card"><h2 className="clarify-q">That’s everything we needed.</h2><button type="button" className="button primary" onClick={onDone}>Review profile<ArrowRight size={17} aria-hidden/></button></div>}
  </section>;
}

function QuestionCard({ question, left, onAnswer, onDone }: { question: Question; left: number; onAnswer: (q: Question, value: string | string[] | null) => void; onDone: () => void }) {
  const [value, setValue] = useState("");
  const [multi, setMulti] = useState<string[]>([]);
  const submit = (v: string | string[]) => { if (Array.isArray(v) ? v.length : String(v).trim()) onAnswer(question, v); };
  return <motion.div className="clarify-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.24, ease }}>
        <h2 className="clarify-q">{question.text}</h2>
        <p className="field-help">{question.why}</p>
        {question.kind === "choice"
          ? <div className="chip-row big" role="group" aria-label={question.text}>{question.options!.map(o => {
            const on = question.multi ? multi.includes(o) : false;
            return <button type="button" key={o} className={`chip ${on ? "on" : ""}`} aria-pressed={question.multi ? on : undefined}
              onClick={() => question.multi ? setMulti(m => m.includes(o) ? m.filter(x => x !== o) : m.length < 3 ? [...m, o] : m) : submit(o)}>{o}</button>;
          })}</div>
          : <form className="clarify-form" onSubmit={e => { e.preventDefault(); submit(value); }}>
            <label className="sr-only" htmlFor="clarify-input">{question.text}</label>
            <input id="clarify-input" autoFocus className="input" value={value} onChange={e => setValue(e.target.value)} placeholder={question.placeholder}/>
            <button className="button primary" disabled={!value.trim()}>Answer</button>
          </form>}
        {question.kind === "choice" && !question.multi && <form className="clarify-form other" onSubmit={e => { e.preventDefault(); submit(value); }}>
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
