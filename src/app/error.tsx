"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { error: Error & { digest?: string };reset: () => void }) {
  return <main id="content" className="recovery"><h1 tabIndex={-1}>A small interruption.</h1><p className="muted">We couldn't load this page. Try again, or return to the studio.</p><button className="button primary" onClick={reset}>Try again</button><Link href="/" className="button ghost">Go home</Link></main>;
}
