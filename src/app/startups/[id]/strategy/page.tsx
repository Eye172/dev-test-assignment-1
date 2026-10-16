import { Suspense } from "react";
import { StrategyEditor, type StrategyExamples } from "@/components/strategy-editor";
import { sectionKeys, sectionSchemas } from "@/lib/domain/schemas";
import { demoStrategy } from "@/server/demo";
export const metadata = { title: "Strategy builder" };

// The synthetic demo strategy doubles as optional, clearly labelled writing examples.
const examples = Object.fromEntries(sectionKeys.map(key => [key, sectionSchemas[key].parse(demoStrategy[key])])) as StrategyExamples;

export default function StrategyPage() { return <Suspense fallback={<StrategyLoading/>}><StrategyEditor examples={examples}/></Suspense>; }

function StrategyLoading() {
  return <div className="strategy-loading" aria-busy="true" aria-label="Loading strategy">
    <div className="page-heading"><div className="skeleton skeleton-title"/></div>
    <div className="strategy-layout" aria-hidden="true">
      <div className="section-rail skeleton skeleton-panel"/>
      <div className="editor-col"><div className="skeleton skeleton-title"/>{[1, 2, 3].map(key => <div key={key} className="skeleton skeleton-field"/>)}</div>
    </div>
    <p className="field-help" role="status">Opening strategy…</p>
  </div>;
}
