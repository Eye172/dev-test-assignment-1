import Link from "next/link";
import { Brand } from "@/components/ui";
export default function NotFound() { return <div className="app-surface"><header className="site-header"><Brand/></header><main id="content" className="recovery"><span className="index-label">OFF THE MAP</span><h1 tabIndex={-1}>This workspace<br/>isn't here.</h1><p className="muted">Check the link, or start a new trajectory. The demo database may have been reset.</p><Link href="/startups/new" className="button primary">Create startup</Link><Link href="/" className="button ghost">Go home</Link></main></div>; }
