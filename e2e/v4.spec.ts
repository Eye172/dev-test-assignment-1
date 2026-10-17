import { test, expect } from "@playwright/test";
import { dictionaryFor } from "../src/ui/i18n/dictionaries";

for (const version of ["observatory", "ledger", "flow"] as const) {
  test(`${version} preserves saved strategy across EN/RU/KK and all workspace routes`, async ({ page }) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(`${page.url()}: ${error.message}`));
    await page.emulateMedia({ reducedMotion: "reduce" });
    const response = await page.request.post("/api/demo");
    expect(response.status()).toBe(201);
    const ws = (await response.json()).data;
    const base = `/startups/${ws.startup.id}`;
    // Large saved sizing values exercise real numeric grouping during SSR in
    // kk-KZ, including browsers whose ICU tables lack Kazakh formatting.
    const updated = await page.request.patch(`/api/startups/${ws.startup.id}`, { data: {
      expectedRevision: ws.startup.revision,
      patch: { customFields: { ...ws.startup.customFields, "Reachable accounts": "10000" } },
    } });
    expect(updated.ok()).toBe(true);
    for (const locale of ["en", "ru", "kk"] as const) {
      const dict = dictionaryFor(locale);
      await page.goto(`${base}/strategy?section=icp&ui=${version}&lang=${locale}`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("data-ui", version);
      const buyer = page.getByLabel(dict["field.buyerType"], { exact: false });
      await buyer.fill(`Saved buyer ${locale}`);
      await page.getByRole("button", { name: dict["st.saveAria"], exact: true }).click();
      await expect(page.locator(".editor-footer .save-state")).toContainText(dict["chrome.saved"]);
      await page.reload();
      await expect(buyer).toHaveValue(`Saved buyer ${locale}`);
      for (const path of [base, `${base}/dashboard`, `${base}/roadmap`, `${base}/ai`]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.getByRole("navigation", { name: dict["nav.workspace"], exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${version}/${locale}: ${path}`).toBe(true);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
      }
    }
    expect(errors).toEqual([]);
  });
}
