"use client";
import Link from "next/link";
import { useDisplay } from "@/ui/display";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useDisplay();
  return <main id="content" className="recovery v4-recovery">
    <h1 tabIndex={-1}>{t("err.title")}</h1>
    <p className="v4-lede">{t("err.body")}</p>
    <div className="land-actions"><button className="v4-button is-primary" onClick={reset}>{t("common.retry")}</button><Link href="/" className="v4-button">{t("common.backHome")}</Link></div>
  </main>;
}
