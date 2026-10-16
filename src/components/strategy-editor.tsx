"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Plus, Save, X } from "lucide-react";
import { calculateCompletion, fieldLabels, sectionCompletion, sectionTitles } from "@/lib/domain/completion";
import { sectionKeys, sectionSchemas, type SectionKey, type StrategyData } from "@/lib/domain/schemas";
import type { StrategySection } from "@/lib/domain/types";
import { api, ClientError } from "@/lib/client-api";
import { Badge, Choice, ErrorNotice, Field, useDirtyGuard } from "./ui";
import { useWorkspace } from "./workspace";

const sectionHelp: Record<SectionKey,string> = {
  icp: "Find the person whose problem is worth solving first.", value: "Turn what you build into a promise your customer can understand.",
  channels: "Go where your first customers already are. Small, specific tests work best.", pricing: "Make a clear first offer. A thoughtful assumption is a good starting point.",
  assumptions: "Name what could change your direction, then decide how to test it.",
};
const hints: Record<string,string> = {
  buyerType: "Who signs or pays? A role is more useful than 'everyone'.", industry: "An industry, company size, demographic, or shared situation.",
  painPoint: "What do they struggle with today?", buyingTrigger: "What event makes them look for a solution now?",
  problem: "Describe the problem in your customer's words.", outcome: "What becomes meaningfully better?", differentiation: "Why choose your approach over their current alternative?",
  proof: "Evidence you have, or assumptions you still need to test. It is fine to say 'assumption'.",
  model: "Subscription, usage-based, a paid pilot, a combination — use what fits.", initialPrice: "A range, a pilot price, or a first guess: '$49/month', '$2–5k pilot'.",
  paymentUnit: "Per seat, per order, per site, per project…", rationale: "Why is this a reasonable starting point for this customer?",
};
export function StrategyEditor() {
  const { workspace } = useWorkspace(); const search = useSearchParams(); const router = useRouter();
  const first = workspace.completion.sections.find(s => !s.complete)?.key ?? "icp";
  const requested = search.get("section"); const selected = sectionKeys.includes(requested as SectionKey) ? requested as SectionKey : first;
  const [dirty,setDirty] = useState(false);
  function select(key: SectionKey) { if (key !== selected && (!dirty || confirm("Leave this section without saving your changes?"))) { setDirty(false); router.replace(`?section=${key}`,{ scroll: false }); } }
  return <><div className="page-heading"><div><span className="index-label">FIVE DECISIONS. YOUR ORDER.</span><h1 tabIndex={-1}>Shape your strategy.</h1><p className="muted">Think freely. Save a draft. Come back with better questions.</p></div><div className="heading-stat"><strong>{workspace.completion.percentage}<span>%</span></strong><span className="muted">inputs complete · {workspace.completion.completed}/5</span></div></div>
    <div className="strategy-layout"><nav className="section-nav" aria-label="Strategy sections">{workspace.completion.sections.map((s,index) => <button key={s.key} onClick={() => select(s.key)} aria-current={selected === s.key ? "step" : undefined} className={selected === s.key ? "selected" : ""}><span className="section-number">0{index + 1}</span><span><strong>{s.title}</strong><span className="section-meta">{s.complete ? "Ready to test" : `${s.missing.length} details to explore`}</span></span><span className={`section-dot ${s.complete ? "complete" : workspace.sections[index].revision ? "draft" : ""}`}/></button>)}<p className="field-help">Complete means the required inputs are filled. It does not mean the strategy is proven.</p></nav>
    <AnimatePresence mode="wait"><motion.div key={selected} initial={{ opacity: 0,y: 8 }} animate={{ opacity: 1,y: 0 }} exit={{ opacity: 0,y: -5 }} transition={{ duration: .18 }}><SectionEditor section={workspace.sections.find(s => s.key === selected)!} onDirtyChange={setDirty} onNext={() => select(sectionKeys[(sectionKeys.indexOf(selected)+1)%5])}/></motion.div></AnimatePresence></div></>;
}
function SectionEditor({ section,onDirtyChange,onNext }: { section: StrategySection;onDirtyChange: (v: boolean) => void;onNext: () => void }) {
  const { workspace,refresh,notify } = useWorkspace();
  const [data,setData] = useState<StrategyData>(section.data); const [notes,setNotes] = useState(section.notes);
  const [revision,setRevision] = useState(section.revision); const [saving,setSaving] = useState(false); const [error,setError] = useState<Error | null>(null);
  const [savedAt,setSavedAt] = useState(section.updatedAt); const [baseline,setBaseline] = useState(JSON.stringify({ data: section.data,notes: section.notes }));
  const form = useRef<HTMLFormElement>(null); const dirty = JSON.stringify({ data,notes }) !== baseline;
  useDirtyGuard(dirty);
  useEffect(() => { onDirtyChange(dirty); },[dirty,onDirtyChange]);
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); form.current?.requestSubmit(); } };
    window.addEventListener("keydown",keydown); return () => window.removeEventListener("keydown",keydown);
  },[]);
  const completion = sectionCompletion(section.key,data);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(null);
    try {
      const result = await api<StrategySection>(`/api/startups/${workspace.startup.id}/strategy/${section.key}`,{ method: "PUT",body: JSON.stringify({ expectedRevision: revision,data,notes }) });
      setData(result.data); setNotes(result.notes); setRevision(result.revision); setSavedAt(result.updatedAt); setBaseline(JSON.stringify({ data: result.data,notes: result.notes }));
      notify(`${sectionTitles[section.key]} saved${sectionCompletion(section.key,result.data).complete ? "" : " as a draft"}`);
      await refresh();
    } catch (err) { setError(err as Error); } finally { setSaving(false); }
  }
  async function reload() {
    if (!confirm("Load the latest saved version? Copy your draft first if you want to keep it.")) return;
    const latest = await api<typeof workspace>(`/api/startups/${workspace.startup.id}`); const next = latest.sections.find(s => s.key === section.key)!;
    setData(next.data); setNotes(next.notes); setRevision(next.revision); setBaseline(JSON.stringify({ data: next.data,notes: next.notes })); setSavedAt(next.updatedAt); setError(null); await refresh();
  }
  function setText(key: string,value: string) { setData(current => ({ ...current,[key]: value })); }
  function textField(key: string) {
    return <Field key={key} name={key} label={fieldLabels[key] ?? key} value={String((data as unknown as Record<string,unknown>)[key] ?? "")} onChange={v => setText(key,v)} textarea help={hints[key]} maxLength={["initialPrice","paymentUnit"].includes(key) ? 500 : 3000}/>;
  }
  return <form className="editor-surface" onSubmit={save} ref={form}><div className="editor-heading"><div><span className="index-label">0{sectionKeys.indexOf(section.key)+1} / STRATEGY</span><h2>{sectionTitles[section.key]}</h2></div><Badge status={completion.complete ? "complete" : revision ? "draft" : "empty"}/></div><p className="muted editor-lead">{sectionHelp[section.key]}</p>
    <div className="save-indicator" aria-live="polite">{saving ? "Saving…" : dirty ? "Unsaved changes" : savedAt ? `Saved · ${new Date(savedAt).toLocaleTimeString([], { hour: "2-digit",minute: "2-digit" })}` : "A blank page is a valid starting point."}</div>
    <ErrorNotice error={error} onReload={error instanceof ClientError && error.status === 409 ? () => void reload() : undefined} onCopy={error instanceof ClientError && error.status === 409 ? () => void navigator.clipboard.writeText(JSON.stringify({ data,notes },null,2)) : undefined}/>
    <fieldset disabled={saving}>
      {section.key === "icp" && ["buyerType","industry","painPoint","buyingTrigger"].map(textField)}
      {section.key === "value" && ["problem","outcome","differentiation","proof"].map(textField)}
      {section.key === "pricing" && ["model","initialPrice","paymentUnit","rationale"].map(textField)}
      {section.key === "channels" && <Channels data={sectionSchemas.channels.parse(data)} onChange={setData}/>}
      {section.key === "assumptions" && <Assumptions data={sectionSchemas.assumptions.parse(data)} onChange={setData}/>}
      <details className="context-disclosure"><summary>Notes, constraints, or a thought for later</summary><Field name="section-notes" label="Your notes" value={notes} onChange={setNotes} textarea maxLength={5000}/></details>
      <details className="completeness-details"><summary>{completion.complete ? <><Check size={15}/>All required inputs are here</> : `${completion.missing.length} details needed for Complete`}</summary>{completion.complete ? <p className="field-help">The next step is testing, not assuming this is proven.</p> : <ul>{completion.missing.map(label => <li key={label}>{label}</li>)}</ul>}</details>
      <div className="editor-footer"><button className="button primary" disabled={saving} aria-busy={saving}><Save size={16}/>{saving ? "Saving…" : "Save section"}</button><button type="button" className="button ghost" onClick={onNext}>Next section<ArrowRight size={16}/></button><span className="field-help">Incomplete is okay. Drafts are welcome.</span></div>
    </fieldset></form>;
}
function Channels({ data,onChange }: { data: ReturnType<typeof sectionSchemas.channels.parse>;onChange: (v: StrategyData) => void }) {
  const channels = data.channels.length ? data.channels : [{ name: "",reason: "" }];
  return <><datalist id="channel-suggestions">{["Founder outreach","Cold email","Communities","Content / SEO","Partnerships","Events","Referrals","Paid ads"].map(v => <option value={v} key={v}/>)}</datalist>{channels.map((channel,index) => <div className="channel-row" key={index}><div className="row-label"><span className="index-label">CHANNEL 0{index+1}</span>{channels.length > 1 && <button type="button" className="icon-button" aria-label={`Remove channel ${index+1}`} onClick={() => onChange({ ...data,channels: channels.filter((_,i) => i !== index) })}><X size={17}/></button>}</div><div className="field"><label htmlFor={`field-channel-${index}`}>Channel name</label><input id={`field-channel-${index}`} list="channel-suggestions" maxLength={120} value={channel.name} placeholder="Choose a suggestion or write your own" onChange={e => onChange({ ...data,channels: channels.map((c,i) => i === index ? { ...c,name: e.target.value } : c) })}/></div><Field name={`channel-${index}-reason`} label="Why this channel?" value={channel.reason} textarea onChange={reason => onChange({ ...data,channels: channels.map((c,i) => i === index ? { ...c,reason } : c) })}/></div>)}<button type="button" className="button small" disabled={channels.length >= 3} onClick={() => onChange({ ...data,channels: [...channels,{ name: "",reason: "" }] })}><Plus size={15}/>Add channel</button><p className="field-help">Up to three. A focused test beats a long list.</p><Field name="firstExperiment" label="First acquisition experiment" value={data.firstExperiment} onChange={firstExperiment => onChange({ ...data,firstExperiment })} textarea help="A small test with an audience, a time limit, and a measurable success criterion."/></>;
}
function Assumptions({ data,onChange }: { data: ReturnType<typeof sectionSchemas.assumptions.parse>;onChange: (v: StrategyData) => void }) {
  const assumptions = Array.from({ length: 3 },(_,i) => data.assumptions[i] ?? { statement: "",risk: "medium" as const,validationMethod: "" });
  function change(index: number,patch: Partial<(typeof assumptions)[number]>) { onChange({ assumptions: assumptions.map((a,i) => i === index ? { ...a,...patch } : a) }); }
  return <>{assumptions.map((assumption,index) => <div className="assumption-row" key={index}><div className="row-label"><h3>Assumption 0{index+1}</h3><Badge status="untested"/></div><Field name={`assumption-${index}-statement`} label="What do you believe is true?" value={assumption.statement} onChange={statement => change(index,{ statement })} textarea help="A specific statement you could discover is wrong."/><Choice label="Risk if wrong" name={`risk-${index}`} value={assumption.risk} options={["low","medium","high"]} onChange={risk => change(index,{ risk })}/><Field name={`assumption-${index}-method`} label="How will you test it?" value={assumption.validationMethod} onChange={validationMethod => change(index,{ validationMethod })} textarea/></div>)}<p className="field-help">These remain untested assumptions. Completing the fields does not validate them.</p></>;
}
