import { expect, test } from "@playwright/test";

test("all three landing pages remain readable without JavaScript at responsive breakpoints", async ({ browser, isMobile, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    for (const version of ["observatory", "ledger", "flow"]) {
      for (const width of isMobile ? [320, 375, 768] : [1024, 1440]) {
        await page.setViewportSize({ width, height: 740 });
        await page.goto(`/?ui=${version}&lang=en`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const actions = page.locator(".land-copy .land-actions");
        await expect(actions.getByRole("link", { name: "Create startup", exact: true })).toBeVisible();
        await expect(page.locator(".land-note")).toContainText("synthetic");
        await expect(page.locator("#models")).toContainText("Fieldnote");
        for (const item of await page.locator(".land-steps li, .land-agents li").all()) {
          expect(await item.evaluate(el => getComputedStyle(el).opacity)).toBe("1");
        }
        // Tiny reduced-motion color transitions may exist while fonts settle;
        // decorative keyframe animations must not run.
        expect(await page.locator(".land-copy").evaluate(el => el.getAnimations({ subtree: true }).filter(a => a instanceof CSSAnimation && a.playState === "running").length)).toBe(0);
        const geometry = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
        expect(geometry.scroll, `${version}: horizontal overflow at ${width}px`).toBeLessThanOrEqual(geometry.width);
        if (width <= 375) {
          const box = await actions.getByRole("link", { name: "Create startup", exact: true }).boundingBox();
          expect(box!.height).toBeGreaterThanOrEqual(44);
          expect(box!.y + box!.height).toBeLessThan(740);
        }
      }
    }
  } finally { await context.close(); }
});
