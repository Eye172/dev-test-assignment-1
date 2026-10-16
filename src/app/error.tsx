"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="content" className="recovery">
    <h1 tabIndex={-1}>Something went wrong.</h1>
    <p className="muted">This page couldn’t load. Your saved work is safe in the database. Try again, or go back to the start.</p>
    <div className="actions"><button className="button primary" onClick={reset}>Try again</button><Link href="/" className="button ghost">Go home</Link></div>
  </main>;
}
