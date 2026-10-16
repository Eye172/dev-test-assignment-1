import Link from "next/link";
import { Brand } from "@/components/ui";
export default function NotFound() {
  return <div className="app-surface">
    <header className="site-header"><Brand/></header>
    <main id="content" className="recovery">
      <h1 tabIndex={-1}>This workspace isn’t here.</h1>
      <p className="muted">Check the link. If it was a demo copy, the demo database may have been reset.</p>
      <div className="actions"><Link href="/startups/new" className="button primary">Create startup</Link><Link href="/" className="button ghost">Go home</Link></div>
    </main>
  </div>;
}
