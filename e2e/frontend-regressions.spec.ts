import { test, expect, type Page, type Locator } from "@playwright/test";
import type { Workspace } from "../src/lib/domain/types";

// Regressions for issue #3 comment 6214760795 plus the draft-mirror update loop found while recording.
const pageErrors = new WeakMap<Page,string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = []; pageErrors.set(page,errors);
  page.on("pageerror",error => errors.push(error.message));
});
test.afterEach(({ page }) => { expect(pageErrors.get(page),"Browser JavaScript and hydration errors").toEqual([]); });

async function copyDemo(page: Page, plan = false) {
  const response = await page.request.post("/api/demo");
  expect(response.status()).toBe(201);
  const ws = (await response.json()).data as Workspace;
  if (!plan) return ws;
  const planned = await page.request.post(`/api/startups/${ws.startup.id}/roadmap`);
  expect(planned.ok()).toBe(true);
  return (await planned.json()).data as Workspace;
}

async function minimumTouchTarget(control: Locator) {
  // Position springs can briefly yield 43.999969px for a 44px button. Wait for the
  // rendered target to settle; retain the exact minimum rather than lowering it.
  await expect.poll(async () => {
    const box = await control.boundingBox();
    return box ? Math.min(box.width, box.height) : 0;
  }, { message: "The settled touch target must be at least 44px in both dimensions" }).toBeGreaterThanOrEqual(44);
}
test("form and task controls wait for hydration and retain typed input", async ({ page }) => {
  const ws = await copyDemo(page);
  async function hydrate(path: string,control: Locator) {
    const scripts = /\/_next\/static\/.*\.js(?:\?.*)?$/;
    let pending = 0;
    let releaseScripts!: () => void;
    const ready = new Promise<void>(resolve => { releaseScripts = resolve; });
    await page.route(scripts,async route => { pending++; await ready; await route.continue(); });
    await page.goto(path,{ waitUntil: "commit" });
    // A readable SSR control must not accept edits before its change handler exists.
    try {
      await expect(control).toBeVisible(); await expect(control).toBeDisabled();
      await expect.poll(() => pending).toBeGreaterThan(0);
    } finally { releaseScripts(); }
    await expect(control).toBeEnabled();
    await page.unroute(scripts);
  }
  await hydrate("/startups/new",page.getByRole("button",{ name: /^Free form/ }));
  await hydrate(`/startups/${ws.startup.id}/roadmap`,page.getByLabel(`Status for ${ws.tasks[0].title}`,{ exact: true }));
  const price = page.getByLabel(/^Initial price assumption/);
  await hydrate(`/startups/${ws.startup.id}/strategy?section=pricing`,price);
  await price.fill("");
  await price.pressSequentially("$29 per seat",{ delay: 15 });
  await expect(price).toHaveValue("$29 per seat");
});

test("share menu supports arrow keys, boundaries and returning to normal tab order", async ({ page }) => {
  const ws = await copyDemo(page);
  await page.goto(`/startups/${ws.startup.id}/dashboard`);
  const trigger = page.getByRole("button",{ name: "Share and export",exact: true });
  const copy = page.getByRole("menuitem",{ name: "Copy workspace link",exact: true });
  const download = page.getByRole("menuitem",{ name: "Export workspace as JSON",exact: true });
  await trigger.click();
  await expect(copy).toBeFocused();
  await page.keyboard.press("ArrowDown"); await expect(download).toBeFocused();
  await page.keyboard.press("ArrowDown"); await expect(copy).toBeFocused();
  await page.keyboard.press("End"); await expect(download).toBeFocused();
  await page.keyboard.press("Home"); await expect(copy).toBeFocused();
  await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded","false");
  await trigger.click(); await expect(copy).toBeFocused(); await page.keyboard.press("Tab");
  await expect(trigger).toHaveAttribute("aria-expanded","false");
  await expect(copy).toBeHidden();
});

test("strategy feedback and phone navigation leave their controls usable", async ({ page,isMobile }) => {
  const ws = await copyDemo(page);
  await page.goto(`/startups/${ws.startup.id}/strategy?section=icp`);
  const buyer = page.getByLabel(/^Buyer type/);
  await expect(buyer).toBeVisible();
  if (isMobile) {
    const field = await buyer.boundingBox();
    expect(field!.y + field!.height).toBeLessThan(page.viewportSize()!.height - 64);
  }
  await buyer.fill("Founder of a seasonal rental business");
  await page.getByRole("button",{ name: "Save section",exact: true }).click();
  const toast = page.locator(".v4-toast");
  await expect(toast).toContainText("saved");
  const feedback = await toast.boundingBox();
  const save = await page.getByRole("button",{ name: "Save section",exact: true }).boundingBox();
  expect(feedback && save).toBeTruthy();
  expect(feedback!.y + feedback!.height <= save!.y || feedback!.y >= save!.y + save!.height || feedback!.x + feedback!.width <= save!.x || feedback!.x >= save!.x + save!.width).toBe(true);
  if (isMobile) {
    await expect(page.locator(".editor-footer .save-state")).toHaveText("Saved",{ useInnerText: true });
    await page.getByRole("navigation",{ name: "Workspace",exact: true }).getByRole("link",{ name: "Dashboard",exact: true }).click();
    await expect(page.getByRole("heading",{ name: "Dashboard",exact: true })).toBeVisible();
    await minimumTouchTarget(page.locator(".v4-chip-button"));
    for (const link of await page.getByRole("navigation",{ name: "Workspace",exact: true }).getByRole("link").all()) await minimumTouchTarget(link);
  }
});
