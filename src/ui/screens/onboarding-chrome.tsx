"use client";
import type { ReactNode } from "react";
import { useDisplay } from "../display";
import { Brand, DisplayMenu } from "../kit";

/** Onboarding keeps the brand header and the language/interface switch, nothing else competing with the form. */
export function OnboardingChrome({ children }: { children: ReactNode }) {
  const { version } = useDisplay();
  return <div className={`v4-app v4-onboarding is-${version}`}>
    <header className="v4-topbar ob-topbar"><Brand/><div className="v4-header-actions"><DisplayMenu/></div></header>
    <main id="content" className="onboarding-main">
      {children}
    </main>
  </div>;
}
