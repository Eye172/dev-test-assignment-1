import { Suspense } from "react";
import { StrategyEditor } from "@/components/strategy-editor";
export const metadata = { title: "Strategy builder" };
export default function StrategyPage() { return <Suspense fallback={<StrategyLoading/>}><StrategyEditor/></Suspense>; }

function StrategyLoading() {
  return <div className="strategy-loading" aria-busy="true" aria-label="Loading strategy">
    <div className="page-heading"><div className="skeleton skeleton-title"/></div>
    <div className="strategy-layout" aria-hidden="true">
      <div className="section-rail skeleton skeleton-panel"/>
      <div className="editor-col plate editor"><div className="skeleton skeleton-title"/>{[1,2,3].map(key => <div key={key} className="skeleton skeleton-field"/>)}</div>
    </div>
    <p className="field-help" role="status">Opening strategy…</p>
  </div>;
}
