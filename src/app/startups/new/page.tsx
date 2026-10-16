import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/ui";
import { ProfileForm } from "@/components/profile-form";

export const metadata = { title: "Create your startup" };

export default function NewStartup() {
  return <div className="app-surface">
    <header className="site-header"><Brand/><div className="header-actions"><span className="demo-tag">Demo mode</span></div></header>
    <main id="content" className="onboarding">
      <aside className="onboarding-intro">
        <Link href="/" className="text-link back-link"><ArrowLeft size={16} aria-hidden/>Back</Link>
        <h1 tabIndex={-1}>Create your startup</h1>
        <p className="lead">Six essentials give your workspace a starting point. You can refine everything later, and your strategy can take shape in any order.</p>
        <div className="plate instrument onboarding-note">
          <div className="screen">
            <p className="inst-row"><span>Required fields</span><strong>6</strong></p>
            <p className="inst-row"><span>Optional</span><strong>website, context</strong></p>
            <p className="inst-row"><span>Time</span><strong>~2 min</strong></p>
          </div>
          <p className="muted onboarding-warn">Demo mode: anyone with the link can view and edit. Use synthetic, non-sensitive information.</p>
        </div>
      </aside>
      <section className="plate onboarding-form" aria-label="Startup profile form"><ProfileForm/></section>
    </main>
  </div>;
}
