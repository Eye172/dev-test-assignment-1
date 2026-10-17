/**
 * Deterministic intake: reads a founder's free text and finds what it can, transparently.
 * Used when AI intake is unavailable, and labelled "rules" in the interface. Never invents values:
 * every field it fills quotes or classifies the founder's own words.
 */
export type Model = "B2B" | "B2C" | "B2G";
export type Stage = "Idea" | "MVP" | "Early Traction";
export type ProfileDraft = { name: string; description: string; businessModel: Model | ""; stage: Stage | ""; targetMarket: string; customerSegment: string; websiteUrl: string };
export type StrategyHints = { painPoint: string; outcome: string; price: string; pricingModel: string; channels: string[] };
export type Origin = "text" | "file" | "answer" | "choice" | "ai";
export type IntakeDraft = { profile: ProfileDraft; hints: StrategyHints; origin: Partial<Record<keyof ProfileDraft | keyof StrategyHints, Origin>> };
export const requiredFields = ["name", "description", "businessModel", "stage", "targetMarket", "customerSegment"] as const;
export type RequiredField = typeof requiredFields[number];

export const emptyDraft = (): IntakeDraft => ({
  profile: { name: "", description: "", businessModel: "", stage: "", targetMarket: "", customerSegment: "", websiteUrl: "" },
  hints: { painPoint: "", outcome: "", price: "", pricingModel: "", channels: [] }, origin: {},
});

const sentences = (text: string) => text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[A-ZА-Я0-9"“])/).map(s => s.trim()).filter(Boolean);
const clip = (s: string, n: number) => s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
const count = (text: string, words: RegExp) => (text.match(words) ?? []).length;

export const markets = ["Kazakhstan", "Uzbekistan", "Kyrgyzstan", "Central Asia", "Russia", "CIS", "Turkey", "UAE", "Saudi Arabia", "MENA", "India", "Indonesia", "Southeast Asia", "China", "Japan", "South Korea", "Germany", "France", "United Kingdom", "UK", "Europe", "DACH", "Nordics", "Poland", "United States", "US", "USA", "North America", "Canada", "Brazil", "Latin America", "Mexico", "Nigeria", "Kenya", "Africa", "Australia", "Global"];
const marketRe = new RegExp(`\\b(${markets.map(m => m.replace(/ /g, "\\s+")).join("|")})\\b`, "gi");
const channelWords: [RegExp, string][] = [
  [/linkedin/i, "LinkedIn"], [/cold (e-?mail|outreach)|outbound/i, "Cold email"], [/founder[- ]led|direct (sales|outreach)/i, "Founder-led outreach"],
  [/communit(y|ies)|telegram|discord|slack groups?/i, "Communities"], [/\bseo\b|content|blog/i, "Content / SEO"], [/partner(ship)?s?|resell/i, "Partnerships"],
  [/events?|conferences?|meetups?/i, "Events"], [/referrals?|word of mouth/i, "Referrals"], [/(paid|google|meta|facebook|instagram) ads|advertis/i, "Paid ads"],
  [/marketplace|app ?store|product hunt/i, "Marketplaces"], [/incubator|accelerator/i, "Incubator partnerships"],
];

export function extract(raw: string): IntakeDraft {
  const draft = emptyDraft();
  const text = raw.trim();
  if (!text) return draft;
  const lower = text.toLowerCase();
  const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => { if (v) { draft.profile[k] = v; draft.origin[k] = "text"; } };
  const hint = <K extends keyof StrategyHints>(k: K, v: StrategyHints[K]) => { if (Array.isArray(v) ? v.length : v) { draft.hints[k] = v; draft.origin[k] = "text"; } };

  const url = text.match(/\b(https?:\/\/[^\s,)]+|(?:www\.)?[a-z0-9-]+\.(?:com|io|ai|app|co|kz|org|net|dev|tech)(?:\/[^\s,)]*)?)/i)?.[0];
  if (url && !/@/.test(url)) set("websiteUrl", /^https?:/i.test(url) ? url : `https://${url}`);

  const explicit = text.match(/\b(B2B|B2C|B2G)\b/i)?.[1]?.toUpperCase() as Model | undefined;
  const scores: Record<Model, number> = {
    B2G: count(lower, /\b(government|public sector|municipal|ministr(y|ies)|state agenc|akimat|public institution|schools? district)\w*/g) * 2,
    B2B: count(lower, /\b(businesses|companies|teams|enterprises?|smbs?|startups|firms|clinics|retailers|shops|agencies|employers|saas|b2b)\b/g),
    B2C: count(lower, /\b(consumers?|people|individuals|students|parents|families|users|shoppers|patients|travell?ers|b2c)\b/g),
  };
  const best = (Object.entries(scores) as [Model, number][]).sort((a, b) => b[1] - a[1])[0];
  set("businessModel", explicit ?? (best[1] > 0 ? best[0] : ""));

  const stage = text.match(/\b(idea|mvp|early traction) stage\b/i)?.[1]?.toLowerCase() ?? text.match(/\b(?:stage\s*:\s*|we (?:are|are at|have) (?:the |an? )?)(idea|mvp|early traction)\b/i)?.[1]?.toLowerCase();
  const positive = sentences(text).filter(s => !/\b(no|not|without|zero|haven.t|don.t|not yet)\b/i.test(s)).join(" ");
  if (stage) set("stage", stage === "idea" ? "Idea" : stage === "mvp" ? "MVP" : "Early Traction");
  else if (/\b(paying customers|revenue|mrr|arr|\$\s?\d[\d,.]*k?\s*(\/|per)\s*(month|mo|year)|(\d{2,}|[5-9]) (customers|clients)|growing \d+%)\b/i.test(positive)) set("stage", "Early Traction");
  else if (/\b(mvp|prototype|beta|pilot|launched|first users|live product|testing with)\b/i.test(text)) set("stage", "MVP");
  else if (/\b(idea|concept|planning to|haven'?t built|exploring|validating the idea)\b/i.test(text)) set("stage", "Idea");

  const found = [...new Set((text.match(marketRe) ?? []).map(m => m.replace(/\s+/g, " ")))];
  set("targetMarket", found.slice(0, 2).join(" and "));

  const firstLine = text.split(/\n/)[0].trim();
  // A short first line without a full stop is a title; names never span lines.
  const titleLine = text.includes("\n") && firstLine.length <= 40 && !/[.!?]$/.test(firstLine) && firstLine.split(" ").length <= 4;
  const named = text.match(/(?:^|\b)(?:[Ww]e are|[Ww]e're|[Ww]e are building|[Ww]e're building|I'?m building|called|[Ss]tartup name:?|[Nn]ame:?)[ \t]+(?:building[ \t]+)?([A-Z][\w&.-]*(?:[ \t][A-Z][\w&.-]*){0,2})/)?.[1]
    ?? (titleLine ? firstLine : undefined)
    ?? text.match(/^([A-Z][\w&.-]*(?:[ \t][A-Z][\w&.-]*){0,2})[ \t]+(?:is|helps|lets|turns|builds|—|-)[ \t]/m)?.[1] ?? "";
  set("name", named.replace(/[.,:;]+$/, ""));

  const body = sentences(titleLine ? text.slice(text.indexOf("\n") + 1) : text);
  set("description", clip(body.slice(0, 2).join(" "), 400));

  const segment = text.match(/\b(?:for|helps|lets|serves|our customers are|we sell to|target(?:ing)?)\s+((?:[a-z0-9–-]+\s){1,10}?[a-z0-9–-]+?)(?=[,.;:]|\s(?:to|who|that|by|with|in|so|book|turn|find|track|manage|get)\b)/i)?.[1]?.trim();
  set("customerSegment", segment && !marketRe.test(segment) ? clip(segment, 200) : "");
  marketRe.lastIndex = 0;

  const all = sentences(text);
  hint("painPoint", clip(all.find(s => /\b(problem|struggl|pain|waste|hard to|can'?t|frustrat|lose|losing|manual|scattered|slow)\w*/i.test(s)) ?? "", 300));
  hint("outcome", clip(all.find(s => /\b(so that|saves?|reduc|increas|faster|cut|in minutes|without)\w*/i.test(s)) ?? "", 300));
  hint("price", text.match(/\$\s?\d[\d,.]*\s*(?:k\b)?(?:\s*(?:\/|per)\s*\w+){0,2}/i)?.[0] ?? "");
  hint("pricingModel", text.match(/\b(subscription|freemium|one-?time|usage-based|per seat|commission|paid pilot|licen[cs]e)\b/i)?.[0] ?? "");
  const channelText = sentences(text).filter(s => !/\b(no|not|never|without|avoid|exclude|won.t|don.t)\b/i.test(s)).join(" ");
  const picked = channelWords.filter(([re]) => re.test(channelText)).map(([, name]) => name);
  hint("channels", picked.filter(n => !(n === "Partnerships" && picked.includes("Incubator partnerships"))).slice(0, 3));
  return draft;
}

export function missing(draft: IntakeDraft): RequiredField[] {
  return requiredFields.filter(f => !draft.profile[f]);
}

export type Question = { id: string; field: RequiredField | "painPoint" | "price" | "channels" | "context"; text: string; why: string; kind: "choice" | "text"; options?: string[]; placeholder?: string; multi?: boolean };
const bank: Record<Exclude<Question["field"], "context">, Omit<Question, "id" | "field">> = {
  name: { text: "What is the startup called?", why: "It names your workspace and plan.", kind: "text", placeholder: "Fieldnote" },
  description: { text: "In one or two sentences: what do you build, and for whom?", why: "The plan uses this as its anchor.", kind: "text", placeholder: "A workspace that turns customer interviews into product decisions for small SaaS teams." },
  businessModel: { text: "Who pays you?", why: "Sales motion and pricing depend on it.", kind: "choice", options: ["B2B", "B2C", "B2G"] },
  stage: { text: "Where are you today?", why: "Week 1 tasks differ for an idea and a live product.", kind: "choice", options: ["Idea", "MVP", "Early Traction"] },
  targetMarket: { text: "Which market do you want to win first?", why: "Channels and price assumptions are local.", kind: "choice", options: ["Kazakhstan", "Central Asia", "CIS", "Europe", "United States", "Global"] },
  customerSegment: { text: "Who exactly feels the problem most — and would pay first?", why: "A narrow first buyer makes every experiment sharper.", kind: "text", placeholder: "Operations managers at logistics companies with 20–200 employees" },
  painPoint: { text: "What do they struggle with today, in their words?", why: "Interviews in week 1 test exactly this.", kind: "text", placeholder: "Interview notes are scattered across docs and calls" },
  price: { text: "Do you have a first price in mind, even a guess?", why: "A guess is fine — the plan turns it into a test.", kind: "text", placeholder: "$29 per workspace per month, or a $300 pilot" },
  channels: { text: "Where do your first customers already spend time?", why: "Each channel becomes one small experiment.", kind: "choice", multi: true, options: ["Founder-led outreach", "LinkedIn", "Communities", "Partnerships", "Events", "Content / SEO", "Referrals", "Paid ads"] },
};

/** Stop as soon as the required profile is complete. Extra context remains optional. */
export function nextQuestion(draft: IntakeDraft, asked: string[], limit = 7): Question | null {
  if (asked.length >= limit) return null;
  const queue = [...missing(draft)];
  const field = queue.find(f => !asked.includes(f));
  return field ? { id: field, field, ...bank[field] } : null;
}

/** The model can ask about a business decision even when the six profile fields are complete. */
export function nextIntakeQuestion(draft: IntakeDraft, asked: string[], questions: Question[]): Question | null {
  if (asked.length >= 7) return null;
  const covered=questions.filter(q=>asked.includes(q.id)&&q.field!=="context").map(q=>q.field);
  const question = questions.find(q => !asked.includes(q.id) && (q.field === "context" || !covered.includes(q.field)) && (q.field === "context" ||
    (q.field in draft.profile ? !draft.profile[q.field as keyof ProfileDraft] :
      q.field === "channels" ? !draft.hints.channels.length : !draft.hints[q.field as "painPoint" | "price"])));
  return question ?? nextQuestion(draft,[...asked,...covered],Number.MAX_SAFE_INTEGER);
}

export function answer(draft: IntakeDraft, field: Question["field"], value: string | string[]): IntakeDraft {
  const next: IntakeDraft = { profile: { ...draft.profile }, hints: { ...draft.hints, channels: [...draft.hints.channels] }, origin: { ...draft.origin } };
  if (field === "context") return next; // Retained in the question/answer journal, never invented as a profile field.
  if(field==="businessModel"&&!["B2B","B2C","B2G"].includes(String(value)))return next;
  if(field==="stage"&&!["Idea","MVP","Early Traction"].includes(String(value)))return next;
  if (field === "channels") { next.hints.channels = (Array.isArray(value) ? value : [value]).filter(Boolean).slice(0, 3); next.origin.channels = "answer"; }
  else if (field === "painPoint" || field === "price") { next.hints[field] = String(value).trim(); next.origin[field] = "answer"; }
  else { (next.profile as Record<string, string>)[field] = String(value).trim(); next.origin[field] = "answer"; }
  return next;
}
