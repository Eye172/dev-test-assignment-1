"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/client-api";
import type { Workspace } from "@/lib/domain/types";
import { ErrorNotice, Spinner, useHydrated } from "./ui";

export function DemoButton({ className = "button" }: { className?: string }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  async function open() {
    setPending(true); setError(null);
    try { const ws = await api<Workspace>("/api/demo", { method: "POST" }); router.push(`/startups/${ws.startup.id}`); }
    catch (e) { setError(e as Error); setPending(false); }
  }
  return <>
    <button type="button" className={className} onClick={open} disabled={pending || !hydrated} aria-busy={pending}>
      {pending ? <><Spinner/>Opening demo…</> : <>Explore the demo startup<ArrowRight size={17} aria-hidden/></>}
    </button>
    {error && <div className="welcome-error"><ErrorNotice error={`Couldn't open the demo. ${error.message}`} onRetry={open}/></div>}
  </>;
}
