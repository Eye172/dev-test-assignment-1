import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard";
export const metadata = { title: "Dashboard" };
export default function DashboardPage() { return <Suspense><Dashboard/></Suspense>; }
