"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, X } from "lucide-react";
import { api, ClientError } from "@/lib/client-api";
import { startupInputSchema, type StartupInput } from "@/lib/domain/schemas";
import type { Startup, Workspace } from "@/lib/domain/types";
import { Choice, DraftOffer, ErrorNotice, Field, Spinner, useDirtyGuard, useDraftRecovery } from "./ui";

const editable = ["name", "description", "businessModel", "stage", "targetMarket", "customerSegment", "websiteUrl", "context"] as const;
type Draft = Pick<StartupInput, (typeof editable)[number]>;
const blank: Draft = { name: "", description: "", businessModel: "B2B", stage: "Idea", targetMarket: "", customerSegment: "", websiteUrl: "", context: "" };
const fromStartup = (s: Startup): Draft => Object.fromEntries(editable.map(k => [k, s[k]])) as Draft;
const fieldOrder = ["name", "description", "targetMarket", "customerSegment", "websiteUrl"];
const fieldNames: Record<string, string> = { name: "Startup name", description: "Description", targetMarket: "Target market", customerSegment: "Customer segment", websiteUrl: "Website" };

export function ProfileForm({ initial, onSaved, onCancel }: { initial?: Startup; onSaved?: () => Promise<void>; onCancel?: () => void }) {
  const router = useRouter();
  const [data, setData] = useState<Draft>(() => initial ? fromStartup(initial) : blank);
  const [custom, setCustom] = useState<[string, string][]>(() => Object.entries(initial?.customFields ?? {}));
  const [revision, setRevision] = useState(initial?.revision ?? 0);
  const [baseline, setBaseline] = useState(() => JSON.stringify({ data: initial ? fromStartup(initial) : blank, custom: Object.entries(initial?.customFields ?? {}) }));
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [focusToken, setFocusToken] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify({ data, custom }) !== baseline;
  useDirtyGuard(dirty);
  const recovery = useDraftRecovery(`orbit:draft:${initial?.id ?? "new"}:profile`, { data, custom }, dirty, revision, JSON.parse(baseline) as { data: Draft; custom: [string, string][] });
  function restoreDraft() { const o = recovery.accept(); if (o) { setData(o.value.data); setCustom(o.value.custom); if (initial) setRevision(o.revision); } }

  // Focus the error summary after it has rendered.
  useEffect(() => { if (focusToken) summary.current?.focus(); }, [focusToken]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) { setData(c => ({ ...c, [key]: value })); setFields(c => ({ ...c, [key]: "" })); }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(null); setFields({});
    const names = custom.map(([k]) => k.trim()).filter(Boolean);
    if (new Set(names).size !== names.length) { setError(new Error("Give each custom field a different name.")); setFocusToken(t => t + 1); return; }
    const customFields = Object.fromEntries(custom.filter(([k]) => k.trim()).map(([k, v]) => [k.trim(), v]));
    const parsed = startupInputSchema.omit({ preferences: true }).safeParse({ ...data, customFields });
    if (!parsed.success) {
      setFields(Object.fromEntries(parsed.error.issues.map(i => [String(i.path[0]), i.message])));
      setError(new Error("Some required details need attention."));
      setFocusToken(t => t + 1); return;
    }
    setSaving(true);
    try {
      const startup = await api<Startup>(initial ? `/api/startups/${initial.id}` : "/api/startups", {
        method: initial ? "PATCH" : "POST",
        body: JSON.stringify(initial ? { expectedRevision: revision, patch: parsed.data } : parsed.data),
      });
      setRevision(startup.revision);
      setBaseline(JSON.stringify({ data: fromStartup(startup), custom: Object.entries(startup.customFields) }));
      setData(fromStartup(startup)); setCustom(Object.entries(startup.customFields));
      if (onSaved) await onSaved(); else router.push(`/startups/${startup.id}`);
    } catch (err) {
      setError(err as Error); if (err instanceof ClientError) setFields(err.fields ?? {});
      setFocusToken(t => t + 1); setSaving(false);
      return;
    }
    if (onSaved) setSaving(false);
  }

  async function loadLatest() {
    if (!initial) return;
    if (!window.confirm("Replace your edits with the latest saved profile? Copy your draft first if you want to keep it.")) return;
    try {
      const ws = await api<Workspace>(`/api/startups/${initial.id}`);
      const latest = fromStartup(ws.startup);
      setData(latest); setCustom(Object.entries(ws.startup.customFields)); setRevision(ws.startup.revision);
      setBaseline(JSON.stringify({ data: latest, custom: Object.entries(ws.startup.customFields) }));
      setError(null); setFields({});
    } catch (err) { setError(err as Error); }
  }

  useEffect(() => {
    const keydown = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); form.current?.requestSubmit(); } };
    window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown);
  }, []);

  const conflict = error instanceof ClientError && error.status === 409;
  const invalid = fieldOrder.filter(k => fields[k]);
  return <form onSubmit={save} ref={form} noValidate className="profile-form">
    <DraftOffer offer={recovery.offer} currentRevision={revision} onRestore={restoreDraft} onDiscard={recovery.discard} what={initial ? "profile edit" : "startup profile"}/>
    {error && <div ref={summary} tabIndex={-1} className="error-summary" role="alert">
      <ErrorNotice error={conflict ? "This profile changed in another tab or by someone else. Load the latest version, or copy your draft first." : error}
        onReload={conflict ? () => void loadLatest() : undefined}
        onCopy={conflict ? () => void navigator.clipboard.writeText(JSON.stringify({ ...data, customFields: Object.fromEntries(custom) }, null, 2)) : undefined}/>
      {invalid.length > 0 && <ul>{invalid.map(k => <li key={k}><a href={`#field-${k}`} onClick={e => { e.preventDefault(); document.getElementById(`field-${k}`)?.focus(); }}>{fieldNames[k]}: {fields[k]}</a></li>)}</ul>}
    </div>}
    <fieldset disabled={saving}>
      <Field name="name" label="Startup name" value={data.name} onChange={v => update("name", v)} error={fields.name} required maxLength={120} autoComplete="organization"/>
      <Field name="description" label="Description" value={data.description} onChange={v => update("description", v)} error={fields.description} textarea required maxLength={2000} help="What you build, for whom, and why it matters. Two or three sentences."/>
      <div className="form-columns">
        <Choice name="businessModel" label="Business model" value={data.businessModel} options={["B2B", "B2C", "B2G"] as const} onChange={v => update("businessModel", v)}/>
        <Choice name="stage" label="Stage" value={data.stage} options={["Idea", "MVP", "Early Traction"] as const} onChange={v => update("stage", v)}/>
      </div>
      <Field name="targetMarket" label="Target country or market" value={data.targetMarket} onChange={v => update("targetMarket", v)} error={fields.targetMarket} required maxLength={200} help="A country, region or focused market, e.g. Kazakhstan, DACH, US mid-market."/>
      <Field name="customerSegment" label="Primary customer segment" value={data.customerSegment} onChange={v => update("customerSegment", v)} error={fields.customerSegment} required maxLength={500} help="Be specific, e.g. operations managers at logistics companies with 20–200 employees."/>
      <Field name="websiteUrl" label="Website (optional)" value={data.websiteUrl} onChange={v => update("websiteUrl", v)} error={fields.websiteUrl} type="url" inputMode="url" maxLength={2000} placeholder="https://"
        onBlur={() => { const v = data.websiteUrl.trim(); if (v && !/^[a-z]+:/i.test(v)) update("websiteUrl", `https://${v}`); }}/>
      <details className="context-disclosure" open={initial && (data.context || custom.length) ? true : undefined}>
        <summary>More context (optional)</summary>
        <Field name="context" label="Anything the plan should consider" value={data.context} onChange={v => update("context", v)} textarea maxLength={5000} help="Goals, constraints, team capacity, or what you already tried."/>
        <div className="custom-fields">
          <p className="field-label">Your own fields</p>
          <p className="field-help">Add up to 12 labelled facts, e.g. “30-day goal” or “Team capacity”.</p>
          {custom.map(([key, value], index) => <div className="custom-row" key={index}>
            <input className="input" aria-label={`Custom field ${index + 1} name`} value={key} maxLength={80} placeholder="Label" onChange={e => setCustom(rows => rows.map((r, i) => i === index ? [e.target.value, r[1]] : r))}/>
            <input className="input" aria-label={`Custom field ${index + 1} value`} value={value} maxLength={1000} placeholder="Value" onChange={e => setCustom(rows => rows.map((r, i) => i === index ? [r[0], e.target.value] : r))}/>
            <button type="button" className="icon-button" aria-label={`Remove custom field ${key || index + 1}`} onClick={() => setCustom(rows => rows.filter((_, i) => i !== index))}><X size={17}/></button>
          </div>)}
          <button type="button" className="button small" disabled={custom.length >= 12} onClick={() => setCustom(rows => [...rows, ["", ""]])}><Plus size={15} aria-hidden/>Add field</button>
        </div>
      </details>
      <div className="form-footer">
        <button className="button primary" aria-busy={saving}>{saving ? <><Spinner/>Saving…</> : initial ? "Save profile" : <>Create startup<ArrowRight size={17} aria-hidden/></>}</button>
        {onCancel && <button type="button" className="button ghost" onClick={() => { if (!dirty || window.confirm("Discard your unsaved profile edits?")) onCancel(); }}>Cancel</button>}
      </div>
    </fieldset>
  </form>;
}
