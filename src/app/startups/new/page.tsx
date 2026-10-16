import { Brand } from "@/components/ui";
import { OnboardingFlow } from "@/components/onboarding/flow";

export const metadata = { title: "Create your startup" };

export default function NewStartup() {
  return <div className="app-surface onboarding-surface">
    <header className="site-header"><Brand/><div className="header-actions"><span className="demo-tag"><span className="demo-dot" aria-hidden/>Demo mode</span></div></header>
    <main id="content" className="onboarding-main">
      <OnboardingFlow/>
      <p className="onboarding-warn">Demo mode: anyone with the link can view and edit. Use synthetic, non-sensitive information.</p>
    </main>
  </div>;
}
