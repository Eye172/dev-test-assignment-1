"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, X } from "lucide-react";
import { api, ClientError } from "@/lib/client-api";
import { startupInputSchema, type StartupInput } from "@/lib/domain/schemas";
import type { Startup } from "@/lib/domain/types";
import { Choice, ErrorNotice, Field, useDirtyGuard } from "./ui";

const blank = { name: "",description: "",businessModel: "B2B",stage: "Idea",targetMarket: "",customerSegment: "",websiteUrl: "",context: "",customFields: {},preferences: startupInputSchema.shape.preferences.parse(undefined) } satisfies StartupInput;
export function ProfileForm({ initial,onSaved,onCancel }: { initial?: Startup;onSaved?: () => Promise<void>;onCancel?: () => void }) {
  const [data,setData] = useState<StartupInput>(() => initial ? startupInputSchema.parse(Object.fromEntries(Object.keys(blank).map(key => [key,initial[key as keyof Startup]]))) : blank);
  const [fields,setFields] = useState<Record<string,string>>({}); const [error,setError] = useState<Error | null>(null); const [saving,setSaving] = useState(false);
  const original = useRef(JSON.stringify(data)); const form = useRef<HTMLFormElement>(null); const router = useRouter();
  const [custom,setCustom] = useState<[string,string][]>(() => Object.entries(initial?.customFields ?? {}));
  const dirty = JSON.stringify(data) !== original.current || JSON.stringify(custom) !== JSON.stringify(Object.entries(initial?.customFields ?? {}));
  useDirtyGuard(dirty && !saving);
  function update<K extends keyof StartupInput>(key: K,value: StartupInput[K]) { setData(current => ({ ...current,[key]: value })); setFields(current => ({ ...current,[key]: "" })); }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(null); setFields({});
    const duplicate = custom.some(([key],index) => key.trim() && custom.findIndex(([candidate]) => candidate.trim() === key.trim()) !== index);
    if (duplicate) { setError(new Error("Give each custom field a different name.")); return; }
    const result = startupInputSchema.safeParse({ ...data,customFields: Object.fromEntries(custom.filter(([key]) => key.trim())) });
    if (!result.success) { setFields(Object.fromEntries(result.error.issues.map(i => [i.path.join("."),i.message]))); setError(new Error("Check the fields below before saving.")); form.current?.querySelector<HTMLElement>(".error-notice")?.focus(); return; }
    setSaving(true);
    try {
      const startup = await api<Startup>(initial ? `/api/startups/${initial.id}` : "/api/startups",{ method: initial ? "PATCH" : "POST",body: JSON.stringify(initial ? { expectedRevision: initial.revision,patch: result.data } : result.data) });
      original.current = JSON.stringify(data);
      if (onSaved) await onSaved(); else router.push(`/startups/${startup.id}`);
    } catch (err) { setError(err as Error); if (err instanceof ClientError) setFields(err.fields ?? {}); } finally { setSaving(false); }
  }
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); form.current?.requestSubmit(); } };
    window.addEventListener("keydown",keydown); return () => window.removeEventListener("keydown",keydown);
  },[]);
  return <form onSubmit={save} ref={form} noValidate className="profile-form"><ErrorNotice error={error} onCopy={error instanceof ClientError && error.status === 409 ? () => void navigator.clipboard.writeText(JSON.stringify(data,null,2)) : undefined} onReload={error instanceof ClientError && error.status === 409 ? () => router.refresh() : undefined}/><fieldset disabled={saving}>
    <Field name="name" label="Startup name" value={data.name} onChange={v => update("name",v)} error={fields.name} required maxLength={120} placeholder="What are you building?"/>
    <Field name="description" label="The short version" value={data.description} onChange={v => update("description",v)} error={fields.description} textarea required maxLength={2000} help="What it does, who it helps, and why it matters."/>
    <div className="form-columns"><Choice name="businessModel" label="Who do you sell to?" value={data.businessModel} options={["B2B","B2C","B2G"]} onChange={v => update("businessModel",v)}/><Choice name="stage" label="Where are you now?" value={data.stage} options={["Idea","MVP","Early Traction"]} onChange={v => update("stage",v)}/></div>
    <Field name="targetMarket" label="Target country or market" value={data.targetMarket} onChange={v => update("targetMarket",v)} error={fields.targetMarket} required maxLength={200} placeholder="A country, region, or focused market"/>
    <Field name="customerSegment" label="Your first customer segment" value={data.customerSegment} onChange={v => update("customerSegment",v)} error={fields.customerSegment} required maxLength={500} help="Be specific. For example: operations managers at small logistics companies."/>
    <Field name="websiteUrl" label="Website (optional)" value={data.websiteUrl} onChange={v => update("websiteUrl",v)} error={fields.websiteUrl} type="url" maxLength={2000} placeholder="https://" onBlur={() => { const v = data.websiteUrl.trim(); if (v && !/^[a-z]+:/i.test(v)) update("websiteUrl",`https://${v}`); }}/>
    <details className="context-disclosure" open={initial ? true : undefined}><summary>A little more context (optional)</summary><Field name="context" label="What should this workspace know?" value={data.context} onChange={v => update("context",v)} textarea maxLength={5000} placeholder="Your goals, constraints, team capacity, or anything that changes the plan."/>{initial && <div className="custom-fields"><h3>Your own fields</h3><p className="field-help">Keep the context that matters to your startup.</p>{custom.map(([key,value],index) => <div className="custom-row" key={index}><input aria-label={`Custom field ${index + 1} name`} value={key} maxLength={80} placeholder="Field name" onChange={e => setCustom(rows => rows.map((row,i) => i === index ? [e.target.value,row[1]] : row))}/><input aria-label={`Custom field ${index + 1} value`} value={value} maxLength={1000} placeholder="Your context" onChange={e => setCustom(rows => rows.map((row,i) => i === index ? [row[0],e.target.value] : row))}/><button type="button" className="icon-button" aria-label={`Remove custom field ${index + 1}`} onClick={() => setCustom(rows => rows.filter((_,i) => i !== index))}><X size={17}/></button></div>)}<button type="button" className="button small" disabled={custom.length >= 12} onClick={() => setCustom(rows => [...rows,["",""]])}><Plus size={15}/>Add a field</button></div>}</details>
    <div className="form-footer"><button className="button primary" disabled={saving} aria-busy={saving}>{saving ? "Saving…" : initial ? "Save profile" : "Create startup"}<ArrowRight size={17}/></button>{onCancel && <button type="button" className="button ghost" onClick={() => { if (!dirty || confirm("Discard your unsaved profile edits?")) onCancel(); }}>Cancel</button>}<span className="field-help">{initial ? "Your changes are saved to the database." : "Demo mode. Use synthetic, non-sensitive information."}</span></div>
  </fieldset></form>;
}
