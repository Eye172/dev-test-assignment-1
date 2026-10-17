import type { Metadata, Viewport } from "next";
import "@fontsource-variable/space-grotesk/index.css";
import "@fontsource-variable/montserrat/index.css";
import "@fontsource-variable/jetbrains-mono/index.css";
import "./globals.css";
import { DisplayProvider } from "@/ui/display";
import { getDisplayPrefs } from "@/ui/server-prefs";
import { dictionaryFor } from "@/ui/i18n/dictionaries";
import { resolvedTheme } from "@/ui/prefs";

export const metadata: Metadata = {
  title: { default: "Orbit GTM Studio", template: "%s · Orbit GTM Studio" },
  description: "A founder's workspace for a precise go-to-market strategy, transparent models and a practical 30-day plan.",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/orbit-icon-v4.svg" },
};
export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#07090a" }, { media: "(prefers-color-scheme: light)", color: "#f4f7f4" }],
  width: "device-width", initialScale: 1, viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const prefs = await getDisplayPrefs();
  const dict = dictionaryFor(prefs.locale);
  return <html lang={prefs.locale} data-ui={prefs.version} data-theme={resolvedTheme(prefs)} suppressHydrationWarning>
    <body>
      <a href="#content" className="skip-link">{dict["chrome.skip"]}</a>
      <DisplayProvider prefs={prefs} dict={dict}>{children}</DisplayProvider>
    </body>
  </html>;
}
