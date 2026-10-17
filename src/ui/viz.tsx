"use client";
import { useMemo, useState, type CSSProperties } from "react";
import { motion } from "motion/react";
import type { AxisKey, AxisScore, ChannelEntry, Insights, MappedAssumption } from "@/lib/domain/insights";
import { ladderRungs } from "@/lib/domain/insights";
import { useDisplay } from "./display";
import { Reasons, ease } from "./kit";

const round = (v: number) => Math.round(v * 100) / 100;
const polar = (cx: number, cy: number, r: number, deg: number) => { const a = (deg - 90) * Math.PI / 180; return [round(cx + r * Math.cos(a)), round(cy + r * Math.sin(a))] as const; };

/* ───────── Readiness radar ───────── */
export function ReadinessRadar({ axes, size = 300, compact = false }: { axes: AxisScore[]; size?: number; compact?: boolean }) {
  const { t } = useDisplay();
  const [selected, setSelected] = useState<AxisKey | null>(null);
  const c = size / 2, R = size * 0.34, step = 360 / axes.length;
  const point = (i: number, v: number) => polar(c, c, R * v / 100, i * step);
  const shape = axes.map((a, i) => point(i, Math.max(6, a.score)).join(",")).join(" ");
  const ring = (v: number) => axes.map((_, i) => point(i, v).join(",")).join(" ");
  const active = axes.find(a => a.key === selected);
  return <div className={`v4-radar ${compact ? "is-compact" : ""}`}>
    <div className="v4-radar-plot" style={{ "--size": `${size}px` } as CSSProperties}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={axes.map(a => `${t(`axis.${a.key}`)} ${a.score}`).join(", ")}>
        {[25, 50, 75, 100].map(v => <polygon key={v} points={ring(v)} className={`v4-radar-ring ${v === 100 ? "is-outer" : ""}`}/>)}
        {axes.map((_, i) => { const [x, y] = point(i, 100); return <line key={i} x1={c} y1={c} x2={x} y2={y} className="v4-radar-spoke"/>; })}
        <motion.g style={{ transformOrigin: `${c}px ${c}px` }} initial={{ scale: 0.35, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.9, ease }}>
          <polygon points={shape} className="v4-radar-shape"/>
          {axes.map((a, i) => { const [x, y] = point(i, Math.max(6, a.score)); return <circle key={a.key} cx={x} cy={y} r={selected === a.key ? 5 : 3.5} className="v4-radar-dot"/>; })}
        </motion.g>
      </svg>
      {axes.map((a, i) => {
        const [x, y] = polar(c, c, R + (compact ? 26 : 34), i * step);
        const side = x < c - 4 ? "left" : x > c + 4 ? "right" : "mid";
        return <button key={a.key} type="button" className={`v4-radar-label is-${side} ${selected === a.key ? "is-active" : ""}`} aria-pressed={selected === a.key}
          style={{ left: `${x / size * 100}%`, top: `${y / size * 100}%` }} onClick={() => setSelected(s => s === a.key ? null : a.key)}>
          <span className="num">{a.score}</span><span>{t(`axis.${a.key}`)}</span>
        </button>;
      })}
    </div>
    {!compact && <div className="v4-radar-why" aria-live="polite">
      {active ? <><h4>{t(`axis.${active.key}`)} <span className="num mono">{active.score}/100</span></h4><Reasons reasons={active.reasons}/></>
        : <p className="v4-muted">{t("common.why")}: {t("readiness.explain")}</p>}
    </div>}
  </div>;
}

/* ───────── Assumption map ───────── */
const lensShape = (lens: MappedAssumption["lens"], x: number, y: number, r: number) =>
  lens === "desirability" ? <circle cx={x} cy={y} r={r}/> : lens === "viability" ? <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx={1.5}/>
    : <polygon points={`${x},${y - r * 1.25} ${x + r * 1.25},${y} ${x},${y + r * 1.25} ${x - r * 1.25},${y}`}/>;
export function AssumptionMap({ items, list = true }: { items: MappedAssumption[]; list?: boolean }) {
  const { t, tk } = useDisplay();
  const [hover, setHover] = useState<string | null>(null);
  const W = 420, H = 300, L = 34, B = 30, T = 12, Rm = 12;
  const px = (e: number) => round(L + e * (W - L - Rm)), py = (i: number) => round(T + (1 - i) * (H - T - B));
  if (!items.length) return <p className="v4-empty">{t("amap.empty")}</p>;
  const label = (a: MappedAssumption) => a.source === "implied" ? (a.id === "implied-pain" ? t("amap.impliedPain") : a.id === "implied-price" ? t("amap.impliedPrice") : t("amap.impliedChannel")) : a.statement;
  return <div className="v4-amap">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("amap.title")}>
      <rect x={px(0)} y={py(1)} width={px(0.5) - px(0)} height={py(0.5) - py(1)} className="v4-amap-hot"/>
      <line x1={px(0.5)} x2={px(0.5)} y1={py(1)} y2={py(0)} className="v4-amap-mid"/>
      <line x1={px(0)} x2={px(1)} y1={py(0.5)} y2={py(0.5)} className="v4-amap-mid"/>
      <line x1={px(0)} x2={px(1)} y1={py(0)} y2={py(0)} className="v4-amap-axis"/>
      <line x1={px(0)} x2={px(0)} y1={py(1)} y2={py(0)} className="v4-amap-axis"/>
      <text x={px(0) + 8} y={py(1) + 16} className="v4-amap-q is-hot">{t("amap.test_first")}</text>
      <text x={px(1) - 8} y={py(1) + 16} className="v4-amap-q" textAnchor="end">{t("amap.proceed")}</text>
      <text x={px(0) + 8} y={py(0) - 8} className="v4-amap-q">{t("amap.park")}</text>
      <text x={px(1) - 8} y={py(0) - 8} className="v4-amap-q" textAnchor="end">{t("amap.monitor")}</text>
      <text x={px(1)} y={H - 6} className="v4-amap-axis-label" textAnchor="end">{t("amap.evidence")} →</text>
      <text x={12} y={py(1)} className="v4-amap-axis-label" transform={`rotate(-90 12 ${py(1)})`} textAnchor="end">{t("amap.importance")} →</text>
      {items.map((a, i) => <motion.g key={a.id} className={`v4-amap-dot is-${a.quadrant} ${hover === a.id ? "is-hover" : ""}`}
        initial={{ opacity: 0, scale: 0.6 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.06, duration: 0.4, ease }}
        style={{ transformOrigin: `${px(a.evidence)}px ${py(a.importance)}px` }} onMouseEnter={() => setHover(a.id)} onMouseLeave={() => setHover(null)}>
        {lensShape(a.lens, px(a.evidence), py(a.importance), 7)}
        <text x={px(a.evidence) + 12} y={py(a.importance) + 4} className="v4-amap-n">{i + 1}</text>
      </motion.g>)}
    </svg>
    <div className="v4-amap-legend">{(["desirability", "viability", "feasibility"] as const).map(l => <span key={l}><svg viewBox="0 0 16 16" aria-hidden>{lensShape(l, 8, 8, 5)}</svg>{t(`lens.${l}`)} <em>{t(`lens.${l}.q`)}</em></span>)}</div>
    {list && <ol className="v4-amap-list">{items.map((a, i) => <li key={a.id} className={hover === a.id ? "is-hover" : ""} onMouseEnter={() => setHover(a.id)} onMouseLeave={() => setHover(null)}>
      <span className="v4-amap-num mono">{i + 1}</span>
      <div><p>{label(a)}{a.source === "implied" && <span className="v4-amap-quote"> — “{a.statement}”</span>}</p>
        <span className="v4-amap-meta">{t(`lens.${a.lens}`)} · {a.source === "implied" ? t("amap.implied") : t(`risk.${a.risk}`)} · {tk(`amap.ev.${a.evidenceCode}`)}</span></div>
      <span className={`v4-quadrant is-${a.quadrant}`}>{t(`amap.${a.quadrant}`)}</span>
    </li>)}</ol>}
  </div>;
}

/* ───────── Channel bullseye ───────── */
export function ChannelBullseye({ channels, model, stage, table = true }: { channels: ChannelEntry[]; model: string; stage: string; table?: boolean }) {
  const { t, tk } = useDisplay();
  const [focus, setFocus] = useState<string | null>(null);
  const S = 340, c = S / 2;
  const inner = channels.filter(ch => ch.ring === "inner"), middle = channels.filter(ch => ch.ring === "middle"), outer = channels.filter(ch => ch.ring === "outer");
  const name = (ch: ChannelEntry) => ch.custom ? ch.label : ch.chosen ? ch.label : tk(`channel.${ch.key}`);
  const place = (list: ChannelEntry[], r: number, offset: number) => list.map((ch, i) => ({ ch, xy: polar(c, c, r, offset + i * 360 / Math.max(1, list.length)) }));
  const marks = [...place(inner, inner.length > 1 ? 30 : 0, -30), ...place(middle, 88, 20), ...place(outer, 146, 8)];
  const numbered = [...inner, ...middle];
  return <div className="v4-bull">
    <div className="v4-bull-plot">
      <svg viewBox={`0 0 ${S} ${S}`} role="img" aria-label={t("bull.title")}>
        {[166, 116, 60].map((r, i) => <motion.circle key={r} cx={c} cy={c} r={r} className={`v4-bull-ring is-${["outer", "middle", "inner"][i]}`}
          initial={{ pathLength: 0, opacity: 0 }} whileInView={{ pathLength: 1, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: i * 0.12, ease }}/>)}
        <text x={c} y={c - 166 + 14} textAnchor="middle" className="v4-bull-ring-label">{t("bull.outer")}</text>
        <text x={c} y={c - 116 + 14} textAnchor="middle" className="v4-bull-ring-label">{t("bull.middle")}</text>
        {marks.map(({ ch, xy: [x, y] }) => {
          const n = numbered.indexOf(ch);
          return <g key={ch.key + ch.label} className={`v4-bull-mark is-${ch.ring} ${focus === ch.key ? "is-focus" : ""}`} onMouseEnter={() => setFocus(ch.key)} onMouseLeave={() => setFocus(null)}>
            <title>{`${name(ch)} · ICE ${ch.ice}`}</title>
            <circle cx={x} cy={y} r={ch.ring === "inner" ? 13 : ch.ring === "middle" ? 10 : 3.5}/>
            {n >= 0 && <text x={x} y={y + 4} textAnchor="middle">{n + 1}</text>}
          </g>;
        })}
        {!inner.length && <text x={c} y={c + 4} textAnchor="middle" className="v4-bull-ring-label">—</text>}
      </svg>
    </div>
    {table && <div className="v4-bull-side">
      {!inner.length && <p className="v4-muted">{t("bull.empty")}</p>}
      <table className="v4-table v4-ice">
        <thead><tr><th scope="col">#</th><th scope="col">{t("bull.title")}</th><th scope="col" title={t("bull.impact")}>I</th><th scope="col" title={t("bull.confidence")}>C</th><th scope="col" title={t("bull.ease")}>E</th><th scope="col">{t("bull.ice")}</th></tr></thead>
        <tbody>{numbered.map((ch, i) => <tr key={ch.key + ch.label} className={`is-${ch.ring} ${focus === ch.key ? "is-focus" : ""}`} onMouseEnter={() => setFocus(ch.key)} onMouseLeave={() => setFocus(null)}>
          <td className="mono">{i + 1}</td>
          <td><strong>{name(ch)}</strong><small>{ch.ring === "inner" ? t("bull.inner") : t("bull.middle")}{ch.custom ? ` · ${t("bull.custom")}` : ""} · {t("bull.signal", { n: ch.signalDays })}</small>
            {ch.localNote && <small className="v4-local">{tk(`local.${ch.localNote}`)}</small>}</td>
          <td className="num">{ch.impact}</td><td className="num">{ch.confidence}</td><td className="num">{ch.ease}</td>
          <td><span className="v4-ice-bar" style={{ "--v": ch.ice / 10 } as CSSProperties}><span className="num">{ch.ice}</span></span></td>
        </tr>)}</tbody>
      </table>
      <p className="v4-footnote">{t("bull.formula", { model, stage: tk(`stage.${stage}`) })}</p>
    </div>}
  </div>;
}

/* ───────── Evidence ladder ───────── */
export function EvidenceLadder({ ladder }: { ladder: Insights["ladder"] }) {
  const { t } = useDisplay();
  return <div className="v4-ladder">
    <ol className="v4-ladder-steps">{ladder.rungs.map((r, i) => <li key={r.rung} className={r.reached ? "is-reached" : ""} style={{ "--h": `${22 + i * 11}%` } as CSSProperties}>
      <motion.span className="v4-ladder-bar" initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.5, ease }}/>
      <span className="v4-ladder-label">{t(`rung.${r.rung}`)}</span>
    </li>)}</ol>
    <p className="v4-ladder-caption">{ladder.reached ? t("ladder.reached", { rung: t(`rung.${ladder.reached}`) }) : t("ladder.none")}</p>
  </div>;
}
export const rungCount = ladderRungs.length;

/* ───────── Positioning statement ───────── */
export function PositioningStatement({ slots, name }: { slots: Insights["positioning"]["slots"]; name: string }) {
  const { t } = useDisplay();
  const s = Object.fromEntries(slots.map(x => [x.key, x])) as Record<string, Insights["positioning"]["slots"][number]>;
  const slot = (key: string) => s[key].filled ? <mark className="v4-slot is-filled">{s[key].text}</mark> : <mark className="v4-slot is-empty">{t(`pos.slot.${key}` as "pos.slot.pain")}</mark>;
  return <p className="v4-positioning">
    {t("pos.for")} {slot("bestFit")} {t("pos.who")} {slot("pain")}, <strong>{name}</strong> {t("pos.is")} {slot("category")} {t("pos.that")} {slot("value")}. {t("pos.unlike")} {slot("alternatives")}, {t("pos.we")} {slot("unique")}.
  </p>;
}

/* ───────── Bottom-up sizing ───────── */
export function SizingCalculator({ price, market, initial, onSave }: { price: Insights["price"]; market: string; initial: number | null; onSave?: (accounts: number) => Promise<void> }) {
  const { t, number } = useDisplay();
  const [accounts, setAccounts] = useState(initial ? String(initial) : "");
  const [saving, setSaving] = useState(false);
  const n = Number(accounts.replace(/\s/g, ""));
  const valid = Number.isFinite(n) && n > 0;
  // Currency symbol placement differs between Node/browser CLDR releases for
  // kk-KZ. An explicit ISO code keeps SSR and hydration identical.
  const money = (v: number) => `${number(v, { maximumFractionDigits: 0 })}${price.currency ? ` ${price.currency}` : ""}`;
  const revenue = valid && price.annual !== null ? n * price.annual : null;
  return <div className="v4-sizing">
    <label className="v4-sizing-field"><span>{t("size.accounts")}</span>
      <input inputMode="numeric" value={accounts} onChange={e => setAccounts(e.target.value.replace(/[^\d\s]/g, ""))} placeholder="0" aria-describedby="size-help"/>
      <small id="size-help">{t("size.accountsHelp", { market })}</small></label>
    <span className="v4-sizing-op" aria-hidden>×</span>
    <div className="v4-sizing-field"><span>{t("size.price")}</span>
      <output className="num">{price.annual !== null ? money(price.annual) : "—"}</output>
      <small>{price.amount !== null ? t("size.priceParsed", { price: `${price.amount} ${price.currency ?? ""} ${t(`size.period.${price.period}`)}` }) : t("size.priceMissing")}</small></div>
    <span className="v4-sizing-op" aria-hidden>=</span>
    <div className="v4-sizing-field is-result"><span>{t("size.revenue")}</span>
      <output className="num">{revenue !== null ? money(revenue) : "—"}</output>
      <small>{revenue !== null ? `${t("size.som")}: ${money(revenue * 0.05)} – ${money(revenue * 0.1)}` : t("common.unknown")}</small></div>
    {onSave && valid && <button type="button" className="v4-button is-small" disabled={saving} onClick={async () => { setSaving(true); try { await onSave(n); } finally { setSaving(false); } }}>{t("size.save")}</button>}
  </div>;
}

/* ───────── 30-day load ───────── */
export function LoadStrip({ load }: { load: Insights["load"] }) {
  const { t } = useDisplay();
  const max = Math.max(1, ...load.weeks.map(w => w.total));
  const hasPlan = load.weeks.some(w => w.total);
  const day = load.planDay;
  return <div className="v4-load">
    {!hasPlan ? <p className="v4-empty">{t("load.noPlan")}</p> : <>
      <div className="v4-load-weeks">{load.weeks.map(w => <div key={w.week} className={`v4-load-week ${load.currentWeek === w.week ? "is-current" : ""}`}>
        <div className="v4-load-stack" role="img" style={{ "--fill": `${w.total / max * 100}%` } as CSSProperties} aria-label={`${t("common.weekN", { n: w.week })}: ${w.done}/${w.total}`}>
          {(["done", "inProgress", "todo", "skipped"] as const).map(k => w[k] ? <span key={k} className={`is-${k}`} style={{ flexGrow: w[k] }}/> : null)}
        </div>
        <span className="v4-load-label">{t("common.weekN", { n: w.week })}<span className="num mono">{w.done}/{w.total}</span></span>
      </div>)}</div>
      <div className="v4-load-ruler" aria-hidden>
        {Array.from({ length: 30 }, (_, i) => <span key={i} className={`${day && i + 1 < day ? "is-past" : ""} ${day === i + 1 ? "is-today" : ""}`}/>)}
      </div>
      <p className="v4-load-caption">{day ? t("load.today", { n: day }) : ""}{load.overdue ? ` · ${t("load.overdue", { n: load.overdue })}` : ""}</p>
    </>}
  </div>;
}

/* ───────── Small helpers ───────── */
export function useSectionStates(workspace: { completion: { sections: { key: string; complete: boolean }[] }; sections: { key: string; revision: number }[] }) {
  return useMemo(() => workspace.completion.sections.map(s => s.complete ? "complete" as const : (workspace.sections.find(x => x.key === s.key)?.revision ?? 0) > 0 ? "draft" as const : "empty" as const), [workspace]);
}
