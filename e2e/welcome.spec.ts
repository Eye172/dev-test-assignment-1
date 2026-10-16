import { expect, test } from "@playwright/test";

test("welcome example remains readable without JavaScript across its responsive breakpoints", async ({ browser, isMobile, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    for (const width of isMobile ? [320, 375, 768] : [1024, 1440]) {
      await page.setViewportSize({ width, height: 740 });
      await page.goto("/");
      const example = page.getByRole("figure", { name: "Fieldnote example Synthetic · not validated" });
      await expect(example).toBeVisible();
      await expect(example.getByText("Customer interview evidence is scattered across notes and calls", { exact: false })).toBeVisible();
      await expect(example.getByRole("heading", { name: "Interview five people in your target segment" })).toBeVisible();
      await expect(example).toContainText("Your ICP is documented; interviews can now challenge it.");
      await expect(example).toContainText("Evidence to collect");
      expect(await example.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
      const geometry = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
      expect(geometry.scroll, `Horizontal overflow at ${width}px`).toBeLessThanOrEqual(geometry.width);
      // A visitor can start before reaching the longer explanation, including on a narrow phone.
      if (width <= 375) {
        for (const control of [page.getByRole("link", { name: "Create startup", exact: true }), page.getByRole("button", { name: "Explore the demo startup", exact: true })]) {
          const box = await control.boundingBox();
          expect(box!.height).toBeGreaterThanOrEqual(44);
          expect(box!.y + box!.height).toBeLessThan(740);
        }
        const disclosure = await page.getByText("Demo mode · no login · synthetic, non-sensitive data", { exact: true }).boundingBox();
        expect(disclosure!.y + disclosure!.height).toBeLessThan(740);
      }
    }
  } finally { await context.close(); }
});
