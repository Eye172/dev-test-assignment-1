import type { Metadata } from "next";
import "@fontsource-variable/inter/latin.css";
import "@fontsource-variable/space-grotesk/latin.css";
import "./globals.css";
export const metadata: Metadata = { title: { default: "Orbit GTM Studio",template: "%s · Orbit GTM" },description: "A founder's workspace for a clear go-to-market strategy and a practical 30-day plan.",robots: { index: false,follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a href="#content" className="skip-link">Skip to content</a>{children}</body></html>;
}
