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
