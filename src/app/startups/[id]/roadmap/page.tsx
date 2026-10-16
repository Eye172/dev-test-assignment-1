import { Suspense } from "react";
import { Roadmap } from "@/components/roadmap";
export const metadata = { title: "Roadmap" };
export default function RoadmapPage() { return <Suspense><Roadmap/></Suspense>; }
