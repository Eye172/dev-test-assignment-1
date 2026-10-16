import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/space-grotesk/index.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Orbit GTM Studio", template: "%s · Orbit GTM Studio" },
  description: "A founder's workspace for a clear go-to-market strategy and a practical 30-day plan.",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#070807" }, { media: "(prefers-color-scheme: light)", color: "#f4f7f4" }],
  width: "device-width", initialScale: 1, viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a href="#content" className="skip-link">Skip to content</a>{children}</body></html>;
}
