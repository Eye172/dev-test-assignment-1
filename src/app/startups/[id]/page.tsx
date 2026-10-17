import { Suspense } from "react";
import { OverviewScreen } from "@/ui/screens/overview";
export const metadata = { title: "Overview" };
export default function OverviewPage() { return <Suspense><OverviewScreen/></Suspense>; }
