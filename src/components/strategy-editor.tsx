"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Lightbulb, Plus, Save, X } from "lucide-react";
import { z } from "zod";
import { calculateCompletion, fieldLabels, sectionCompletion, sectionTitles } from "@/lib/domain/completion";
import { sectionKeys, sectionSchemas, type SectionDataMap, type SectionKey, type StrategyData } from "@/lib/domain/schemas";
import type { StrategySection, Workspace } from "@/lib/domain/types";
import { api, ClientError } from "@/lib/client-api";
import { Badge, Choice, ErrorNotice, Field, SaveState, Spinner, useDirtyGuard, useHydrated } from "./ui";
import { easeOut, spring, useWorkspace } from "./workspace";
import { clearSubmittedDraft, useDraftRecovery } from "./draft-recovery";
import { useDevicePref } from "./device-prefs";

export type StrategyExamples = { [K in SectionKey]: SectionDataMap[K] };

const sectionHelp: Record<SectionKey, string> = {
  icp: "Who has the problem badly enough to act first?",
  value: "The promise your customer should understand in one read.",
  channels: "Where your first customers already are. One to three focused bets.",
  pricing: "A clear first offer. An explicit assumption is a good start.",
  assumptions: "Three beliefs that could change your plan, and how you will test them.",
};
const hints: Record<string, string> = {
  buyerType: "Who signs or pays? A role beats “everyone”.", industry: "Industry, company size, demographic or shared situation.",
  painPoint: "What do they struggle with today?", buyingTrigger: "What event makes them look for a solution now?",
  problem: "In your customer's words.", outcome: "What becomes measurably better for them?", differentiation: "Why you, over what they use today?",
  proof: "Evidence you have, or what you still need to prove. Saying “assumption” is fine.",
  model: "Subscription, usage-based, paid pilot, one-off…", initialPrice: "A range or first guess: “$49/month”, “$2–5k pilot”.",
  paymentUnit: "Per seat, per order, per site, per project…", rationale: "Why is this a reasonable starting point for this buyer?",
};
const shortFields = new Set(["buyerType", "industry", "model", "initialPrice", "paymentUnit"]);
const textFields: Partial<Record<SectionKey, string[]>> = {
  icp: ["buyerType", "industry", "painPoint", "buyingTrigger"],
  value: ["problem", "outcome", "differentiation", "proof"],
  pricing: ["model", "initialPrice", "paymentUnit", "rationale"],
};
const autosaveDelay = 1400;

// Maps completion "missing" labels to field ids so the live check can jump to them.
function anchorFor(key: SectionKey, label: string) {
  const byLabel = Object.entries(fieldLabels).find(([, l]) => l === label)?.[0];
  if (byLabel) return `field-${byLabel}`;
  const ch = label.match(/^Channel (\d): (name|reason)/); if (ch) return ch[2] === "name" ? `field-channel-${+ch[1] - 1}` : `field-channel-${+ch[1] - 1}-reason`;
  if (label.startsWith("At least one")) return "field-channel-0";
  const as = label.match(/^Assumption (\d): (testable statement|validation method)/); if (as) return `field-assumption-${+as[1] - 1}-${as[2] === "testable statement" ? "statement" : "method"}`;
  return `editor-${key}`;
}
function jump(id: string) {
  const el = document.getElementById(id);
  el?.focus({ preventScroll: true }); el?.scrollIntoView({ block: "center", behavior: "smooth" });
}
function sectionState(ws: Workspace, key: SectionKey) {
  const c = ws.completion.sections.find(s => s.key === key)!;
  const saved = ws.sections.find(s => s.key === key)?.revision ?? 0;
  return { c, state: c.complete ? "complete" as const : saved ? "draft" as const : "empty" as const };
}

export function StrategyEditor({ examples }: { examples?: StrategyExamples }) {
  const { workspace } = useWorkspace(); const search = useSearchParams(); const router = useRouter();
  const first = workspace.completion.sections.find(s => !s.complete)?.key ?? "icp";
  const [initialSection] = useState(first);
  const requested = search.get("section");
  const selected = sectionKeys.includes(requested as SectionKey) ? requested as SectionKey : initialSection;
  const [dirty, setDirty] = useState(false);
  const [direction, setDirection] = useState(1);
  const [live, setLive] = useState(() => sectionCompletion(selected, workspace.sections.find(s => s.key === selected)!.data));
  const [autosave, setAutosave] = useDevicePref<"on" | "off">("autosave", "on");
  const [showExamples, setShowExamples] = useDevicePref<"on" | "off">("examples", "off");
  const select = useCallback((key: SectionKey) => {
    if (key === selected) return;
    if (dirty && !window.confirm("Leave this section without saving your changes?")) return;
    setDirection(sectionKeys.indexOf(key) > sectionKeys.indexOf(selected) ? 1 : -1);
    setDirty(false); router.replace(`?section=${key}`, { scroll: false });
  }, [dirty, router, selected]);
  const index = sectionKeys.indexOf(selected);
  useEffect(() => { document.querySelector(".station.current")?.scrollIntoView({ inline: "center", block: "nearest" }); }, [selected]);

  return <div className="strategy">
    <div className="page-heading strategy-heading">
      <div><p className="eyebrow">Go-to-market strategy</p><h1 tabIndex={-1}>Strategy</h1>
        <p className="lead">Five decisions, in your order. Write freely: drafts are kept, and filled inputs are a starting point, not proof.</p></div>
      <div className="page-heading-actions writing-toggles">
        <Toggle label="Autosave" checked={autosave === "on"} onChange={v => setAutosave(v ? "on" : "off")}/>
        {examples && <Toggle label="Examples" checked={showExamples === "on"} onChange={v => setShowExamples(v ? "on" : "off")}/>}
      </div>
    </div>
    <div className="strategy-layout">
      <nav className="section-rail" aria-label="Strategy sections">
        <ol>{sectionKeys.map((key, i) => {
          const { c, state } = sectionState(workspace, key);
          const current = key === selected;
          return <li key={key}>
            <button type="button" onClick={() => select(key)} aria-current={current ? "step" : undefined} className={`station ${state} ${current ? "current" : ""}`}>
              {current && <motion.span layoutId="rail-current" className="station-current" transition={spring}/>}
              <span className="station-num" aria-hidden>{state === "complete" ? <Check size={14} strokeWidth={3}/> : String(i + 1).padStart(2, "0")}</span>
              <span className="station-text"><span className="station-title">{c.title}</span>
                <span className="station-meta">{state === "complete" ? "Complete" : state === "draft" ? `Draft · ${c.missing.length} missing` : "Not started"}</span></span>
            </button>
          </li>;
        })}</ol>
        <div className="live-check" aria-labelledby="qc-title">
          <h2 id="qc-title" className="label">Live check · {sectionTitles[selected]}</h2>
          <AnimatePresence mode="popLayout" initial={false}>
            {live.complete
              ? <motion.p key="ok" className="qc-ok" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}><span className="qc-led"/>All required inputs are filled.</motion.p>
              : <motion.ul key="list" className="qc-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <AnimatePresence initial={false}>{live.missing.map(m => <motion.li key={m} layout="position" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6, transition: { duration: 0.15 } }}>
                  <a href={`#${anchorFor(selected, m)}`} onClick={e => { e.preventDefault(); jump(anchorFor(selected, m)); }}>{m}</a>
                </motion.li>)}</AnimatePresence>
              </motion.ul>}
          </AnimatePresence>
          <p className="field-help">Saved progress: {workspace.completion.completed}/5 sections · {workspace.completion.percentage}%.</p>
        </div>
      </nav>
      <div className="editor-col">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div key={selected} custom={direction} variants={{ enter: (d: number) => ({ opacity: 0, x: 16 * d }), center: { opacity: 1, x: 0 }, exit: (d: number) => ({ opacity: 0, x: -10 * d, transition: { duration: 0.12 } }) }}
            initial="enter" animate="center" exit="exit" transition={{ duration: 0.24, ease: easeOut }}>
            <SectionEditor section={workspace.sections.find(s => s.key === selected)!} index={index} onDirtyChange={setDirty} onLive={setLive}
              autosave={autosave === "on"} example={showExamples === "on" ? examples?.[selected] : undefined}
              onNext={() => select(sectionKeys[(index + 1) % 5])} nextTitle={sectionTitles[sectionKeys[(index + 1) % 5]]}
              onPrev={index > 0 ? () => select(sectionKeys[index - 1]) : undefined}/>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  </div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const hydrated = useHydrated();
  return <label className="toggle">
    <input type="checkbox" role="switch" checked={checked} disabled={!hydrated} onChange={e => onChange(e.target.checked)}/>
    <span className="toggle-track" aria-hidden><span className="toggle-thumb"/></span>{label}
  </label>;
}

function Example({ text, onUse }: { text: string; onUse: () => void }) {
  if (!text) return null;
  return <motion.div className="example" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
    <Lightbulb size={14} aria-hidden/><span><span className="sr-only">Synthetic example: </span>{text}</span>
    <button type="button" className="example-use" onClick={onUse}>Use</button>
  </motion.div>;
}

function SectionEditor({ section, index, onDirtyChange, onLive, onNext, onPrev, nextTitle, autosave, example }: {
  section: StrategySection; index: number; onDirtyChange: (v: boolean) => void; onLive: (c: ReturnType<typeof sectionCompletion>) => void;
  onNext: () => void; onPrev?: () => void; nextTitle: string; autosave: boolean; example?: StrategyData;
}) {
  const { workspace, setWorkspace, refresh, notify, track } = useWorkspace();
  const hydrated = useHydrated();
  const [data, setData] = useState<StrategyData>(section.data);
  const [notes, setNotes] = useState(section.notes);
  const [revision, setRevision] = useState(section.revision);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [savedAt, setSavedAt] = useState(section.updatedAt);
  const [baseline, setBaseline] = useState(JSON.stringify({ data: section.data, notes: section.notes }));
  const form = useRef<HTMLFormElement>(null);
  const current = JSON.stringify({ data, notes });
  const latest = useRef(current); latest.current = current;
  const dirty = current !== baseline;
  useDirtyGuard(dirty);
  const draftKey = `strategy:${workspace.startup.id}:${section.key}`;
  // A restored or seeded draft is shown as unsaved; autosave waits until the founder actually edits it.
  const [restoredAs, setRestoredAs] = useState<string | null>(null);
  useDraftRecovery(draftKey, { data, notes, revision, baseline }, dirty, value => {
    const recovered = z.object({ data: sectionSchemas[section.key], notes: z.string(), revision: z.number().int().nonnegative(), baseline: z.string() }).parse(value);
    setData(recovered.data); setNotes(recovered.notes); setRevision(recovered.revision); setBaseline(recovered.baseline);
    setRestoredAs(JSON.stringify({ data: recovered.data, notes: recovered.notes }));
    notify("Unsaved section draft restored. Save to keep it in the workspace.");
  });
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  const completion = sectionCompletion(section.key, data);
  const completionKey = JSON.stringify(completion.missing);
  useEffect(() => { onLive(completion); }, [completionKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void save(false); } };
    window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown);
  });

  // Fields stay editable while a save is in flight. If typing continued, the newer text is kept and saved next.
  const savingRef = useRef(false);
  /* eslint-disable react-hooks/set-state-in-effect -- Follow an advancing server revision only while the editor is clean; preserve dirty draft baselines. */
  useEffect(() => {
    if (section.revision <= revision || savingRef.current) return;
    if (dirty) { setError(new ClientError("This section changed while you were editing. Copy your draft or load the latest saved decision.",409,"REVISION_CONFLICT")); return; }
    setData(section.data); setNotes(section.notes); setRevision(section.revision);
    setBaseline(JSON.stringify({ data: section.data, notes: section.notes })); setSavedAt(section.updatedAt);
  }, [section, revision, dirty]);
  /* eslint-enable react-hooks/set-state-in-effect */
  async function save(silent: boolean) {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true); setError(null);
    const submitted = latest.current;
    const payload = JSON.parse(submitted) as { data: StrategyData; notes: string };
    try {
      const result = await track(api<StrategySection>(`/api/startups/${workspace.startup.id}/strategy/${section.key}`, { method: "PUT", body: JSON.stringify({ expectedRevision: revision, data: payload.data, notes: payload.notes }) }));
      clearSubmittedDraft(draftKey, { data: payload.data, notes: payload.notes, revision, baseline });
      const stored = JSON.stringify({ data: result.data, notes: result.notes });
      setRevision(result.revision); setSavedAt(result.updatedAt); setBaseline(stored);
      if (latest.current === submitted) { setData(result.data); setNotes(result.notes); }
      const wasComplete = workspace.completion.sections.find(s => s.key === section.key)?.complete;
      const nowComplete = sectionCompletion(section.key, result.data).complete;
      setWorkspace(ws => {
        const sections = ws.sections.map(s => s.key === result.key ? result : s);
        return { ...ws, sections, completion: calculateCompletion(sections) };
      });
      if (!silent || nowComplete && !wasComplete) notify(`${sectionTitles[section.key]} saved${nowComplete ? "" : " as draft"}`);
      void refresh().catch(() => {});
    } catch (err) { setError(err as Error); }
    finally { savingRef.current = false; setSaving(false); }
  }
  // Autosave after a pause in typing. Never retries a failed or conflicting save on its own.
  useEffect(() => {
    if (!autosave || !dirty || error || !hydrated || current === restoredAs) return;
    const timer = setTimeout(() => void save(true), autosaveDelay);
    return () => clearTimeout(timer);
  }, [current, autosave, dirty, error, hydrated, saving]); // eslint-disable-line react-hooks/exhaustive-deps

  async function reload() {
    if (!window.confirm("Replace your edits with the latest saved version? Copy your draft first if you want to keep it.")) return;
    try {
      const latestWs = await api<Workspace>(`/api/startups/${workspace.startup.id}`);
      const next = latestWs.sections.find(s => s.key === section.key)!;
      clearSubmittedDraft(draftKey, { data, notes, revision, baseline });
      setData(next.data); setNotes(next.notes); setRevision(next.revision); setSavedAt(next.updatedAt);
      setBaseline(JSON.stringify({ data: next.data, notes: next.notes })); setError(null); setWorkspace(latestWs);
    } catch (err) { setError(err as Error); }
  }
  const conflict = error instanceof ClientError && error.status === 409;
  const status = completion.complete ? "complete" : revision ? "draft" : "empty";
  const ex = (example ?? {}) as Record<string, unknown>;
  const set = (key: string, v: string) => setData(c => ({ ...c, [key]: v }));

  return <form id={`editor-${section.key}`} className="editor writing" onSubmit={e => { e.preventDefault(); void save(false); }} ref={form} tabIndex={-1} aria-labelledby="editor-title">
    <div className="editor-head">
      <span className="editor-index" aria-hidden>{String(index + 1).padStart(2, "0")}<small>/05</small></span>
      <div className="editor-title-wrap">
        <h2 id="editor-title">{sectionTitles[section.key]}</h2>
        <p className="editor-lead">{sectionHelp[section.key]}</p>
      </div>
      <Badge status={status}/>
    </div>
    <ErrorNotice error={conflict ? "This section changed elsewhere since you opened it. Load the latest version, or copy your draft first." : error}
      onReload={conflict ? () => void reload() : undefined} onRetry={!conflict && error ? () => void save(false) : undefined}
      onCopy={conflict ? () => void navigator.clipboard.writeText(JSON.stringify({ data, notes }, null, 2)) : undefined}/>
    <fieldset disabled={!hydrated} className="editor-fields">
      {textFields[section.key]?.map(key => {
        const value = String((data as Record<string, unknown>)[key] ?? "");
        return <Field key={key} name={key} label={fieldLabels[key]} required textarea={!shortFields.has(key)} className="prompt" minRows={56}
          value={value} onChange={v => set(key, v)} help={hints[key]} maxLength={["initialPrice", "paymentUnit"].includes(key) ? 500 : 3000}>
          <AnimatePresence initial={false}>{typeof ex[key] === "string" && <Example key="ex" text={ex[key] as string} onUse={() => set(key, ex[key] as string)}/>}</AnimatePresence>
        </Field>;
      })}
      {section.key === "channels" && <Channels data={sectionSchemas.channels.parse(data)} onChange={setData} example={example ? sectionSchemas.channels.parse(example) : undefined}/>}
      {section.key === "assumptions" && <Assumptions data={sectionSchemas.assumptions.parse(data)} onChange={setData} example={example ? sectionSchemas.assumptions.parse(example) : undefined}/>}
      <details className="context-disclosure" open={notes ? true : undefined}>
        <summary>Notes (optional)</summary>
        <Field name="section-notes" label="Notes for this section" value={notes} onChange={setNotes} textarea maxLength={5000} className="prompt" minRows={56} help="Constraints, open questions or evidence. Not used for completeness."/>
      </details>
    </fieldset>
    <div className="editor-footer">
      <button className="button primary" disabled={saving || !hydrated} aria-busy={saving} aria-keyshortcuts="Control+S" aria-label={saving ? "Saving section" : "Save section"}>{saving ? <><Spinner/>Saving…</> : <><Save size={16} aria-hidden/>Save<span className="save-section-label"> section</span></>}</button>
      <SaveState saving={saving} dirty={dirty} savedAt={savedAt} failed={!!error && !conflict}/>
      <span className="editor-nav">
        {onPrev && <button type="button" className="icon-button" disabled={!hydrated} onClick={onPrev} aria-label="Previous section"><ArrowLeft size={18}/></button>}
        <button type="button" className="button ghost next-btn" disabled={!hydrated} onClick={onNext}><span className="next-label">Next: {nextTitle}</span><span className="next-short">Next</span><ArrowRight size={16} aria-hidden className="arrow"/></button>
      </span>
    </div>
  </form>;
}

const channelSuggestions = ["Founder-led outreach", "LinkedIn", "Cold email", "Communities", "Content / SEO", "Partnerships", "Events", "Referrals", "Paid ads", "Marketplaces"];
function Channels({ data, onChange, example }: { data: ReturnType<typeof sectionSchemas.channels.parse>; onChange: (v: StrategyData) => void; example?: ReturnType<typeof sectionSchemas.channels.parse> }) {
  const channels = data.channels.length ? data.channels : [{ name: "", reason: "" }];
  const set = (next: typeof channels) => onChange({ ...data, channels: next });
  const used = new Set(channels.map(c => c.name.toLowerCase()));
  return <>
    <datalist id="channel-suggestions">{channelSuggestions.map(v => <option value={v} key={v}/>)}</datalist>
    <div className="repeat-group">
      <AnimatePresence initial={false}>{channels.map((channel, i) => <motion.div className="repeat-item" key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.22, ease: easeOut }}>
        <div className="repeat-head"><span className="repeat-num" aria-hidden>{i + 1}</span><h3>Channel {i + 1}</h3>
          {channels.length > 1 && <button type="button" className="icon-button small" aria-label={`Remove channel ${i + 1}${channel.name ? `, ${channel.name}` : ""}`} onClick={() => set(channels.filter((_, j) => j !== i))}><X size={16}/></button>}</div>
        <Field name={`channel-${i}`} label="Channel" required list="channel-suggestions" maxLength={120} value={channel.name} className="prompt"
          onChange={name => set(channels.map((c, j) => j === i ? { ...c, name } : c))}>
          {!channel.name && <div className="chip-row" aria-label="Suggestions">{channelSuggestions.filter(s => !used.has(s.toLowerCase())).slice(0, 6).map(s =>
            <button type="button" key={s} className="chip" onClick={() => set(channels.map((c, j) => j === i ? { ...c, name: s } : c))}>{s}</button>)}</div>}
        </Field>
        <Field name={`channel-${i}-reason`} label="Why this channel reaches your buyer" required textarea value={channel.reason} className="prompt" minRows={56}
          onChange={reason => set(channels.map((c, j) => j === i ? { ...c, reason } : c))}>
          <AnimatePresence initial={false}>{example?.channels[i]?.reason && <Example key="ex" text={example.channels[i].reason} onUse={() => set(channels.map((c, j) => j === i ? { name: c.name || example.channels[i].name, reason: example.channels[i].reason } : c))}/>}</AnimatePresence>
        </Field>
      </motion.div>)}</AnimatePresence>
      <button type="button" className="button small add-btn" disabled={channels.length >= 3} onClick={() => set([...channels, { name: "", reason: "" }])}><Plus size={15} aria-hidden/>Add channel <span className="faint num">({channels.length}/3)</span></button>
    </div>
    <Field name="firstExperiment" label="First acquisition experiment" required value={data.firstExperiment} onChange={firstExperiment => onChange({ ...data, firstExperiment })} textarea className="prompt" minRows={56}
      help="Who, how many, by when, and what counts as success. E.g. “Message 30 ops managers on LinkedIn in 2 weeks; success = 5 calls booked.”">
      <AnimatePresence initial={false}>{example?.firstExperiment && <Example key="ex" text={example.firstExperiment} onUse={() => onChange({ ...data, firstExperiment: example.firstExperiment })}/>}</AnimatePresence>
    </Field>
  </>;
}

function Assumptions({ data, onChange, example }: { data: ReturnType<typeof sectionSchemas.assumptions.parse>; onChange: (v: StrategyData) => void; example?: ReturnType<typeof sectionSchemas.assumptions.parse> }) {
  const list = Array.from({ length: 3 }, (_, i) => data.assumptions[i] ?? { statement: "", risk: "medium" as const, validationMethod: "" });
  const change = (i: number, patch: Partial<(typeof list)[number]>) => onChange({ assumptions: list.map((a, j) => j === i ? { ...a, ...patch } : a) });
  return <>
    <p className="info-notice">All three stay <strong>untested</strong> until you record evidence. Filling the fields completes the section; it does not validate the beliefs.</p>
    <div className="repeat-group">{list.map((a, i) => <div className={`repeat-item risk-${a.risk}`} key={i}>
      <div className="repeat-head"><span className="repeat-num" aria-hidden>{i + 1}</span><h3>Assumption {i + 1}</h3><Badge status="untested"/></div>
      <Field name={`assumption-${i}-statement`} label="What do you believe is true?" required value={a.statement} onChange={statement => change(i, { statement })} textarea className="prompt" minRows={56} help={i === 0 ? "Specific enough that evidence could prove it wrong." : undefined}>
        <AnimatePresence initial={false}>{example?.assumptions[i] && <Example key="ex" text={example.assumptions[i].statement} onUse={() => change(i, { ...example.assumptions[i] })}/>}</AnimatePresence>
      </Field>
      <Choice className="risk compact" label="Risk if wrong" name={`risk-${i}`} value={a.risk} options={["low", "medium", "high"] as const} onChange={risk => change(i, { risk })}/>
      <Field name={`assumption-${i}-method`} label="How will you test it?" required value={a.validationMethod} onChange={validationMethod => change(i, { validationMethod })} textarea className="prompt" minRows={56}/>
    </div>)}</div>
  </>;
}
