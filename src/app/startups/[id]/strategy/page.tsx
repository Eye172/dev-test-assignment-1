import { translateDemoContent } from "@/lib/domain/localize-workspace";
import { getDisplayPrefs } from "@/ui/server-prefs";
import { dictionaryFor } from "@/ui/i18n/dictionaries";
import { Suspense } from "react";
import { StrategyEditor, type StrategyExamples } from "@/components/strategy-editor";
import { sectionKeys, sectionSchemas } from "@/lib/domain/schemas";
import { demoStrategy } from "@/server/demo";
export const metadata = { title: "Strategy builder" };

// The synthetic demo strategy doubles as optional, clearly labelled writing examples.
const examples = Object.fromEntries(sectionKeys.map(key => [key, sectionSchemas[key].parse(demoStrategy[key])])) as StrategyExamples;

export default async function StrategyPage() {
  const {locale}=await getDisplayPrefs(); const dict=dictionaryFor(locale);
  return <Suspense fallback={<StrategyLoading label={dict["nav.strategy"]}/>}><StrategyEditor examples={translateDemoContent(examples,locale)}/></Suspense>;
}

function StrategyLoading({label}:{label:string}) {
  return <div className="strategy-loading" aria-busy="true" aria-label={label}>
    <div className="page-heading"><div className="skeleton skeleton-title"/></div>
    <div className="strategy-layout" aria-hidden="true">
      <div className="section-rail skeleton skeleton-panel"/>
      <div className="editor-col"><div className="skeleton skeleton-title"/>{[1, 2, 3].map(key => <div key={key} className="skeleton skeleton-field"/>)}</div>
    </div>
    <p className="field-help" role="status">{label}…</p>
  </div>;
}
