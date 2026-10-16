import { test, expect, type Page } from "@playwright/test";
import type { Task, Workspace } from "../src/lib/domain/types";

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
const nav = (page: Page, name: string) => page.getByRole("navigation",{ name: "Workspace",exact: true }).getByRole("link",{ name,exact: true }).click();

test("typing in the strategy editor does not loop or remount the field", async ({ page }) => {
  const ws = await copyDemo(page);
  await page.goto(`/startups/${ws.startup.id}/strategy?section=pricing`);
  const price = page.getByLabel(/^Initial price assumption/);
  await price.fill("");
  await price.pressSequentially("$29 per seat",{ delay: 15 });
  await expect(price).toHaveValue("$29 per seat");
});

test("browser Back/Forward offers the unsaved strategy draft from this tab", async ({ page }) => {
  const ws = await copyDemo(page); const id = ws.startup.id;
  await page.goto(`/startups/${id}`);
  await nav(page,"Strategy");
  await page.getByRole("button",{ name: /^Ideal Customer Profile/ }).click();
  const buyer = page.getByLabel(/^Buyer type/);
  await buyer.fill("Draft that survives history navigation");
  await page.goBack();
  await expect(page).not.toHaveURL(/section=icp/);
  await page.goForward();
  const offer = page.getByRole("region",{ name: "Unsaved draft found",exact: true });
  await expect(offer).toBeVisible();
  await offer.getByRole("button",{ name: "Restore draft",exact: true }).click();
  await expect(page.getByLabel(/^Buyer type/)).toHaveValue("Draft that survives history navigation");
  // The draft was never saved; the server still has the original value.
  expect((await saved(page,id)).sections.find(s => s.key === "icp")!.data).not.toMatchObject({ buyerType: "Draft that survives history navigation" });
  await page.getByRole("button",{ name: "Save section",exact: true }).click();
  await expect(page.getByText(/^Saved ·/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region",{ name: "Unsaved draft found",exact: true })).toHaveCount(0);
});

test("a pending custom task cannot be dismissed and keeps its draft until acknowledged", async ({ page }) => {
  const ws = await copyDemo(page,true); const id = ws.startup.id;
  await page.goto(`/startups/${id}/roadmap`);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/startups/${id}/tasks`,async route => { await gate; await route.continue(); });
  await page.getByRole("button",{ name: "Add task",exact: true }).click();
  const dialog = page.getByRole("dialog",{ name: "Add a custom task",exact: true });
  await dialog.getByLabel(/^Title/).fill("Pending task must not be discarded");
  await dialog.getByLabel(/^Deliverable/).fill("One confirmed write");
  await dialog.getByLabel(/^Week/).selectOption("2");
  await dialog.getByRole("button",{ name: "Add task",exact: true }).click();
  await expect(dialog.getByRole("button",{ name: "Close",exact: true })).toBeDisabled();
  page.on("dialog",confirmation => confirmation.accept());
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/^Title/)).toHaveValue("Pending task must not be discarded");
  release();
  await expect(dialog).not.toBeVisible();
  const created = (await saved(page,id)).tasks.filter(t => t.title === "Pending task must not be discarded");
  expect(created).toHaveLength(1);
  expect(created[0].week).toBe(2);
});

test("notes and week alone make a custom task draft dirty", async ({ page }) => {
  const ws = await copyDemo(page,true);
  await page.goto(`/startups/${ws.startup.id}/roadmap`);
  await page.getByRole("button",{ name: "Add task",exact: true }).click();
  const dialog = page.getByRole("dialog",{ name: "Add a custom task",exact: true });
  await dialog.getByLabel(/^Week/).selectOption("3");
  await dialog.getByLabel(/^Notes/).fill("Only a note so far");
  let asked = false;
  page.once("dialog",confirmation => { asked = true; void confirmation.dismiss(); });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  expect(asked).toBe(true);
});

test("a failed task edit keeps the editor and draft, even when the week changes", async ({ page }) => {
  const ws = await copyDemo(page,true); const id = ws.startup.id;
  const task = ws.tasks.find(t => !t.archived && t.week === 1)!;
  await page.goto(`/startups/${id}/roadmap`);
  const card = page.locator(`#task-${task.id}`);
  await card.getByRole("button",{ name: /^Edit / }).click();
  await card.getByLabel(/^Title/).fill("Edited while offline");
  await card.getByLabel(/^Week/).selectOption("4");
  await page.route(`**/api/startups/${id}/tasks/${task.id}`,route => route.abort("failed"));
  await card.getByRole("button",{ name: "Save task",exact: true }).click();
  await expect(card.getByRole("alert")).toContainText("Your edits are still here");
  await expect(card.getByLabel(/^Title/)).toHaveValue("Edited while offline");
  await expect(card.getByLabel(/^Week/)).toHaveValue("4");
  await expect(page.locator("section[aria-labelledby='week-1']").locator(`#task-${task.id}`)).toHaveCount(1);
  await page.unroute(`**/api/startups/${id}/tasks/${task.id}`);
  await card.getByRole("button",{ name: "Save task",exact: true }).click();
  await expect(page.locator("section[aria-labelledby='week-4']").locator(`#task-${task.id}`)).toBeVisible();
  expect((await saved(page,id)).tasks.find(t => t.id === task.id)).toMatchObject({ title: "Edited while offline",week: 4 });
});

test("every progress display uses done ÷ actionable with skipped shown separately", async ({ page }) => {
  const ws = await copyDemo(page,true); const id = ws.startup.id;
  const active = ws.tasks.filter(t => !t.archived);
  const patch = async (t: Task, status: Task["status"]) => expect((await page.request.patch(`/api/startups/${id}/tasks/${t.id}`,{ data: { expectedRevision: t.revision,patch: { status } } })).ok()).toBe(true);
  await patch(active[0],"done"); await patch(active[1],"skipped");
  const p = (await saved(page,id)).roadmapProgress;
  expect(p.percentage).toBe(Math.round(1 / (p.total - 1) * 100));
  const label = `1 of ${p.total - 1} done · ${p.percentage}%`;
  await page.goto(`/startups/${id}/dashboard`);
  await expect(page.getByText(label)).toBeVisible();
  await expect(page.getByText("1 skipped, not counted")).toBeVisible();
  await page.goto(`/startups/${id}/roadmap`);
  await expect(page.getByRole("region",{ name: "Roadmap progress",exact: true })).toContainText(`${p.percentage}%`);
  await page.goto(`/startups/${id}`);
  await expect(page.getByText(label)).toBeVisible();
});

test("overlapping status changes on one task are blocked while the first is pending", async ({ page }) => {
  const ws = await copyDemo(page,true); const id = ws.startup.id;
  const task = ws.tasks.find(t => !t.archived && t.week === 1 && t.status === "todo")!;
  await page.goto(`/startups/${id}/roadmap`);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/startups/${id}/tasks/${task.id}`,async route => { await gate; await route.continue(); });
  const status = page.locator(`#task-${task.id}`).getByRole("combobox");
  await status.selectOption("in_progress");
  await expect(status).toBeDisabled();
  release();
  await expect(status).toBeEnabled();
  await status.selectOption("done");
  await expect.poll(async () => (await saved(page,id)).tasks.find(t => t.id === task.id)?.status).toBe("done");
});

test("customize mode makes plate content inert", async ({ page, isMobile }) => {
  test.skip(isMobile,"Same behavior on phones; covered once.");
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
