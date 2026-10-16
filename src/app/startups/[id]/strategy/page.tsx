import { Suspense } from "react";
import { StrategyEditor } from "@/components/strategy-editor";
export const metadata = { title: "Strategy builder" };
export default function StrategyPage() { return <Suspense fallback={<p>Opening strategy…</p>}><StrategyEditor/></Suspense>; }
