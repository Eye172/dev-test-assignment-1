"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Circle, Plus, Save, X } from "lucide-react";
import { z } from "zod";
import { calculateCompletion, fieldLabels, sectionCompletion, sectionTitles } from "@/lib/domain/completion";
import { sectionKeys, sectionSchemas, type SectionKey, type StrategyData } from "@/lib/domain/schemas";
import type { StrategySection, Workspace } from "@/lib/domain/types";
import { api, ClientError } from "@/lib/client-api";
import { Badge, Choice, ErrorNotice, Field, SaveState, Spinner, useDirtyGuard } from "./ui";
import { spring, useWorkspace } from "./workspace";
import { clearSubmittedDraft, useDraftRecovery } from "./draft-recovery";

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
// Maps completion "missing" labels to field ids so the quick check can jump to them.
function anchorFor(key: SectionKey, label: string) {
  const byLabel = Object.entries(fieldLabels).find(([, l]) => l === label)?.[0];
  if (byLabel) return `field-${byLabel}`;
  const ch = label.match(/^Channel (\d): (name|reason)/); if (ch) return ch[2] === "name" ? `field-channel-${+ch[1] - 1}` : `field-channel-${+ch[1] - 1}-reason`;
  if (label.startsWith("At least one")) return "field-channel-0";
  const as = label.match(/^Assumption (\d): (testable statement|validation method)/); if (as) return `field-assumption-${+as[1] - 1}-${as[2] === "testable statement" ? "statement" : "method"}`;
  return `editor-${key}`;
}
function sectionState(ws: Workspace, key: SectionKey) {
  const c = ws.completion.sections.find(s => s.key === key)!;
  const saved = ws.sections.find(s => s.key === key)?.revision ?? 0;
  return { c, state: c.complete ? "complete" as const : saved ? "draft" as const : "empty" as const };
}

export function StrategyEditor() {
  const { workspace } = useWorkspace(); const search = useSearchParams(); const router = useRouter();
  const first = workspace.completion.sections.find(s => !s.complete)?.key ?? "icp";
  const [initialSection] = useState(first);
  const requested = search.get("section");
  const selected = sectionKeys.includes(requested as SectionKey) ? requested as SectionKey : initialSection;
  const [dirty, setDirty] = useState(false);
  const [live, setLive] = useState(() => sectionCompletion(selected, workspace.sections.find(s => s.key === selected)!.data));
  const select = useCallback((key: SectionKey) => {
    if (key === selected) return;
    if (dirty && !window.confirm("Leave this section without saving your changes?")) return;
    setDirty(false); router.replace(`?section=${key}`, { scroll: false });
  }, [dirty, router, selected]);
  const index = sectionKeys.indexOf(selected);
  // On narrow screens the rail is a horizontal chip row: keep the current section in view.
  useEffect(() => { document.querySelector(".station.current")?.scrollIntoView({ inline: "center", block: "nearest" }); }, [selected]);

  return <>
    <div className="page-heading">
      <div><h1 tabIndex={-1}>Strategy</h1><p className="lead">Five decisions, in any order. Save drafts freely. “Complete” means the required inputs are filled, not that the strategy is proven.</p></div>
    </div>
    <div className="strategy-layout">
      <nav className="section-rail" aria-label="Strategy sections">
        <ol>{sectionKeys.map((key, i) => {
          const { c, state } = sectionState(workspace, key);
          const current = key === selected;
          return <li key={key}>
            <button type="button" onClick={() => select(key)} aria-current={current ? "step" : undefined} className={`station ${state} ${current ? "current" : ""}`}>
              {current && <motion.span layoutId="rail-current" className="station-current" transition={spring}/>}
              <span className="station-node" aria-hidden>{state === "complete" ? <Check size={12} strokeWidth={3}/> : <span className="mono">{i + 1}</span>}</span>
              <span className="station-text"><span className="station-title">{c.title}</span>
                <span className="station-meta">{state === "complete" ? "Complete" : state === "draft" ? `Draft · ${c.missing.length} missing` : "Not started"}</span></span>
            </button>
          </li>;
        })}</ol>
      </nav>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={selected} className="editor-col" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8, transition: { duration: 0.12 } }} transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}>
          <SectionEditor section={workspace.sections.find(s => s.key === selected)!} index={index} onDirtyChange={setDirty} onLive={setLive}
            onNext={() => select(sectionKeys[(index + 1) % 5])} nextTitle={sectionTitles[sectionKeys[(index + 1) % 5]]}/>
        </motion.div>
      </AnimatePresence>
      <aside className="plate instrument quick-check" aria-labelledby="qc-title">
        <span className="screw tl"/><span className="screw tr"/>
        <div className="plate-head"><h2 id="qc-title">Quick check</h2><span className="plate-meta mono">{workspace.completion.completed}/5</span></div>
        <div className="screen">
          <p className="inst-row"><span>{sectionTitles[selected]}</span><strong>{live.complete ? "READY" : `${live.missing.length} MISSING`}</strong></p>
          {live.complete
            ? <p className="qc-ok"><span className="led"/>All required inputs are filled.</p>
            : <ul className="qc-list">{live.missing.map(m => <li key={m}><a href={`#${anchorFor(selected, m)}`} onClick={e => { e.preventDefault(); const el = document.getElementById(anchorFor(selected, m)); el?.focus(); el?.scrollIntoView({ block: "center", behavior: "smooth" }); }}><Circle size={11} aria-hidden/>{m}</a></li>)}</ul>}
        </div>
        <p className="muted qc-rule">Live, from what you have typed. Saved progress: {workspace.completion.percentage}%.</p>
      </aside>
    </div>
  </>;
}

function SectionEditor({ section, index, onDirtyChange, onLive, onNext, nextTitle }: {
  section: StrategySection; index: number; onDirtyChange: (v: boolean) => void; onLive: (c: ReturnType<typeof sectionCompletion>) => void; onNext: () => void; nextTitle: string;
}) {
  const { workspace, setWorkspace, refresh, notify } = useWorkspace();
  const [data, setData] = useState<StrategyData>(section.data);
  const [notes, setNotes] = useState(section.notes);
  const [revision, setRevision] = useState(section.revision);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [savedAt, setSavedAt] = useState(section.updatedAt);
  const [baseline, setBaseline] = useState(JSON.stringify({ data: section.data, notes: section.notes }));
  const form = useRef<HTMLFormElement>(null);
  const dirty = JSON.stringify({ data, notes }) !== baseline;
  useDirtyGuard(dirty);
  const draftKey = `strategy:${workspace.startup.id}:${section.key}`;
  useDraftRecovery(draftKey,{ data,notes,revision,baseline },dirty,value => {
    const recovered = z.object({ data: sectionSchemas[section.key],notes: z.string(),revision: z.number().int().nonnegative(),baseline: z.string() }).parse(value);
    setData(recovered.data); setNotes(recovered.notes); setRevision(recovered.revision); setBaseline(recovered.baseline);
    notify("Unsaved section draft restored. Save to keep it in the workspace.");
  });
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  const completion = sectionCompletion(section.key, data);
  const completionKey = JSON.stringify(completion.missing);
  useEffect(() => { onLive(completion); }, [completionKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); form.current?.requestSubmit(); } };
    window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown);
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault(); if (saving) return; setSaving(true); setError(null);
    try {
      const result = await api<StrategySection>(`/api/startups/${workspace.startup.id}/strategy/${section.key}`, { method: "PUT", body: JSON.stringify({ expectedRevision: revision, data, notes }) });
      clearSubmittedDraft(draftKey,{ data,notes,revision,baseline });
      setData(result.data); setNotes(result.notes); setRevision(result.revision); setSavedAt(result.updatedAt);
      setBaseline(JSON.stringify({ data: result.data, notes: result.notes }));
      setWorkspace(ws => {
        const sections = ws.sections.map(s => s.key === result.key ? result : s);
        return { ...ws,sections,completion: calculateCompletion(sections) };
      });
      notify(`${sectionTitles[section.key]} saved${sectionCompletion(section.key, result.data).complete ? "" : " as draft"}`);
      // The write is already acknowledged. A slow follow-up read must not keep
      // the editor disabled; completeness uses the shared authoritative rule.
      void refresh().catch(() => {});
    } catch (err) { setError(err as Error); }
    finally { setSaving(false); }
  }
  async function reload() {
    if (!window.confirm("Replace your edits with the latest saved version? Copy your draft first if you want to keep it.")) return;
    try {
      const latest = await api<Workspace>(`/api/startups/${workspace.startup.id}`);
      const next = latest.sections.find(s => s.key === section.key)!;
      clearSubmittedDraft(draftKey,{ data,notes,revision,baseline });
      setData(next.data); setNotes(next.notes); setRevision(next.revision); setSavedAt(next.updatedAt);
      setBaseline(JSON.stringify({ data: next.data, notes: next.notes })); setError(null); setWorkspace(latest);
    } catch (err) { setError(err as Error); }
  }
  const conflict = error instanceof ClientError && error.status === 409;
  const status = completion.complete ? "complete" : revision ? "draft" : "empty";

  return <form id={`editor-${section.key}`} className="plate editor" onSubmit={save} ref={form} tabIndex={-1} aria-labelledby="editor-title">
    <div className="editor-head">
      <div><span className="label mono">{String(index + 1).padStart(2, "0")} / 05</span><h2 id="editor-title">{sectionTitles[section.key]}</h2></div>
      <Badge status={status}/>
    </div>
    <p className="muted editor-lead">{sectionHelp[section.key]}</p>
    <ErrorNotice error={conflict ? "This section changed elsewhere since you opened it. Load the latest version, or copy your draft first." : error}
      onReload={conflict ? () => void reload() : undefined} onRetry={!conflict && error ? () => form.current?.requestSubmit() : undefined}
      onCopy={conflict ? () => void navigator.clipboard.writeText(JSON.stringify({ data, notes }, null, 2)) : undefined}/>
    <fieldset disabled={saving} className="editor-fields">
      {textFields[section.key]?.map(key => <Field key={key} name={key} label={fieldLabels[key]} required textarea={!shortFields.has(key)}
        value={String((data as Record<string, unknown>)[key] ?? "")} onChange={v => setData(c => ({ ...c, [key]: v }))}
        help={hints[key]} maxLength={["initialPrice", "paymentUnit"].includes(key) ? 500 : 3000}/>)}
      {section.key === "channels" && <Channels data={sectionSchemas.channels.parse(data)} onChange={setData}/>}
      {section.key === "assumptions" && <Assumptions data={sectionSchemas.assumptions.parse(data)} onChange={setData}/>}
      <details className="context-disclosure" open={notes ? true : undefined}>
        <summary>Notes (optional)</summary>
        <Field name="section-notes" label="Notes for this section" value={notes} onChange={setNotes} textarea maxLength={5000} help="Constraints, open questions or evidence. Not used for completeness."/>
      </details>
    </fieldset>
    <div className="editor-footer">
      <button className="button primary" disabled={saving} aria-busy={saving} aria-keyshortcuts="Control+S">{saving ? <><Spinner/>Saving…</> : <><Save size={16} aria-hidden/>Save section</>}</button>
      <SaveState saving={saving} dirty={dirty} savedAt={savedAt} failed={!!error && !conflict}/>
      <button type="button" className="button ghost next-btn" onClick={onNext}><span className="next-label">Next: {nextTitle}</span><span className="next-short">Next</span><ArrowRight size={16} aria-hidden/></button>
    </div>
  </form>;
}

function Channels({ data, onChange }: { data: ReturnType<typeof sectionSchemas.channels.parse>; onChange: (v: StrategyData) => void }) {
  const channels = data.channels.length ? data.channels : [{ name: "", reason: "" }];
  const set = (next: typeof channels) => onChange({ ...data, channels: next });
  return <>
    <datalist id="channel-suggestions">{["Founder-led outreach", "LinkedIn", "Cold email", "Communities", "Content / SEO", "Partnerships", "Events", "Referrals", "Paid ads", "Marketplaces"].map(v => <option value={v} key={v}/>)}</datalist>
    <div className="repeat-group">
      <AnimatePresence initial={false}>{channels.map((channel, i) => <motion.div layout className="repeat-item" key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
        <div className="repeat-head"><h3>Channel {i + 1}</h3>
          {channels.length > 1 && <button type="button" className="icon-button" aria-label={`Remove channel ${i + 1}${channel.name ? `, ${channel.name}` : ""}`} onClick={() => set(channels.filter((_, j) => j !== i))}><X size={17}/></button>}</div>
        <Field name={`channel-${i}`} label="Channel" required list="channel-suggestions" maxLength={120} value={channel.name}
          help={i === 0 ? "Pick a suggestion or type your own." : undefined} onChange={name => set(channels.map((c, j) => j === i ? { ...c, name } : c))}/>
        <Field name={`channel-${i}-reason`} label="Why this channel reaches your buyer" required textarea value={channel.reason} onChange={reason => set(channels.map((c, j) => j === i ? { ...c, reason } : c))}/>
      </motion.div>)}</AnimatePresence>
      <button type="button" className="button small" disabled={channels.length >= 3} onClick={() => set([...channels, { name: "", reason: "" }])}><Plus size={15} aria-hidden/>Add channel <span className="faint num">({channels.length}/3)</span></button>
    </div>
    <Field name="firstExperiment" label="First acquisition experiment" required value={data.firstExperiment} onChange={firstExperiment => onChange({ ...data, firstExperiment })} textarea
      help="Who, how many, by when, and what counts as success. E.g. “Message 30 ops managers on LinkedIn in 2 weeks; success = 5 calls booked.”"/>
  </>;
}

function Assumptions({ data, onChange }: { data: ReturnType<typeof sectionSchemas.assumptions.parse>; onChange: (v: StrategyData) => void }) {
  const list = Array.from({ length: 3 }, (_, i) => data.assumptions[i] ?? { statement: "", risk: "medium" as const, validationMethod: "" });
  const change = (i: number, patch: Partial<(typeof list)[number]>) => onChange({ assumptions: list.map((a, j) => j === i ? { ...a, ...patch } : a) });
  return <>
    <p className="info-notice">All three stay <strong>untested</strong> until you record evidence. Filling the fields completes the section; it does not validate the beliefs.</p>
    <div className="repeat-group">{list.map((a, i) => <div className="repeat-item" key={i}>
      <div className="repeat-head"><h3>Assumption {i + 1}</h3><Badge status="untested"/></div>
      <Field name={`assumption-${i}-statement`} label="What do you believe is true?" required value={a.statement} onChange={statement => change(i, { statement })} textarea help={i === 0 ? "Specific enough that evidence could prove it wrong." : undefined}/>
      <Choice className="risk compact" label="Risk if wrong" name={`risk-${i}`} value={a.risk} options={["low", "medium", "high"] as const} onChange={risk => change(i, { risk })}/>
      <Field name={`assumption-${i}-method`} label="How will you test it?" required value={a.validationMethod} onChange={validationMethod => change(i, { validationMethod })} textarea/>
    </div>)}</div>
  </>;
}
