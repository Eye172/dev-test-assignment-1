"use client";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { emptyDraft, type IntakeDraft, type Model, type Stage } from "../intake/extract";
import { FileAttach, type Attached } from "./files";
import { buyerRoles, businessTypes, channelOptions, marketGroups, modelOptions, pricingModels, sizeOptions, stageOptions, stageSignals } from "./guided-options";

export type GuidedState = {
  name: string; oneLiner: string; model: Model | ""; types: string[]; otherType: string; stage: Stage | ""; signals: string[];
  markets: string[]; otherMarket: string; roles: string[]; sizes: string[]; industry: string; segment: string;
  pain: string; pricing: string; price: string; channels: string[]; website: string;
};
export const emptyGuided: GuidedState = { name: "", oneLiner: "", model: "", types: [], otherType: "", stage: "", signals: [], markets: [], otherMarket: "", roles: [], sizes: [], industry: "", segment: "", pain: "", pricing: "", price: "", channels: [], website: "" };

/** The founder's own segment sentence wins; otherwise it is composed from the chosen role, size and industry. */
export function composedSegment(g: GuidedState) {
  if (g.segment.trim()) return g.segment.trim();
  const who = g.roles.join(" and ");
  const size = g.sizes.length ? (g.model === "B2B" ? `at companies with ${g.sizes.join(" or ").replace(/ employees/g, "")} employees` : `· ${g.sizes.join(" or ").toLowerCase()}`) : "";
  return [who, g.industry.trim() && `in ${g.industry.trim()}`, size].filter(Boolean).join(" ");
}

export function guidedToDraft(g: GuidedState): IntakeDraft {
  const d = emptyDraft();
  const markets = [...g.markets, g.otherMarket.trim()].filter(Boolean);
  const put = <K extends keyof IntakeDraft["profile"]>(k: K, v: IntakeDraft["profile"][K], o: "answer" | "choice") => { if (v) { d.profile[k] = v; d.origin[k] = o; } };
  put("name", g.name.trim(), "answer"); put("description", g.oneLiner.trim(), "answer");
  put("businessModel", g.model, "choice"); put("stage", g.stage, "choice");
  put("targetMarket", markets.slice(0, 2).join(" and "), "choice"); put("customerSegment", composedSegment(g), g.segment.trim() ? "answer" : "choice");
  put("websiteUrl", g.website.trim() && !/^https?:/i.test(g.website.trim()) ? `https://${g.website.trim()}` : g.website.trim(), "answer");
  if (g.pain.trim()) { d.hints.painPoint = g.pain.trim(); d.origin.painPoint = "answer"; }
  if (g.price.trim()) { d.hints.price = g.price.trim(); d.origin.price = "answer"; }
  if (g.pricing && g.pricing !== "Not sure yet") { d.hints.pricingModel = g.pricing; d.origin.pricingModel = "choice"; }
  if (g.channels.length) { d.hints.channels = g.channels.slice(0, 3); d.origin.channels = "choice"; }
  return d;
}

const topics = ["Basics", "Who pays", "Stage", "Market", "First customer", "Problem and price", "Material"] as const;
const ease = [0.22, 1, 0.36, 1] as const;

export function GuidedBrief({ value: g, onChange, onBack, onDone,onManualDone, files, onFiles,topic=0,onTopic,readingFiles=false,onReading }: { value: GuidedState; onChange: (g: GuidedState) => void; onBack: () => void; onDone: () => void;onManualDone:()=>void; files: Attached[]; onFiles: (f: Attached[]) => void;topic?:number;onTopic?:(n:number)=>void;readingFiles?:boolean;onReading?:(busy:boolean)=>void }) {
  const i=topic;
  const set = (p: Partial<GuidedState>) => onChange({ ...g, ...p });
  const toggle = (k: "types" | "signals" | "markets" | "roles" | "sizes" | "channels", v: string, max = 99) =>
    set({ [k]: g[k].includes(v) ? g[k].filter(x => x !== v) : g[k].length < max ? [...g[k], v] : g[k] } as Partial<GuidedState>);
  const done = [!!(g.name.trim() && g.oneLiner.trim()), !!g.model, !!g.stage, !!(g.markets.length || g.otherMarket.trim()), !!composedSegment(g), !!(g.pain || g.price || g.channels.length), files.length > 0];
  const move = (n: number) => { if(readingFiles)return;onTopic?.(n); };
  const next = () => {if(readingFiles)return;if(i < topics.length - 1)move(i+1);else onDone();};
  // Plain render helpers (not components), so inputs keep focus and state across renders.
  const chips = (k: "types" | "signals" | "markets" | "roles" | "sizes" | "channels", options: string[], max?: number) =>
    <div className="chip-row" role="group">{options.map(o => <button type="button" key={o} className={`chip ${g[k].includes(o) ? "on" : ""}`} aria-pressed={g[k].includes(o)} onClick={() => toggle(k, o, max)}>{o}</button>)}</div>;
  const cards = <T extends string>(options: { value: T; title: string; detail: string }[], value: string, onPick: (v: T) => void) =>
    <div className="pick-cards" role="radiogroup">{options.map(o => <button type="button" role="radio" aria-checked={value === o.value} key={o.value} className={`pick-card ${value === o.value ? "on" : ""}`} onClick={() => onPick(o.value)}>
      <span className="pick-tag">{o.value}</span><span className="pick-title">{o.title}</span><span className="pick-detail">{o.detail}</span>{value === o.value && <Check size={16} className="pick-check" aria-hidden/>}
    </button>)}</div>;

  return <section className="flow-panel guided" aria-labelledby="guided-title">
    <button type="button" className="text-link back-link" onClick={() => i ? move(i - 1) : onBack()}><ArrowLeft size={16} aria-hidden/>Back</button>
    <p className="eyebrow">Guided brief · {i + 1} of {topics.length}</p>
    <h1 id="guided-title" tabIndex={-1} className="sr-only">Guided brief</h1>
    <div className="guided-layout">
      <nav className="guided-rail" aria-label="Brief topics"><ol>{topics.map((t, n) => <li key={t}>
        <button type="button" aria-current={n === i ? "step" : undefined} className={`${n === i ? "now" : ""} ${done[n] ? "done" : ""}`} onClick={() => move(n)}>
          <span className="rail-n" aria-hidden>{done[n] ? <Check size={12} strokeWidth={3}/> : n + 1}</span>{t}</button></li>)}</ol></nav>
      <div className="guided-stage">
          <motion.div key={i} initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{ duration: 0.14, ease }}
            className="guided-topic" onKeyDown={e => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); next(); } }}>
            {i === 0 && <>
              <h2>What is it called, and what does it do?</h2>
              <label className="g-field"><span>Name</span><input className="input" value={g.name} onChange={e => set({ name: e.target.value })} placeholder="Fieldnote" autoFocus maxLength={120}/></label>
              <label className="g-field"><span>One sentence: what you build and for whom</span><textarea className="input" rows={3} value={g.oneLiner} onChange={e => set({ oneLiner: e.target.value })} maxLength={2000} placeholder="A workspace that turns customer interviews into product decisions for small SaaS teams."/></label>
            </>}
            {i === 1 && <>
              <h2>Who pays you?</h2>
              {cards(modelOptions, g.model, v => set({ model: v, roles: [], sizes: [] }))}
              <p className="g-sub">What kind of business is it? <span className="faint">Pick any that fit.</span></p>
              {chips("types", businessTypes)}
              {g.types.includes("Other") && <input className="input" maxLength={200} value={g.otherType} onChange={e => set({ otherType: e.target.value })} placeholder="Describe the type" aria-label="Other business type"/>}
            </>}
            {i === 2 && <>
              <h2>Where are you today?</h2>
              {cards(stageOptions, g.stage, v => set({ stage: v }))}
              <p className="g-sub">What do you already have? <span className="faint">This shapes week 1.</span></p>
              {chips("signals", stageSignals)}
            </>}
            {i === 3 && <>
              <h2>Which market do you want to win first?</h2>
              <p className="field-help">Pick one or two. Starting narrow makes channels and prices testable.</p>
              {marketGroups.map(gr => <div key={gr.label} className="g-group"><p className="g-sub small">{gr.label}</p>{chips("markets", gr.options, 2)}</div>)}
              <label className="g-field"><span>Or type it</span><input className="input" maxLength={200} value={g.otherMarket} onChange={e => set({ otherMarket: e.target.value })} placeholder="Almaty fintech startups, Nordics, Gulf region…"/></label>
            </>}
            {i === 4 && <>
              <h2>Who feels the problem most — and pays first?</h2>
              {!g.model ? <p className="info-notice">Choose who pays first (topic 2) to see matching roles.</p> : <>
                <p className="g-sub">Role</p>{chips("roles", buyerRoles[g.model], 2)}
                <p className="g-sub">{g.model === "B2C" ? "Age group" : g.model === "B2B" ? "Company size" : "Level"}</p>{chips("sizes", sizeOptions[g.model], 2)}
                <label className="g-field"><span>Industry or situation <span className="faint">optional</span></span><input className="input" maxLength={200} value={g.industry} onChange={e => set({ industry: e.target.value })} placeholder="logistics, dental clinics, first-year university"/></label>
              </>}
              <label className="g-field"><span>In your words <span className="faint">overrides the choices above</span></span><input className="input" maxLength={500} value={g.segment} onChange={e => set({ segment: e.target.value })} placeholder={composedSegment(g) || "Operations managers at logistics companies with 20–200 employees"}/></label>
              {composedSegment(g) && <p className="g-preview">Your first customer: <strong>{composedSegment(g)}</strong></p>}
            </>}
            {i === 5 && <>
              <h2>The problem, the price, the first channel.</h2>
              <p className="field-help">All optional — each answer becomes a draft you review later. Guesses are fine; the plan turns them into tests.</p>
              <label className="g-field"><span>What do they struggle with today?</span><input className="input" maxLength={3000} value={g.pain} onChange={e => set({ pain: e.target.value })} placeholder="Interview notes are scattered across docs and calls"/></label>
              <p className="g-sub">How would they pay?</p>
              <div className="chip-row" role="radiogroup">{pricingModels.map(p => <button type="button" role="radio" aria-checked={g.pricing === p} key={p} className={`chip ${g.pricing === p ? "on" : ""}`} onClick={() => set({ pricing: g.pricing === p ? "" : p })}>{p}</button>)}</div>
              <label className="g-field"><span>First price guess</span><input className="input" maxLength={500} value={g.price} onChange={e => set({ price: e.target.value })} placeholder="$29 per workspace per month"/></label>
              <p className="g-sub">Where are your first customers? <span className="faint">Up to three.</span></p>
              {chips("channels", channelOptions, 3)}
            </>}
            {i === 6 && <>
              <h2>Anything you already have?</h2>
              <label className="g-field"><span>Website <span className="faint">optional</span></span><input className="input" maxLength={2000} value={g.website} onChange={e => set({ website: e.target.value })} inputMode="url" placeholder="fieldnote.app"/></label>
              <FileAttach files={files} onChange={onFiles} onReading={onReading}/>
            </>}
          </motion.div>
        <div className="flow-actions">
          <button type="button" className="button primary" disabled={readingFiles} onClick={next}>{i < topics.length - 1 ? "Next" : "Continue with AI"}<ArrowRight size={17} aria-hidden className="arrow"/></button>
          {i===topics.length-1&&<button type="button" className="button ghost" disabled={readingFiles} onClick={onManualDone}>Review profile without AI</button>}
          {i < topics.length - 1 && !done[i] && <button type="button" className="button ghost" onClick={next}>Skip for now</button>}
        </div>
      </div>
    </div>
  </section>;
}
