import type { Model, Stage } from "../intake/extract";

/** Complete option sets for the guided brief. Model and stage keep the assignment's values; detail lives a level below. */
export const modelOptions: { value: Model; title: string; detail: string }[] = [
  { value: "B2B", title: "Businesses pay", detail: "Companies, teams or professionals buy for work." },
  { value: "B2C", title: "People pay", detail: "Individuals or households buy for themselves." },
  { value: "B2G", title: "Public sector pays", detail: "Government bodies, municipalities, public schools or hospitals." },
];
export const businessTypes = ["SaaS", "Marketplace", "E-commerce / D2C", "B2B2C", "Services / agency", "Hardware / IoT", "Platform / API", "Fintech", "Edtech", "Healthtech", "Logistics", "Media / content", "Other"];

export const stageOptions: { value: Stage; title: string; detail: string }[] = [
  { value: "Idea", title: "Idea", detail: "Problem and solution are on paper; nothing is in users’ hands yet." },
  { value: "MVP", title: "MVP", detail: "A working version exists and first people are trying it." },
  { value: "Early Traction", title: "Early traction", detail: "Some customers use it regularly or pay; you are learning what repeats." },
];
export const stageSignals = ["Customer interviews done", "Prototype or demo", "Live product", "First active users", "Pilot customers", "Paying customers", "Repeat purchases", "Letters of intent"];

export const marketGroups: { label: string; options: string[] }[] = [
  { label: "Central Asia & CIS", options: ["Kazakhstan", "Uzbekistan", "Kyrgyzstan", "Central Asia", "CIS"] },
  { label: "Europe & Middle East", options: ["Europe", "DACH", "United Kingdom", "Turkey", "UAE", "MENA"] },
  { label: "Americas & Asia-Pacific", options: ["United States", "North America", "Latin America", "India", "Southeast Asia", "Japan", "South Korea"] },
  { label: "Not one country", options: ["Global", "Remote-first, English-speaking"] },
];

export const buyerRoles: Record<Model, string[]> = {
  B2B: ["Founders / CEOs", "Heads of operations", "Sales leaders", "Marketing leads", "HR / people teams", "Finance / CFOs", "IT / engineering leads", "Product managers", "Clinic or shop owners"],
  B2C: ["Students", "Parents", "Young professionals", "Freelancers", "Small-business owners (personal use)", "Retirees", "Gamers / hobbyists", "Patients"],
  B2G: ["City administrations", "Ministries / agencies", "Public schools", "Public hospitals", "Universities", "Police / emergency services"],
};
export const sizeOptions: Record<Model, string[]> = {
  B2B: ["Solo / 1–10", "11–50 employees", "51–200 employees", "201–1000 employees", "1000+ employees"],
  B2C: ["Under 18", "18–24", "25–34", "35–49", "50+", "Any age"],
  B2G: ["Local level", "Regional level", "National level"],
};

export const channelOptions = ["Founder-led outreach", "LinkedIn", "Cold email", "Communities", "Partnerships", "Incubator partnerships", "Events", "Content / SEO", "Referrals", "Paid ads", "Marketplaces"];
export const pricingModels = ["Subscription", "Usage-based", "Per seat", "One-time purchase", "Paid pilot", "Commission / take rate", "Freemium", "Not sure yet"];
