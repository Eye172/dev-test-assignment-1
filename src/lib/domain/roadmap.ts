import { sectionSchemas } from "./schemas";
import { calculateCompletion, emptySection } from "./completion";
import type { Startup, StrategySection } from "./types";

export type TaskSuggestion = { ruleKey: string; title: string; deliverable: string; rationale: string; week: number };
const excerpt = (v: string, length = 140) => v.length > length ? `${v.slice(0, length - 1)}…` : v;
// Stable, deterministic identity lets a channel survive reordering without losing task history.
function channelKey(name: string): string {
  const normalized = name.trim().toLowerCase();
  return `channel:${Array.from(normalized).map(c => c.codePointAt(0)!.toString(16)).join("-")}`;
}
export function generateRoadmap(startup: Startup, sections: StrategySection[]): TaskSuggestion[] {
  const completion = calculateCompletion(sections);
  const complete = (key: string) => completion.sections.find(s => s.key === key)!.complete;
  const get = (key: StrategySection["key"]) => sections.find(s => s.key === key)?.data ?? emptySection(key).data;
  const icp = sectionSchemas.icp.parse(get("icp"));
  const value = sectionSchemas.value.parse(get("value"));
  const pricing = sectionSchemas.pricing.parse(get("pricing"));
  const channels = sectionSchemas.channels.parse(get("channels"));
  const assumptions = sectionSchemas.assumptions.parse(get("assumptions")).assumptions;
  const risky = [...assumptions].filter(a => a.statement).sort((a, b) => ({ low: 0, medium: 1, high: 2 }[b.risk] - { low: 0, medium: 1, high: 2 }[a.risk]))[0];
  const namedChannels = channels.channels.filter(c => c.name);
  const distinct = namedChannels.filter((c, i) => namedChannels.findIndex(x => x.name.toLowerCase() === c.name.toLowerCase()) === i);
  const tasks: TaskSuggestion[] = [
    { ruleKey: complete("icp") ? "icp-interviews" : "icp-prepare", week: 1,
      title: complete("icp") ? "Interview five people in your target segment" : "Refine your first buyer persona",
      deliverable: complete("icp") ? `Five interview notes about ${excerpt(icp.painPoint)}. Record who experiences it, when, and what they use today.` : `A specific buyer, pain point and buying trigger for ${excerpt(startup.customerSegment)} in ${excerpt(startup.targetMarket)}.`,
      rationale: complete("icp") ? "Your ICP is documented; interviews can now challenge it." : "Your ICP has missing inputs. A narrower buyer definition makes experiments useful." },
    { ruleKey: complete("value") ? "value-customer-test" : "value-prepare", week: 1,
      title: complete("value") ? "Test your value proposition with customers" : "Write a testable value proposition",
      deliverable: complete("value") ? `Share the promise “${excerpt(value.outcome)}” with five target customers. Log understanding, objections and buying intent.` : "One customer problem, promised outcome, differentiator and explicit supporting proof or assumptions.",
      rationale: complete("value") ? "The recorded promise needs customer evidence, beyond positive opinions." : "Value Proposition is incomplete; clarify what customers should gain." },
    { ruleKey: "experiment-design", week: 1, title: "Set success criteria before your first experiment",
      deliverable: `${channels.firstExperiment ? `For “${excerpt(channels.firstExperiment)}”, specify` : "Specify"} audience, sample size, deadline, a measurable success threshold and a stop/iterate decision rule.`,
      rationale: "Predefined success criteria prevent moving the goalposts after results arrive." },
    ...(!distinct.length ? [{ ruleKey: "channel-selection", week: 2, title: "Choose one channel and launch a small test",
      deliverable: "One channel, why your buyers use it, and a first experiment with a measurable response or conversion target.",
      rationale: "No named acquisition channel is saved yet. Start with one focused experiment." }] : distinct.map(c => ({
      ruleKey: channelKey(c.name), week: 2, title: `Run your first ${excerpt(c.name, 90)} experiment`,
      deliverable: `A small ${excerpt(c.name, 90)} test with audience, outreach/activity count, responses, objections and next action.${c.reason ? ` Channel hypothesis: ${excerpt(c.reason)}.` : " Add why this channel should reach your buyer."}`,
      rationale: `You selected ${excerpt(c.name, 90)}. Measure qualified interest and willingness to pay separately.`,
    }))),
    { ruleKey: risky ? "assumption-experiment" : "assumption-prepare", week: 2, title: risky ? "Test your highest-risk market assumption" : "Identify and test three market assumptions",
      deliverable: risky ? `Test “${excerpt(risky.statement)}” (${risky.risk} risk). ${risky.validationMethod ? `Method: ${excerpt(risky.validationMethod)}.` : "Define a validation method first."} Record evidence and uncertainty.` : "Three testable assumptions, each with a risk rating, method and evidence to collect.",
      rationale: risky ? "Risk ratings prioritize the assumption that could most change the commercial plan." : "No testable market assumption is recorded yet." },
    { ruleKey: complete("pricing") ? "pricing-offer-test" : "pricing-prepare", week: 3, title: complete("pricing") ? "Test willingness to pay for your initial offer" : "Define an initial pricing hypothesis",
      deliverable: complete("pricing") ? `Present ${excerpt(pricing.initialPrice)} per ${excerpt(pricing.paymentUnit)} to target customers. Record price objections and concrete commitments; do not treat interest as payment.` : "A pricing model, initial price assumption, payment unit and rationale, followed by a small offer test.",
      rationale: complete("pricing") ? "Your price is an assumption until target buyers respond to an actual offer." : "Pricing inputs are incomplete; define a clear offer before testing it." },
    { ruleKey: "evidence-review", week: 4, title: "Review the evidence and commercial bottleneck",
      deliverable: "An evidence summary separating opinions, interest, meetings, letters of intent, deposits, paid pilots and repeat purchases. Name the remaining uncertainty.",
      rationale: "Evidence strength matters more than the number of activities completed." },
    { ruleKey: "founder-decision", week: 4, title: "Choose your next commercial move",
      deliverable: "A founder-written continue/change/stop decision, the evidence behind it, and the next experiment. Update the GTM strategy with what changed.",
      rationale: "The founder makes the decision; task completion cannot validate a market assumption automatically." },
  ];
  return tasks;
}
