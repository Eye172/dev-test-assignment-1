import { test, expect, type Page } from "@playwright/test";
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
async function saved(page: Page, id: string) {
  return (await (await page.request.get(`/api/startups/${id}`)).json()).data as Workspace;
}
test("typing in the strategy editor does not loop or remount the field", async ({ page }) => {
  const ws = await copyDemo(page);
  await page.goto(`/startups/${ws.startup.id}/strategy?section=pricing`);
  const price = page.getByLabel(/^Initial price assumption/);
  await price.fill("");
  await price.pressSequentially("$29 per seat",{ delay: 15 });
  await expect(price).toHaveValue("$29 per seat");
});

test("customize mode makes plate content inert", async ({ page }) => {
  const ws = await copyDemo(page,true);
  await page.goto(`/startups/${ws.startup.id}/dashboard`);
  await page.getByRole("button",{ name: "Customize",exact: true }).click();
  const markDone = page.locator("button",{ hasText: "Mark done" });
  expect(await markDone.evaluate(el => el.closest("[inert]") !== null)).toBe(true);
  await markDone.click({ force: true });
  expect((await saved(page,ws.startup.id)).roadmapProgress.done).toBe(ws.roadmapProgress.done);
  await page.getByRole("button",{ name: "Cancel",exact: true }).click();
  await expect(page.getByRole("button",{ name: "Mark done",exact: true })).toBeVisible();
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
  await trigger.click(); await page.keyboard.press("Tab");
  await expect(page.getByRole("button",{ name: "Workspace preferences",exact: true })).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded","false");
});

test("strategy feedback and phone customization leave their controls usable", async ({ page,isMobile }) => {
  const ws = await copyDemo(page);
  await page.goto(`/startups/${ws.startup.id}/strategy?section=icp`);
  const buyer = page.getByLabel(/^Buyer type/);
  if (isMobile) {
    const field = await buyer.boundingBox();
    expect(field!.y + field!.height).toBeLessThan(page.viewportSize()!.height - 64);
  }
  await buyer.fill("Founder of a seasonal rental business");
  await page.getByRole("button",{ name: "Save section",exact: true }).click();
  const toast = page.locator(".toast");
  await expect(toast).toContainText("saved");
  const feedback = await toast.boundingBox();
  const save = await page.getByRole("button",{ name: "Save section",exact: true }).boundingBox();
  expect(feedback && save).toBeTruthy();
  expect(feedback!.y + feedback!.height <= save!.y || feedback!.y >= save!.y + save!.height || feedback!.x + feedback!.width <= save!.x || feedback!.x >= save!.x + save!.width).toBe(true);
  if (isMobile) {
    await expect(page.locator(".editor-footer .save-state")).toHaveText("Saved");
    await page.getByRole("navigation",{ name: "Workspace",exact: true }).getByRole("link",{ name: "Dashboard",exact: true }).click();
    await page.getByRole("button",{ name: "Customize",exact: true }).click();
    const toolbar = page.locator(".plate-toolbar").first();
    for (const button of await toolbar.getByRole("button").all()) {
      if (!await button.isVisible()) continue;
      const box = await button.boundingBox(); expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    expect((await page.locator(".customize-bar").boundingBox())!.height).toBeLessThan(104);
    await expect(page.getByText("Move with arrows. Hide what you don’t need.",{ exact: true })).toBeVisible();
  }
});
