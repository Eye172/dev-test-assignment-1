import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/ui";
import { ProfileForm } from "@/components/profile-form";

export const metadata = { title: "Create your startup" };

export default function NewStartup() {
  return <div className="app-surface onboarding-surface">
    <header className="site-header"><Brand/><div className="header-actions"><span className="demo-tag"><span className="demo-dot" aria-hidden/>Demo mode</span></div></header>
    <main id="content" className="onboarding">
      <aside className="onboarding-intro">
        <Link href="/" className="text-link back-link"><ArrowLeft size={16} aria-hidden/>Back</Link>
        <p className="eyebrow reveal">Step 01 of 03 · Profile</p>
        <h1 tabIndex={-1} className="reveal" style={{ animationDelay: "80ms" }}>Create your startup</h1>
        <p className="lead reveal" style={{ animationDelay: "160ms" }}>Six essentials give your workspace a starting point. Refine everything later; your strategy can take shape in any order.</p>
        <ol className="onboarding-path reveal" style={{ animationDelay: "240ms" }} aria-label="What happens next">
          <li className="now"><span>01</span>Profile<small>~2 min</small></li>
          <li><span>02</span>Five strategy decisions<small>autosaved</small></li>
          <li><span>03</span>30-day plan<small>rule-based</small></li>
        </ol>
        <p className="onboarding-warn reveal" style={{ animationDelay: "320ms" }}>Demo mode: anyone with the link can view and edit. Use synthetic, non-sensitive information.</p>
      </aside>
      <section className="plate onboarding-form reveal-pop" style={{ animationDelay: "120ms" }} aria-label="Startup profile form"><ProfileForm/></section>
    </main>
  </div>;
}
