import Link from "next/link";
import { getServerT } from "@/ui/server-prefs";
export default async function NotFound() {
  const { t } = await getServerT();
  return <div className="v4-app">
    <main id="content" className="recovery v4-recovery">
      <h1 tabIndex={-1}>{t("err.notFound")}</h1>
      <p className="v4-lede">{t("err.notFoundBody")}</p>
      <div className="land-actions"><Link href="/startups/new" className="v4-button is-primary">{t("land.cta.create")}</Link><Link href="/" className="v4-button">{t("common.backHome")}</Link></div>
    </main>
  </div>;
}
