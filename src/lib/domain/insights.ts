/**
 * Transparent insight engine. Deterministic, explainable models computed from saved inputs only.
 * Every score carries its reasons; nothing here can mark an assumption "validated".
 * Text is returned as codes so the interface can localise it (EN/RU/KK).
 * Methods: Assumptions Mapping (Bland), Bullseye/Traction (Weinberg & Mares) with ICE scoring,
 * positioning components (Dunford), bottom-up market sizing, commitment ladder.
 */
import { sectionSchemas, type SectionKey, type SectionDataMap } from "./schemas";
import { emptySection } from "./completion";
import type { StrategySection, Task, Workspace } from "./types";

export type Reason = { code: string; ok: boolean; points: number };
export const axisKeys = ["customer", "value", "channels", "pricing", "risk", "execution"] as const;
export type AxisKey = (typeof axisKeys)[number];
export type AxisScore = { key: AxisKey; score: number; reasons: Reason[] };
export type Band = "draft" | "shaping" | "testable" | "sharp";
export type Lens = "desirability" | "viability" | "feasibility";
export type MappedAssumption = {
  id: string; statement: string; lens: Lens; importance: number; evidence: number;
  quadrant: "test_first" | "monitor" | "proceed" | "park"; source: "stated" | "implied"; risk: "low" | "medium" | "high";
  method: string; evidenceCode: string;
};
export type ChannelEntry = {
  key: string; label: string; custom: boolean; chosen: boolean; ring: "inner" | "middle" | "outer";
  impact: number; confidence: number; ease: number; ice: number; signalDays: number; localNote: string | null; reason: string;
};
export const ladderRungs = ["opinion", "interest", "meeting", "commitment", "deposit", "paid", "repeat"] as const;
export type Rung = (typeof ladderRungs)[number];
export type MissingField = { section: SectionKey; field: string; index?: number };
export type PositioningSlot = { key: "bestFit" | "pain" | "category" | "value" | "alternatives" | "unique"; text: string; filled: boolean };
export type PriceParse = { amount: number | null; currency: string | null; period: "month" | "year" | "once" | "unknown"; annual: number | null };
export type WeekLoad = { week: number; todo: number; inProgress: number; done: number; skipped: number; total: number };
export type NextAction = { kind: "section" | "task" | "review"; section?: SectionKey; taskId?: string; field?: string };
export type Insights = {
  readiness: { overall: number; band: Band; axes: AxisScore[] };
  assumptions: MappedAssumption[];
  channels: ChannelEntry[];
  ladder: { reached: Rung | null; rungs: { rung: Rung; reached: boolean; via: string[] }[] };
  positioning: { slots: PositioningSlot[]; filled: number };
  price: PriceParse;
  load: { weeks: WeekLoad[]; planDay: number | null; currentWeek: number | null; overdue: number };
  missing: MissingField[];
  next: NextAction;
  counts: { sectionsComplete: number; tasks: number; done: number; inProgress: number; custom: number; channels: number; assumptions: number };
};

const has = (v: string | undefined | null) => !!v && v.trim().length > 0;
const words = (v: string) => v.trim().split(/\s+/).filter(Boolean).length;
const number = /\d/;
const vague = /\b(everyone|anyone|all (people|users|businesses|companies)|any business|everybody|все|всех|каждый|любой|любые|барлығы|барлық|кез келген)\b/i;
const role = /\b(founder|co-?founder|owner|manager|head|director|lead|chief|ceo|cto|cfo|cmo|coo|vp|officer|teacher|doctor|nurse|student|parent|accountant|marketer|engineer|developer|admin|buyer|procurement|recruiter|hr|seller|merchant|farmer|principal|analyst|designer|operator|основател|владел|менеджер|руковод|директор|глав|учител|врач|студент|родител|бухгалтер|маркетолог|инженер|разработчик|закупщ|рекрутер|продав|фермер|аналитик|құрылтайшы|иесі|басшы|директор|мұғалім|дәрігер|студент|ата-ана|бухгалтер|сатушы|фермер|талдаушы)/i;
const timing = /\b(week|month|day|quarter|season|year|before|after|when|during|deadline|launch|renewal|audit|hiring|fundrais|недел|месяц|день|дня|квартал|сезон|перед|после|когда|во время|запуск|апта|ай|күн|тоқсан|маусым|бұрын|кейін|кезде)/i;
const contrast = /\b(unlike|instead of|than|vs\.?|versus|compared|rather than|without|в отличие|вместо|чем|по сравнению|без|орнына|қарағанда|салыстырғанда|айырмашылығы)/i;
const proofWords = /\b(interview|conversation|pilot|paid|deposit|loi|letter of intent|survey|data|usage|customer|signed|waitlist|assumption|интервью|разговор|пилот|оплат|предоплат|опрос|данн|клиент|подпис|гипотез|сұхбат|пилот|төлем|сауалнама|деректер|клиент|болжам)/i;
const commitmentWords = /\b(pilot|deposit|prepay|pre-?order|commit|contract|loi|trial|пилот|предоплат|предзаказ|договор|обязательств|триал|алдын ала|келісім|сынақ)/i;
const valueWords = /\b(value|saves?|save|cost|time|alternative|competitor|cheaper|roi|hours|ценност|эконом|стоимост|время|альтернатив|конкурент|дешевле|час|құндылы|үнем|құн|уақыт|балама|бәсекелес|арзан|сағат)/i;
const currencyRe = /(\$|usd|€|eur|₸|kzt|тг|тенге|теңге|₽|rub|руб|uzs|сум|kgs|сом|£|gbp)/i;
const measurable = /(\d+\s*(%|percent|of|из|из\s|\/|out of|people|founders|customers|companies|users|clients|человек|клиент|компани|основател|адам|клиент|компания))|(\d)/i;

function points(code: string, ok: boolean, value: number): Reason { return { code, ok, points: ok ? value : 0 }; }
function total(reasons: Reason[]) { return Math.max(0, Math.min(100, reasons.reduce((sum, r) => sum + r.points, 0))); }

function data<K extends SectionKey>(sections: StrategySection[], key: K): SectionDataMap[K] {
  const found = sections.find(s => s.key === key);
  return sectionSchemas[key].parse(found?.data ?? emptySection(key).data) as SectionDataMap[K];
}

export function missingFields(sections: StrategySection[]): MissingField[] {
  const missing: MissingField[] = [];
  const icp = data(sections, "icp"), value = data(sections, "value"), pricing = data(sections, "pricing");
  const channels = data(sections, "channels"), assumptions = data(sections, "assumptions").assumptions;
  for (const [field, v] of Object.entries(icp)) if (!has(v)) missing.push({ section: "icp", field });
  for (const [field, v] of Object.entries(value)) if (!has(v)) missing.push({ section: "value", field });
  if (!channels.channels.length) missing.push({ section: "channels", field: "channel" });
  channels.channels.forEach((c, index) => {
    if (!has(c.name)) missing.push({ section: "channels", field: "channelName", index });
    if (!has(c.reason)) missing.push({ section: "channels", field: "channelReason", index });
  });
  if (!has(channels.firstExperiment)) missing.push({ section: "channels", field: "firstExperiment" });
  for (const [field, v] of Object.entries(pricing)) if (!has(v)) missing.push({ section: "pricing", field });
  for (let index = 0; index < 3; index++) {
    const a = assumptions[index];
    if (!has(a?.statement)) missing.push({ section: "assumptions", field: "statement", index });
    if (!has(a?.validationMethod)) missing.push({ section: "assumptions", field: "validationMethod", index });
  }
  return missing;
}

export function parsePrice(price: string, unit: string, model: string): PriceParse {
  const text = `${price} ${unit} ${model}`.toLowerCase();
  const m = price.replace(/\s(?=\d{3}\b)/g, "").match(/(\d+(?:[.,]\d+)?)/);
  const amount = m ? Number(m[1].replace(",", ".")) : null;
  const c = price.match(currencyRe)?.[1]?.toLowerCase() ?? null;
  const currency = !c ? null : c === "$" || c === "usd" ? "USD" : c === "€" || c === "eur" ? "EUR" : /₸|kzt|тг|тенге|теңге/.test(c) ? "KZT" : /₽|rub|руб/.test(c) ? "RUB" : c === "£" || c === "gbp" ? "GBP" : c.toUpperCase();
  const period = /month|mo\b|\/m|месяц|мес|ай/.test(text) ? "month" : /year|annual|yr|год|жыл/.test(text) ? "year" : /one[- ]?time|once|разов|бір рет/.test(text) ? "once" : "unknown";
  const annual = amount === null ? null : period === "month" ? amount * 12 : period === "year" ? amount : period === "once" ? amount : null;
  return { amount, currency, period, annual };
}

type ChannelDef = { key: string; match: RegExp; fit: { B2B: number; B2C: number; B2G: number }; cost: number; signalDays: number; stage: { Idea: number; MVP: number; "Early Traction": number }; local?: string };
/** The 19 Traction channels plus channels that matter in Kazakhstan and Central Asia. Fit values are editorial priors, shown as such. */
export const channelLibrary: ChannelDef[] = [
  { key: "sales", match: /founder|direct|outreach|outbound|cold|sales|звон|прям|продаж|аутрич|холодн|тікелей|сату/i, fit: { B2B: 0.95, B2C: 0.3, B2G: 0.8 }, cost: 0.2, signalDays: 7, stage: { Idea: 1, MVP: 1, "Early Traction": 0.8 } },
  { key: "communities", match: /communit|telegram|discord|slack|chat|сообществ|чат|телеграм|қауымдаст/i, fit: { B2B: 0.7, B2C: 0.8, B2G: 0.2 }, cost: 0.15, signalDays: 7, stage: { Idea: 1, MVP: 0.9, "Early Traction": 0.7 }, local: "telegram" },
  { key: "bizdev", match: /partner|incubator|accelerator|resell|integrat|bizdev|партн|инкубатор|акселератор|серікт/i, fit: { B2B: 0.8, B2C: 0.5, B2G: 0.7 }, cost: 0.3, signalDays: 21, stage: { Idea: 0.6, MVP: 0.9, "Early Traction": 1 }, local: "astanahub" },
  { key: "content", match: /content|blog|seo|article|newsletter|контент|блог|статьи|рассылк|мазмұн/i, fit: { B2B: 0.7, B2C: 0.7, B2G: 0.3 }, cost: 0.35, signalDays: 60, stage: { Idea: 0.4, MVP: 0.7, "Early Traction": 1 } },
  { key: "social_ads", match: /instagram|tiktok|facebook|meta|vk|social ads|таргет|соцсет|инстаграм|әлеуметтік/i, fit: { B2B: 0.35, B2C: 0.9, B2G: 0.1 }, cost: 0.6, signalDays: 7, stage: { Idea: 0.5, MVP: 0.8, "Early Traction": 1 }, local: "instagram" },
  { key: "sem", match: /google ads|search ads|sem|adwords|яндекс|yandex|контекст/i, fit: { B2B: 0.55, B2C: 0.75, B2G: 0.1 }, cost: 0.65, signalDays: 7, stage: { Idea: 0.4, MVP: 0.8, "Early Traction": 1 } },
  { key: "marketplaces", match: /kaspi|marketplace|wildberries|ozon|app ?store|google play|product hunt|маркетплейс|каспи/i, fit: { B2B: 0.35, B2C: 0.9, B2G: 0.05 }, cost: 0.45, signalDays: 14, stage: { Idea: 0.3, MVP: 0.8, "Early Traction": 1 }, local: "kaspi" },
  { key: "events", match: /event|conference|meetup|expo|trade show|мероприят|конференц|митап|выставк|іс-шара/i, fit: { B2B: 0.8, B2C: 0.4, B2G: 0.75 }, cost: 0.5, signalDays: 30, stage: { Idea: 0.7, MVP: 0.9, "Early Traction": 0.9 } },
  { key: "referrals", match: /referr|word of mouth|recommend|рекоменд|сарафан|реферал|ұсыныс/i, fit: { B2B: 0.7, B2C: 0.8, B2G: 0.4 }, cost: 0.2, signalDays: 30, stage: { Idea: 0.2, MVP: 0.6, "Early Traction": 1 } },
  { key: "pr", match: /\bpr\b|press|media|journalist|пресс|сми|журналист|бақ/i, fit: { B2B: 0.5, B2C: 0.6, B2G: 0.5 }, cost: 0.4, signalDays: 30, stage: { Idea: 0.3, MVP: 0.6, "Early Traction": 0.9 } },
  { key: "linkedin", match: /linkedin|линкедин/i, fit: { B2B: 0.85, B2C: 0.15, B2G: 0.4 }, cost: 0.25, signalDays: 10, stage: { Idea: 0.9, MVP: 1, "Early Traction": 0.9 } },
  { key: "email", match: /e-?mail|рассыл|почт|хат/i, fit: { B2B: 0.75, B2C: 0.55, B2G: 0.4 }, cost: 0.2, signalDays: 10, stage: { Idea: 0.6, MVP: 0.9, "Early Traction": 1 } },
  { key: "tenders", match: /tender|procure|goszakup|госзакуп|тендер|закупк|мемлекеттік сатып/i, fit: { B2B: 0.3, B2C: 0, B2G: 0.95 }, cost: 0.5, signalDays: 45, stage: { Idea: 0.2, MVP: 0.7, "Early Traction": 1 }, local: "goszakup" },
  { key: "maps", match: /2gis|2гис|google maps|карт|локальн|local listing/i, fit: { B2B: 0.3, B2C: 0.8, B2G: 0.1 }, cost: 0.15, signalDays: 14, stage: { Idea: 0.5, MVP: 0.8, "Early Traction": 0.9 }, local: "2gis" },
  { key: "messengers", match: /whatsapp|ватсап|мессенджер|messenger/i, fit: { B2B: 0.6, B2C: 0.8, B2G: 0.2 }, cost: 0.15, signalDays: 5, stage: { Idea: 0.9, MVP: 0.9, "Early Traction": 0.8 }, local: "whatsapp" },
  { key: "engineering_marketing", match: /free tool|calculator|widget|template|engineering as marketing|калькулятор|шаблон|бесплатн/i, fit: { B2B: 0.6, B2C: 0.5, B2G: 0.2 }, cost: 0.5, signalDays: 45, stage: { Idea: 0.3, MVP: 0.6, "Early Traction": 0.9 } },
  { key: "influencers", match: /influenc|blogger|creator|инфлюенс|блогер|автор/i, fit: { B2B: 0.3, B2C: 0.85, B2G: 0.05 }, cost: 0.55, signalDays: 14, stage: { Idea: 0.4, MVP: 0.8, "Early Traction": 0.9 } },
  { key: "speaking", match: /speak|talk|webinar|workshop|выступ|вебинар|воркшоп|баяндама/i, fit: { B2B: 0.75, B2C: 0.4, B2G: 0.6 }, cost: 0.3, signalDays: 30, stage: { Idea: 0.6, MVP: 0.8, "Early Traction": 0.9 } },
  { key: "offline", match: /offline|flyer|billboard|outdoor|street|офлайн|листовк|наружн|сыртқы/i, fit: { B2B: 0.25, B2C: 0.6, B2G: 0.2 }, cost: 0.7, signalDays: 21, stage: { Idea: 0.3, MVP: 0.6, "Early Traction": 0.8 } },
];

function classifyLens(text: string): Lens {
  if (/(pay|price|paid|pilot|commit|subscri|budget|revenue|purchas|buy|\$|₸|kzt|usd|deposit|плат|цен|оплат|купят|покуп|бюджет|выручк|подписк|төле|баға|сатып ал|бюджет)/i.test(text)) return "viability";
  if (/(build|minute|hour|integrat|deliver|onboard|operat|manual|technical|capacity|support|scale|time to|сдела|минут|час|интегр|достав|внедр|поддерж|масштаб|мүмкін|минут|сағат|жеткіз|енгіз)/i.test(text)) return "feasibility";
  return "desirability";
}

export function computeInsights(workspace: Workspace, now: Date = new Date()): Insights {
  const { startup, sections, tasks } = workspace;
  const icp = data(sections, "icp"), value = data(sections, "value"), pricing = data(sections, "pricing");
  const channels = data(sections, "channels"), assumptions = data(sections, "assumptions").assumptions;
  const active = tasks.filter(t => !t.archived);
  const doneKeys = new Set(active.filter(t => t.status === "done").map(t => t.ruleKey ?? ""));
  const isDone = (key: string) => doneKeys.has(key);

  // Readiness: specificity heuristics. Each reason is a check a founder can satisfy by writing more precisely.
  const customer: Reason[] = [
    points("buyerNamed", has(icp.buyerType), 15), points("buyerRole", role.test(icp.buyerType), 15),
    points("segmentSized", has(icp.industry) && (number.test(icp.industry) || words(icp.industry) >= 4), 15),
    points("painSpecific", has(icp.painPoint) && (words(icp.painPoint) >= 7 || number.test(icp.painPoint)), 20),
    points("triggerTimed", has(icp.buyingTrigger) && timing.test(icp.buyingTrigger), 20),
    points("notVague", !(vague.test(icp.buyerType) || vague.test(icp.industry) || vague.test(startup.customerSegment)), 15),
  ];
  const valueR: Reason[] = [
    points("problemStated", has(value.problem), 15), points("outcomeStated", has(value.outcome), 15),
    points("outcomeMeasurable", has(value.outcome) && (number.test(value.outcome) || timing.test(value.outcome)), 15),
    points("differentiated", has(value.differentiation), 15),
    points("againstAlternative", contrast.test(value.differentiation) || contrast.test(value.problem), 20),
    points("proofTyped", has(value.proof) && proofWords.test(value.proof), 20),
  ];
  const named = channels.channels.filter(c => has(c.name));
  const channelR: Reason[] = [
    points("channelChosen", named.length > 0, 20),
    points("channelReasoned", named.length > 0 && named.every(c => has(c.reason)), 20),
    points("channelFocused", named.length > 0 && named.length <= 2, 15),
    points("experimentDefined", has(channels.firstExperiment), 20),
    points("experimentThreshold", measurable.test(channels.firstExperiment), 25),
  ];
  const price = parsePrice(pricing.initialPrice, pricing.paymentUnit, pricing.model);
  const pricingR: Reason[] = [
    points("modelChosen", has(pricing.model), 15), points("priceNumber", price.amount !== null, 20),
    points("priceCurrency", price.currency !== null, 10), points("unitDefined", has(pricing.paymentUnit), 15),
    points("rationaleValue", has(pricing.rationale) && valueWords.test(pricing.rationale), 20),
    points("commitmentTest", commitmentWords.test(`${pricing.model} ${pricing.initialPrice} ${pricing.rationale}`), 20),
  ];
  const stated = assumptions.filter(a => has(a.statement));
  const riskR: Reason[] = [
    points("threeAssumptions", stated.length === 3, 25),
    points("methodsDefined", stated.length > 0 && stated.every(a => has(a.validationMethod)), 25),
    points("riskiestNamed", stated.some(a => a.risk === "high"), 15),
    points("assumptionsMeasurable", stated.length > 0 && stated.filter(a => number.test(a.statement)).length >= Math.min(2, stated.length), 20),
    points("lensesCovered", new Set(stated.map(a => classifyLens(a.statement))).size >= 2, 15),
  ];
  // Plan day: from the active plan if present, otherwise from the earliest generated task.
  const startedAt = workspace.activePlan?.createdAt ?? active.filter(t => t.source !== "custom").map(t => t.createdAt).sort()[0];
  const planDay = startedAt ? Math.min(30, Math.max(1, Math.floor((now.getTime() - new Date(startedAt).getTime()) / 86400000) + 1)) : null;
  const currentWeek = planDay ? Math.min(4, Math.ceil(planDay / 7.5)) : null;
  const overdue = currentWeek ? active.filter(t => t.week < currentWeek && (t.status === "todo" || t.status === "in_progress")).length : 0;
  const progress = workspace.roadmapProgress.percentage;
  const executionR: Reason[] = [
    points("planExists", active.length > 0, 20), { code: "planProgress", ok: progress > 0, points: Math.round(progress * 0.5) },
    points("weekMoving", !!currentWeek && active.some(t => t.week === currentWeek && t.status !== "todo"), 15),
    points("noOverdue", active.length > 0 && overdue === 0, 15),
  ];
  const axes: AxisScore[] = [
    { key: "customer", reasons: customer }, { key: "value", reasons: valueR }, { key: "channels", reasons: channelR },
    { key: "pricing", reasons: pricingR }, { key: "risk", reasons: riskR }, { key: "execution", reasons: executionR },
  ].map(a => ({ ...a, key: a.key as AxisKey, score: total(a.reasons) }));
  const overall = Math.round(axes.reduce((s, a) => s + a.score, 0) / axes.length);
  const band: Band = overall >= 90 ? "sharp" : overall >= 70 ? "testable" : overall >= 40 ? "shaping" : "draft";

  // Assumptions map: stated assumptions plus the ones the strategy implies but does not name.
  const importanceOf = { high: 0.88, medium: 0.62, low: 0.34 } as const;
  const mapped: MappedAssumption[] = stated.map((a, i) => {
    const lens = classifyLens(a.statement);
    const tested = (a.risk === "high" && isDone("assumption-experiment")) || (lens === "viability" && isDone("pricing-offer-test"));
    return { id: `stated-${i}`, statement: a.statement, lens, risk: a.risk, method: a.validationMethod, source: "stated" as const,
      importance: importanceOf[a.risk] - i * 0.03, evidence: tested ? 0.55 : 0.12 + i * 0.04, quadrant: "test_first" as const, evidenceCode: tested ? "taskDone" : "none" };
  });
  if (has(icp.painPoint)) mapped.push({ id: "implied-pain", statement: icp.painPoint, lens: "desirability", risk: "high", method: "", source: "implied",
    importance: 0.94, evidence: isDone("icp-interviews") ? 0.58 : 0.08, quadrant: "test_first", evidenceCode: isDone("icp-interviews") ? "interviewsDone" : "none" });
  if (price.amount !== null) mapped.push({ id: "implied-price", statement: `${pricing.initialPrice}${has(pricing.paymentUnit) ? ` · ${pricing.paymentUnit}` : ""}`, lens: "viability", risk: "high", method: "", source: "implied",
    importance: 0.8, evidence: isDone("pricing-offer-test") ? 0.5 : 0.1, quadrant: "test_first", evidenceCode: isDone("pricing-offer-test") ? "offerTested" : "none" });
  if (named[0]) mapped.push({ id: "implied-channel", statement: named[0].name, lens: "feasibility", risk: "medium", method: "", source: "implied",
    importance: 0.56, evidence: active.some(t => t.ruleKey?.startsWith("channel:") && t.status === "done") ? 0.52 : 0.2, quadrant: "test_first", evidenceCode: "none" });
  for (const a of mapped) a.quadrant = a.importance >= 0.5 ? (a.evidence < 0.5 ? "test_first" : "proceed") : (a.evidence < 0.5 ? "park" : "monitor");

  // Channel bullseye: chosen channels sit in the inner ring; best-fit untested channels in the middle.
  const model = startup.businessModel, stage = startup.stage;
  const kz = /kazakh|казах|қазақ|central asia|средн.*ази|орталық азия|almaty|astana|алматы|астана|shymkent|шымкент/i.test(startup.targetMarket);
  const used = new Set<string>();
  const chosen: ChannelEntry[] = named.map((c, i) => {
    const def = channelLibrary.find(d => d.match.test(c.name));
    if (def) used.add(def.key);
    const fit = def ? def.fit[model] : 0.5, ease = def ? (1 - def.cost) * def.stage[stage] : 0.5;
    const tested = active.some(t => t.ruleKey?.startsWith("channel:") && t.title.toLowerCase().includes(c.name.toLowerCase().slice(0, 12)) && t.status === "done");
    const confidence = Math.min(10, 3 + (has(c.reason) ? 3 : 0) + (channels.firstExperiment.toLowerCase().includes(c.name.toLowerCase().split(" ")[0]) ? 2 : 0) + (tested ? 2 : 0));
    const impact = Math.max(1, Math.round(fit * 10)), easeScore = Math.max(1, Math.round(ease * 10));
    return { key: def?.key ?? `custom-${i}`, label: c.name, custom: !def, chosen: true, ring: "inner" as const, impact, confidence, ease: easeScore,
      ice: Math.round((impact + confidence + easeScore) / 3 * 10) / 10, signalDays: def?.signalDays ?? 14, localNote: kz && def?.local ? def.local : null, reason: c.reason };
  });
  const candidates = channelLibrary.filter(d => !used.has(d.key)).map(d => {
    const impact = Math.max(1, Math.round(d.fit[model] * 10)), ease = Math.max(1, Math.round((1 - d.cost) * d.stage[stage] * 10)), confidence = 2;
    return { key: d.key, label: d.key, custom: false, chosen: false, ring: "outer" as const, impact, confidence, ease,
      ice: Math.round((impact + confidence + ease) / 3 * 10) / 10, signalDays: d.signalDays, localNote: kz && d.local ? d.local : null, reason: "" };
  }).sort((a, b) => (b.impact * 2 + b.ease + (b.localNote ? 1 : 0)) - (a.impact * 2 + a.ease + (a.localNote ? 1 : 0)));
  candidates.slice(0, 4).forEach(c => { (c as ChannelEntry).ring = "middle"; });
  const channelEntries: ChannelEntry[] = [...chosen, ...candidates];

  // Commitment ladder, inferred conservatively from completed rule tasks. Recorded evidence can only be added by the founder.
  const via: Record<Rung, string[]> = { opinion: [], interest: [], meeting: [], commitment: [], deposit: [], paid: [], repeat: [] };
  if (isDone("icp-interviews")) via.opinion.push("icp-interviews");
  if (isDone("value-customer-test")) via.interest.push("value-customer-test");
  active.filter(t => t.ruleKey?.startsWith("channel:") && t.status === "done").forEach(t => via.meeting.push(t.title));
  if (isDone("pricing-offer-test")) via.commitment.push("pricing-offer-test");
  const rungs = ladderRungs.map(rung => ({ rung, reached: via[rung].length > 0, via: via[rung] }));
  const reachedIndex = rungs.map(r => r.reached).lastIndexOf(true);

  // Positioning (Dunford): slots filled from the founder's own words.
  const category = startup.description.match(/\b(platform|tool|app|application|service|marketplace|workspace|assistant|software|saas|api|network|course|device|платформ\w*|сервис\w*|приложени\w*|инструмент\w*|маркетплейс\w*|курс\w*|қосымша\w*|платформа\w*|құрал\w*)\b/i)?.[0] ?? "";
  const alternatives = value.differentiation.match(new RegExp(`${contrast.source}\\s*([^.,;]+)`, "i"))?.[0] ?? "";
  const slots: PositioningSlot[] = [
    { key: "bestFit", text: icp.buyerType || startup.customerSegment, filled: has(icp.buyerType) || has(startup.customerSegment) },
    { key: "pain", text: icp.painPoint, filled: has(icp.painPoint) },
    { key: "category", text: category, filled: has(category) },
    { key: "value", text: value.outcome, filled: has(value.outcome) },
    { key: "alternatives", text: alternatives, filled: has(alternatives) },
    { key: "unique", text: value.differentiation, filled: has(value.differentiation) },
  ];

  const weeks: WeekLoad[] = [1, 2, 3, 4].map(week => {
    const list = active.filter(t => t.week === week);
    return { week, total: list.length, todo: list.filter(t => t.status === "todo").length, inProgress: list.filter(t => t.status === "in_progress").length,
      done: list.filter(t => t.status === "done").length, skipped: list.filter(t => t.status === "skipped").length };
  });

  const missing = missingFields(sections);
  const firstOpen = (week: number | null) => active.filter(t => (t.status === "todo" || t.status === "in_progress") && (!week || t.week <= week)).sort((a, b) => a.week - b.week || (a.status === "in_progress" ? -1 : 1))[0];
  const openTask: Task | undefined = firstOpen(currentWeek) ?? firstOpen(null);
  const next: NextAction = missing.length && workspace.completion.completed < 5 ? { kind: "section", section: missing[0].section, field: missing[0].field }
    : openTask ? { kind: "task", taskId: openTask.id } : { kind: "review" };

  return {
    readiness: { overall, band, axes }, assumptions: mapped, channels: channelEntries,
    ladder: { reached: reachedIndex >= 0 ? ladderRungs[reachedIndex] : null, rungs },
    positioning: { slots, filled: slots.filter(s => s.filled).length }, price,
    load: { weeks, planDay, currentWeek, overdue }, missing, next,
    counts: { sectionsComplete: workspace.completion.completed, tasks: active.length, done: workspace.roadmapProgress.done,
      inProgress: active.filter(t => t.status === "in_progress").length, custom: active.filter(t => t.source === "custom").length,
      channels: named.length, assumptions: stated.length },
  };
}
