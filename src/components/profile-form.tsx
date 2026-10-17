"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Sparkles, X } from "lucide-react";
import { z } from "zod";
import { api, ClientError } from "@/lib/client-api";
import { startupInputSchema, type StartupInput } from "@/lib/domain/schemas";
import type { Startup, Workspace } from "@/lib/domain/types";
import { Choice, ErrorNotice, Field, Spinner, useDirtyGuard, useHydrated } from "./ui";
import { clearDraft, clearSubmittedDraft, useDraftRecovery } from "./draft-recovery";
import { useDisplay } from "@/ui/display";

const editable = ["name", "description", "businessModel", "stage", "targetMarket", "customerSegment", "websiteUrl", "context"] as const;
type Draft = Pick<StartupInput, (typeof editable)[number]>;
const blank: Draft = { name: "", description: "", businessModel: "B2B", stage: "Idea", targetMarket: "", customerSegment: "", websiteUrl: "", context: "" };
const fromStartup = (s: Startup): Draft => Object.fromEntries(editable.map(k => [k, s[k]])) as Draft;
// A clearly synthetic sample, for reviewers who want to see the flow without inventing a company.
const sample: Draft = { name: "Harbor pilot — synthetic example", description: "A scheduling assistant that helps small logistics teams plan dock slots and avoid truck waiting fees.",
  businessModel: "B2B", stage: "MVP", targetMarket: "Kazakhstan", customerSegment: "Operations managers at logistics companies with 20–200 employees", websiteUrl: "", context: "Synthetic demonstration data. Goal: three paid pilots in 30 days." };
const fieldOrder = ["name", "description", "targetMarket", "customerSegment", "websiteUrl"];
const recoverySchema = z.object({
  data: z.object({ name: z.string(),description: z.string(),businessModel: z.enum(["B2B","B2C","B2G"]),stage: z.enum(["Idea","MVP","Early Traction"]),targetMarket: z.string(),customerSegment: z.string(),websiteUrl: z.string(),context: z.string() }),
  custom: z.array(z.tuple([z.string(),z.string()])),revision: z.number().int().nonnegative(),baseline: z.string(),
});

export type ProfileSeed = Partial<Draft> & { customFields?: Record<string, string> };
export function ProfileForm({ initial, seed, origins, onSaved, onCancel, onReloaded, submitLabel, recoveryScope, creationRequestId }: { initial?: Startup; seed?: ProfileSeed; origins?: Partial<Record<string, string>>; onSaved?: (startup: Startup) => void | Promise<void>; onCancel?: () => void; onReloaded?: (workspace: Workspace) => void; submitLabel?: string; recoveryScope?:string;creationRequestId?:string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const { t, tk } = useDisplay();
  const start = initial ? fromStartup(initial) : { ...blank, ...Object.fromEntries(Object.entries(seed ?? {}).filter(([k, v]) => k !== "customFields" && v)) } as Draft;
  const startCustom = Object.entries(initial?.customFields ?? seed?.customFields ?? {});
  const [data, setData] = useState<Draft>(start);
  const [custom, setCustom] = useState<[string, string][]>(startCustom);
  const [revision, setRevision] = useState(initial?.revision ?? 0);
  // A seeded form starts clean: the seed is the founder's own input from the previous step.
  const [baseline, setBaseline] = useState(() => JSON.stringify({ data: start, custom: startCustom }));
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [focusToken, setFocusToken] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify({ data, custom }) !== baseline;
  useDirtyGuard(dirty);
  const draftKey = `profile:${initial?.id ?? recoveryScope ?? "new"}`;
  useDraftRecovery(draftKey,{ data,custom,revision,baseline },dirty,value => {
    const recovered = recoverySchema.parse(value);
    if(seed&&!initial){
      const previous=JSON.parse(recovered.baseline) as {data:Draft;custom:[string,string][]};
      const rebased=Object.fromEntries(editable.map(k=>[k,recovered.data[k]===previous.data[k]?start[k]:recovered.data[k]])) as Draft;
      setData(rebased);setCustom(JSON.stringify(recovered.custom)===JSON.stringify(previous.custom)?startCustom:recovered.custom);setBaseline(JSON.stringify({data:start,custom:startCustom}));return;
    }
    setData(recovered.data); setCustom(recovered.custom); setRevision(recovered.revision); setBaseline(recovered.baseline);
  });

  // Focus the error summary after it has rendered.
  useEffect(() => { if (focusToken) summary.current?.focus(); }, [focusToken]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) { setData(c => ({ ...c, [key]: value })); setFields(c => ({ ...c, [key]: "" })); }

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (saving) return; setError(null); setFields({});
    const names = custom.map(([k]) => k.trim()).filter(Boolean);
    if (new Set(names).size !== names.length) { setError(new Error(t("pf.uniqueFields"))); setFocusToken(t => t + 1); return; }
    const customFields = Object.fromEntries(custom.filter(([k]) => k.trim()).map(([k, v]) => [k.trim(), v]));
    const parsed = startupInputSchema.omit({ preferences: true }).safeParse({ ...data, customFields });
    if (!parsed.success) {
      setFields(Object.fromEntries(parsed.error.issues.map(i => [String(i.path[0]), tk(`pf.err.${String(i.path[0])}`, undefined, i.message)])));
      setError(new Error(t("pf.attention")));
      setFocusToken(t => t + 1); return;
    }
    setSaving(true);
    try {
      const startup = await api<Startup>(initial ? `/api/startups/${initial.id}` : "/api/startups", {
        method: initial ? "PATCH" : "POST",
        ...(!initial&&creationRequestId?{headers:{"Idempotency-Key":creationRequestId}}:{}),
        // New workspaces follow the device's light or dark setting until the founder picks one.
        body: JSON.stringify(initial ? { expectedRevision: revision, patch: parsed.data } : { ...parsed.data, preferences: { theme: "system", density: "comfortable", motion: "full", accent: "green", dashboardLayout: null } }),
      });
      setRevision(startup.revision);
      clearSubmittedDraft(draftKey,{ data,custom,revision,baseline });
      setBaseline(JSON.stringify({ data: fromStartup(startup), custom: Object.entries(startup.customFields) }));
      setData(fromStartup(startup)); setCustom(Object.entries(startup.customFields));
      if (onSaved) await onSaved(startup); else router.push(`/startups/${startup.id}`);
    } catch (err) {
      setError(err as Error); if (err instanceof ClientError) setFields(err.fields ?? {});
      setFocusToken(t => t + 1); setSaving(false);
      return;
    }
    if (onSaved) setSaving(false);
  }

  async function loadLatest() {
    if (!initial) return;
    if (!window.confirm(t("st.reloadConfirm"))) return;
    try {
      const ws = await api<Workspace>(`/api/startups/${initial.id}`);
      onReloaded?.(ws);
      const latest = fromStartup(ws.startup);
      clearSubmittedDraft(draftKey,{ data,custom,revision,baseline });
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
  const originText: Record<string, string> = { text: t("pf.o.text"), file: t("pf.o.file"), answer: t("pf.o.answer"), choice: t("pf.o.choice"), ai: t("pf.o.ai") };
  // Shows where a pre-filled value came from until the founder edits it.
  const tag = (k: keyof Draft) => origins?.[k] && data[k] === start[k] ? <span className="origin-tag">{originText[origins[k]!] ?? origins[k]}</span> : null;
  const invalid = fieldOrder.filter(k => fields[k]);
  return <form onSubmit={save} ref={form} noValidate className="profile-form">
    {error && <div ref={summary} tabIndex={-1} className="error-summary">
      {error instanceof ClientError&&error.code==="CREATION_CHANGED"&&error.fields?.createdStartupId&&<button type="button" className="button small" onClick={async()=>{try{const ws=await api<Workspace>(`/api/startups/${error.fields!.createdStartupId}`);if(onSaved)await onSaved(ws.startup);else router.push(`/startups/${ws.startup.id}`);}catch(err){setError(err as Error);}}}>{t("pf.openCreated")}</button>}
      <ErrorNotice error={conflict ? t("pf.conflict") : error}
        onReload={conflict ? () => void loadLatest() : undefined}
        onCopy={conflict ? () => void navigator.clipboard.writeText(JSON.stringify({ ...data, customFields: Object.fromEntries(custom) }, null, 2)) : undefined}/>
      {invalid.length > 0 && <ul>{invalid.map(k => <li key={k}><a href={`#field-${k}`} onClick={e => { e.preventDefault(); document.getElementById(`field-${k}`)?.focus(); }}>{tk(`profile.${k}`)}: {fields[k]}</a></li>)}</ul>}
    </div>}
    <fieldset disabled={saving || !hydrated}>
      {!initial && !seed && <button type="button" className="sample-fill" onClick={() => { setData(sample); setFields({}); setError(null); }}><Sparkles size={15} aria-hidden/>{t("pf.sample")}</button>}
      <Field name="name" label={t("profile.name")} value={data.name} onChange={v => update("name", v)} error={fields.name} required maxLength={120} autoComplete="organization">{tag("name")}</Field>
      <Field name="description" label={t("profile.description")} value={data.description} onChange={v => update("description", v)} error={fields.description} textarea required maxLength={2000} help={t("pf.descHelp")}>{tag("description")}</Field>
      <div className="form-columns">
        <Choice name="businessModel" label={t("profile.businessModel")} value={data.businessModel} options={["B2B", "B2C", "B2G"] as const} onChange={v => update("businessModel", v)}/>
        <Choice name="stage" label={t("profile.stage")} value={data.stage} options={["Idea", "MVP", "Early Traction"] as const} labels={{ Idea: t("stage.Idea"), MVP: t("stage.MVP"), "Early Traction": t("stage.Early Traction") }} onChange={v => update("stage", v)}/>
      </div>
      <Field name="targetMarket" label={t("profile.targetMarket")} value={data.targetMarket} onChange={v => update("targetMarket", v)} error={fields.targetMarket} required maxLength={200} help={t("pf.marketHelp")}>{tag("targetMarket")}</Field>
      <Field name="customerSegment" label={t("profile.customerSegment")} value={data.customerSegment} onChange={v => update("customerSegment", v)} error={fields.customerSegment} required maxLength={500} help={t("pf.segmentHelp")}>{tag("customerSegment")}</Field>
      <Field name="websiteUrl" label={t("pf.website")} value={data.websiteUrl} onChange={v => update("websiteUrl", v)} error={fields.websiteUrl} type="url" inputMode="url" maxLength={2000} placeholder="https://"
        onBlur={() => { const v = data.websiteUrl.trim(); if (v && !/^[a-z]+:/i.test(v)) update("websiteUrl", `https://${v}`); }}/>
      <details className="context-disclosure" open={initial && (data.context || custom.length) ? true : undefined}>
        <summary>{t("pf.more")}</summary>
        <Field name="context" label={t("pf.context")} value={data.context} onChange={v => update("context", v)} textarea maxLength={5000} help={t("pf.contextHelp")}/>
        <div className="custom-fields">
          <p className="field-label">{t("pf.own")}</p>
          <p className="field-help">{t("pf.ownHelp")}</p>
          {custom.map(([key, value], index) => <div className="custom-row" key={index}>
            <input className="input" aria-label={t("pf.fieldName", { n: index + 1 })} value={key} maxLength={80} placeholder={t("pf.label")} onChange={e => setCustom(rows => rows.map((r, i) => i === index ? [e.target.value, r[1]] : r))}/>
            <input className="input" aria-label={t("pf.fieldValue", { n: index + 1 })} value={value} maxLength={1000} placeholder={t("pf.value")} onChange={e => setCustom(rows => rows.map((r, i) => i === index ? [r[0], e.target.value] : r))}/>
            <button type="button" className="icon-button" aria-label={`${t("files.remove")}: ${key || index + 1}`} onClick={() => setCustom(rows => rows.filter((_, i) => i !== index))}><X size={17}/></button>
          </div>)}
          <button type="button" className="button small" disabled={custom.length >= 12} onClick={() => setCustom(rows => [...rows, ["", ""]])}><Plus size={15} aria-hidden/>{t("pf.addField")}</button>
        </div>
      </details>
      <div className="form-footer">
        <button className="button primary" aria-busy={saving}>{saving ? <><Spinner/>{t("chrome.saving")}</> : initial ? t("pf.save") : <>{submitLabel ?? t("land.cta.create")}<ArrowRight size={17} aria-hidden/></>}</button>
        {onCancel && <button type="button" className="button ghost" onClick={() => { if (!dirty || window.confirm(t("pf.discard"))) { clearDraft(draftKey); onCancel(); } }}>{t("common.cancel")}</button>}
      </div>
    </fieldset>
  </form>;
}
