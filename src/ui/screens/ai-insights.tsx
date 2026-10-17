"use client";
import type { CSSProperties } from "react";
import type { AiInsights } from "@/lib/domain/analysis";
import type { AiRun } from "@/lib/domain/ai";
import type { ChannelEntry } from "@/lib/domain/insights";
import { useWorkspace } from "@/components/workspace";
import { useDisplay } from "../display";
import { Provenance } from "../kit";
import { ChannelBullseye } from "../viz";

type Merged = { [K in keyof AiInsights]: AiInsights[K] };
/** The latest completed specialist output per insight slot, so a correction round replaces only what it revised. */
function mergeInsights(run: AiRun): Merged {
  const merged: Merged = { personas: null, positioning: null, channels: null, market: null, pricing: null };
  const steps = run.steps.filter(s => s.status === "completed" && s.result?.analysis?.insights).sort((a, b) => a.round - b.round);
  for (const step of steps) {
    const ins = step.result!.analysis!.insights!;
    (Object.keys(merged) as (keyof Merged)[]).forEach(k => { if (ins[k] && (!Array.isArray(ins[k]) || (ins[k] as unknown[]).length)) (merged as Record<string, unknown>)[k] = ins[k]; });
  }
  return merged;
}

export function AiInsightsPanel({ run }: { run: AiRun }) {
  const { t, number } = useDisplay();
  const { workspace } = useWorkspace();
  const m = mergeInsights(run);
  const empty = !m.personas?.length && !m.positioning && !m.channels?.length && !m.market && !m.pricing;
  if (empty) return run.status === "completed" || run.status === "needs_attention"
    ? <p className="v4-muted ai-ins-empty">{t("ai.ins.none")}</p> : null;
  const channels: ChannelEntry[] = (m.channels ?? []).map(c => ({ key: c.key, label: c.channel, custom: true, chosen: c.ring === "inner", ring: c.ring,
    impact: c.impact, confidence: c.confidence, ease: c.ease, ice: Math.round((c.impact + c.confidence + c.ease) / 3 * 10) / 10, signalDays: 14, localNote: null, reason: c.rationale }));
  const money = (v: number, currency: string | null) => `${number(v, { maximumFractionDigits: 0 })}${currency ? ` ${currency}` : ""}`;
  const market = m.market;
  const tam = market && market.accounts.high !== null && market.annualValue.amount !== null ? market.accounts.high * market.annualValue.amount : null;
  const sam = tam !== null && market?.serviceablePercent !== null && market?.serviceablePercent !== undefined ? tam * market.serviceablePercent / 100 : null;
  const som = market && market.yearOneAccounts !== null && market.annualValue.amount !== null ? market.yearOneAccounts * market.annualValue.amount : null;
  return <section className="ai-ins" aria-labelledby="ai-ins-title">
    <header className="ai-ins-head"><h2 id="ai-ins-title">{t("ai.ins.title")}</h2><Provenance kind="ai"/><p className="v4-muted">{t("ai.ins.lede")}</p></header>

    {!!m.personas?.length && <div className="ai-ins-block">
      <h3>{t("ai.ins.personas")}</h3>
      <div className="ai-personas">{m.personas.map(p => <article key={p.key} className="ai-persona">
        <header><strong>{p.name}</strong><span className="mono">{p.role}</span><span className={`ai-basis is-${p.basis}`}>{t(`ai.basis.${p.basis}`)}</span></header>
        <p className="v4-muted">{p.context}</p>
        <dl>
          {p.jobs.length > 0 && <div className="is-wide"><dt>{t("ai.ins.jobs")}</dt><dd><ul>{p.jobs.map(x => <li key={x}>{x}</li>)}</ul></dd></div>}
          {p.pains.length > 0 && <div><dt>{t("ai.ins.pains")}</dt><dd><ul>{p.pains.map(x => <li key={x}>{x}</li>)}</ul></dd></div>}
          {p.gains.length > 0 && <div><dt>{t("ai.ins.gains")}</dt><dd><ul>{p.gains.map(x => <li key={x}>{x}</li>)}</ul></dd></div>}
          {p.triggers.length > 0 && <div><dt>{t("ai.ins.triggers")}</dt><dd><ul>{p.triggers.map(x => <li key={x}>{x}</li>)}</ul></dd></div>}
          {p.objections.length > 0 && <div><dt>{t("ai.ins.objections")}</dt><dd><ul>{p.objections.map(x => <li key={x}>{x}</li>)}</ul></dd></div>}
          {p.whereToFind.length > 0 && <div><dt>{t("ai.ins.where")}</dt><dd>{p.whereToFind.join(" · ")}</dd></div>}
          <div><dt>{t("ai.ins.budget")}</dt><dd>{p.budgetOwner}</dd></div>
        </dl>
      </article>)}</div>
    </div>}

    {m.positioning && <div className="ai-ins-block">
      <h3>{t("pos.title")} <span className="mono ai-cat">{t(`ai.cat.${m.positioning.categoryStyle}`)}</span></h3>
      <p className="v4-positioning">{m.positioning.statement}</p>
      <div className="ai-pos-grid">
        <div><span className="mono">{t("pos.slot.alternatives")}</span><ul>{m.positioning.alternatives.map(x => <li key={x}>{x}</li>)}</ul></div>
        <div><span className="mono">{t("pos.slot.unique")}</span><ul>{m.positioning.uniqueAttributes.map(x => <li key={x}>{x}</li>)}</ul></div>
        <div><span className="mono">{t("pos.slot.value")}</span><ul>{m.positioning.value.map(x => <li key={x}>{x}</li>)}</ul></div>
        <div><span className="mono">{t("pos.slot.bestFit")}</span><p>{m.positioning.bestFit}</p><span className="mono">{t("pos.slot.category")}</span><p>{m.positioning.category}</p></div>
      </div>
    </div>}

    {channels.length > 0 && <div className="ai-ins-block">
      <h3>{t("bull.title")}</h3>
      <ChannelBullseye channels={channels} model={workspace.startup.businessModel} stage={workspace.startup.stage}/>
      <ol className="ai-channel-tests">{(m.channels ?? []).filter(c => c.ring !== "outer").map(c => <li key={c.key}><strong>{c.channel}</strong><span>{c.firstTest}</span><small className="v4-muted">{c.costNote}</small></li>)}</ol>
    </div>}

    {market && <div className="ai-ins-block">
      <h3>{t("size.title")}</h3>
      <div className="ai-funnel">
        {[["TAM", tam, t("ai.ins.tam")], ["SAM", sam, t("ai.ins.sam")], ["SOM", som, t("ai.ins.som")]].map(([k, v, label], i) =>
          <div key={k as string} className="ai-funnel-row" style={{ "--w": `${100 - i * 22}%` } as CSSProperties}><span className="mono">{k as string}</span><strong className="num">{v !== null ? money(v as number, market.annualValue.currency) : "—"}</strong><small>{label as string}</small></div>)}
      </div>
      <dl className="ai-sizing-basis">
        <div><dt>{t("ai.ins.unit")}</dt><dd>{market.accountUnit}</dd></div>
        <div><dt>{t("size.accounts")}</dt><dd><span className="num">{market.accounts.low ?? "—"} – {market.accounts.high ?? "—"}</span> · {market.accounts.basis}</dd></div>
        <div><dt>{t("size.price")}</dt><dd><span className="num">{market.annualValue.amount !== null ? money(market.annualValue.amount, market.annualValue.currency) : "—"}</span> · {market.annualValue.basis}</dd></div>
        <div><dt>SAM %</dt><dd><span className="num">{market.serviceablePercent ?? "—"}</span> · {market.serviceableBasis}</dd></div>
        <div><dt>{t("size.som")}</dt><dd><span className="num">{market.yearOneAccounts ?? "—"}</span> · {market.yearOneBasis}</dd></div>
      </dl>
      {market.gaps.length > 0 && <ul className="ai-gaps">{market.gaps.map(g => <li key={g}>{g}</li>)}</ul>}
    </div>}

    {m.pricing && <div className="ai-ins-block">
      <h3>{t("ai.ins.pricing")}</h3>
      {m.pricing.anchors.length > 0 && <table className="v4-table"><thead><tr><th>{t("ai.ins.anchor")}</th><th>{t("field.initialPrice")}</th><th>{t("field.paymentUnit")}</th></tr></thead>
        <tbody>{m.pricing.anchors.map(a => <tr key={a.name}><td>{a.name}</td><td className="num">{a.price}</td><td>{a.unit}</td></tr>)}</tbody></table>}
      {m.pricing.tiers.length > 0 && <div className="ai-tiers">{m.pricing.tiers.map(tier => <article key={tier.name}><strong>{tier.name}</strong><span className="num">{tier.price}</span><small>{tier.forWhom}</small><ul>{tier.includes.map(x => <li key={x}>{x}</li>)}</ul></article>)}</div>}
      {m.pricing.wtpQuestions.length > 0 && <><h4>{t("ai.ins.wtp")}</h4><ol className="ai-wtp">{m.pricing.wtpQuestions.map(q => <li key={q}>{q}</li>)}</ol></>}
      <p className="ai-test"><span className="mono">{t("ai.ins.test")}</span>{m.pricing.recommendedTest}</p>
    </div>}
  </section>;
}
