import { Suspense } from "react";
import { DashboardScreen } from "@/ui/screens/dashboard";
export const metadata = { title: "Dashboard" };
export default function DashboardPage() { return <Suspense><DashboardScreen/></Suspense>; }
