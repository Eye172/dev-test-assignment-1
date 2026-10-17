import { Suspense } from "react";
import { Overview } from "@/components/overview";
export const metadata = { title: "Overview" };
export default function OverviewPage() { return <Suspense><Overview/></Suspense>; }
