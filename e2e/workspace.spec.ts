import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { Workspace } from "../src/lib/domain/types";

const pageErrors = new WeakMap<Page,string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = []; pageErrors.set(page,errors);
  page.on("pageerror",error => errors.push(error.message));
});
test.afterEach(({ page }) => { expect(pageErrors.get(page),"Browser JavaScript and hydration errors").toEqual([]); });

async function copyDemo(page: Page) {
  const response = await page.request.post("/api/demo");
  expect(response.status()).toBe(201);
  return (await response.json()).data as Workspace;
}
async function savedWorkspace(page: Page, id: string) {
  const response = await page.request.get(`/api/startups/${id}`);
  expect(response.ok()).toBe(true);
  return (await response.json()).data as Workspace;
}
async function saveSection(page: Page, key: string) {
  const saved = page.waitForResponse(r => r.request().method() === "PUT" && r.url().endsWith(`/strategy/${key}`));
  await page.getByRole("button",{ name: "Save section",exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByText(/^Saved ·/)).toBeVisible();
}
async function navigate(page: Page, name: string) {
  await page.getByRole("navigation",{ name: "Workspace",exact: true }).getByRole("link",{ name,exact: true }).click();
}

test("founder completes the six-screen flow with real persistence and an exported backup", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link",{ name: "Create startup",exact: true }).click();
  await page.getByRole("button",{ name: "Create startup",exact: true }).click();
  await expect(page.getByText("Some required details need attention.")).toBeVisible();
  await page.getByLabel(/^Startup name/).fill("Harbor pilot — synthetic example");
  await page.getByLabel(/^Description/).fill("Shared delivery coordination for small independent shops.");
  await page.getByLabel(/^Target country or market/).fill("Central Asia");
  await page.getByLabel(/^Primary customer segment/).fill("Shop owners with a small local delivery operation");
  await page.getByLabel(/^Website \(optional\)/).fill("example.com");
  await page.getByLabel(/^Startup name/).click(); // Website normalization runs on blur.
  await page.getByRole("radio",{ name: "MVP",exact: true }).check();
  await page.getByRole("button",{ name: "Create startup",exact: true }).click();
  await page.waitForURL(/\/startups\/[a-f0-9-]{36}$/);
  const id = new URL(page.url()).pathname.split("/").pop()!;
  await expect(page.getByRole("heading",{ name: "Harbor pilot — synthetic example",exact: true })).toBeVisible();
  await navigate(page,"Strategy");
  await page.getByLabel(/^Buyer type/).fill("Independent shop owner");
  await saveSection(page,"icp");
  await page.reload();
  await expect(page.getByLabel(/^Buyer type/)).toHaveValue("Independent shop owner");
  expect((await savedWorkspace(page,id)).completion.percentage).toBe(0);
  await page.getByLabel(/^Industry or demographics/).fill("Independent retail, two to ten staff");
  await page.getByLabel(/^Primary pain point/).fill("Delivery information is scattered across messages");
  await page.getByLabel(/^Buying trigger/).fill("Repeated missed deliveries");
  await saveSection(page,"icp");
  await page.getByRole("button",{ name: /^Value Proposition/ }).click();
  await page.getByLabel(/^Customer problem/).fill("Staff waste time coordinating delivery updates");
  await page.getByLabel(/^Promised outcome/).fill("A clear shared delivery queue");
  await page.getByLabel(/^Differentiation/).fill("Designed for a small shop rather than a delivery fleet");
  await page.getByLabel(/^Proof or assumptions/).fill("Untested assumption; no payment evidence yet");
  await saveSection(page,"value");
  await page.getByRole("button",{ name: /^Acquisition Channels/ }).click();
  await page.getByLabel(/^Channel/).first().fill("Local merchant community");
  await page.getByLabel(/^Why this channel reaches/).first().fill("Introductions reach shop owners directly");
  await page.getByLabel(/^First acquisition experiment/).fill("Invite ten owners to a conversation; target four interviews");
  await saveSection(page,"channels");
  await page.getByRole("button",{ name: /^Pricing & Revenue/ }).click();
  await page.getByLabel(/^Pricing model/).fill("Paid pilot followed by subscription");
  await page.getByLabel(/^Initial price assumption/).fill("$10–20 for a two-week pilot");
  await page.getByLabel(/^Payment unit/).fill("shop");
  await page.getByLabel(/^Pricing rationale/).fill("Test an actual small commitment first");
  await saveSection(page,"pricing");
  await page.getByRole("button",{ name: /^Market Assumptions/ }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByLabel(/^What do you believe is true/).nth(i).fill([
      "Two of four owners will commit to a paid pilot",
      "An owner can record a delivery in one minute",
      "The merchant community can introduce four relevant owners",
    ][i]);
    await page.getByLabel(/^How will you test it/).nth(i).fill([
      "Offer the pilot and record commitments",
      "Observe four owners completing the task",
      "Ask the coordinator for introductions",
    ][i]);
  }
  await saveSection(page,"assumptions");
  await navigate(page,"Dashboard");
  await expect(page.getByRole("region",{ name: "Summary",exact: true })).toContainText("100%");
  expect((await savedWorkspace(page,id)).completion).toMatchObject({ percentage: 100,completed: 5 });
  await navigate(page,"Roadmap");
  const generated = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith("/roadmap"));
  await page.getByRole("button",{ name: "Generate plan",exact: true }).click();
  expect((await generated).status()).toBe(200);
  const status = page.getByLabel(/^Status for /).first();
  const changed = page.waitForResponse(r => r.request().method() === "PATCH" && /\/tasks\//.test(r.url()));
  await status.selectOption("done");
  expect((await changed).status()).toBe(200);
  await expect(status).toHaveValue("done");
  const plan = await savedWorkspace(page,id);
  expect(plan.tasks.filter(t => !t.archived).length).toBeGreaterThanOrEqual(6);
  expect(plan.tasks.filter(t => !t.archived).length).toBeLessThanOrEqual(10);
  const completedId = plan.tasks.find(t => t.status === "done")!.id;
  page.once("dialog",dialog => dialog.accept());
  const refreshed = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith("/roadmap"));
  await page.getByRole("button",{ name: "Refresh plan",exact: true }).click();
  expect((await refreshed).status()).toBe(200);
  expect((await savedWorkspace(page,id)).tasks.find(t => t.id === completedId)?.status).toBe("done");
  await page.reload();
  await expect(page.locator(`#task-${completedId}`).getByRole("combobox")).toHaveValue("done");
  const download = page.waitForEvent("download");
  await page.getByRole("link",{ name: "Export workspace as JSON",exact: true }).click();
  const file = await (await download).path();
  expect(file).toBeTruthy();
  const backup = JSON.parse(await readFile(file!,"utf8"));
  expect(backup.workspace.startup.id).toBe(id);
  expect(backup.workspace.completion.percentage).toBe(100);
  await page.screenshot({ path: test.info().outputPath("completed-roadmap.png"),fullPage: true });
});

test("failed saves retain drafts and conflicts can load the current version", async ({ page }) => {
  const ws = await copyDemo(page); const id = ws.startup.id;
  await page.goto(`/startups/${id}/strategy?section=icp`);
  const buyer = page.getByLabel(/^Buyer type/);
  await buyer.fill("My unsaved interview focus");
  await page.route(`**/api/startups/${id}/strategy/icp`,route => route.abort("failed"));
  await page.getByRole("button",{ name: "Save section",exact: true }).click();
  await expect(page.getByRole("button",{ name: "Retry",exact: true })).toBeVisible();
  await expect(buyer).toHaveValue("My unsaved interview focus");
  await page.unroute(`**/api/startups/${id}/strategy/icp`);
  await page.getByRole("button",{ name: "Retry",exact: true }).click();
  await expect(page.getByText(/^Saved ·/)).toBeVisible();
  const latest = await savedWorkspace(page,id);
  const section = latest.sections.find(s => s.key === "icp")!;
  const external = { ...section.data,buyerType: "Saved from another tab" };
  expect((await page.request.put(`/api/startups/${id}/strategy/icp`,{ data: { expectedRevision: section.revision,data: external } })).ok()).toBe(true);
  await buyer.fill("My competing draft remains available");
  await page.getByRole("button",{ name: "Save section",exact: true }).click();
  await expect(page.getByRole("button",{ name: "Load latest",exact: true })).toBeVisible();
  await expect(buyer).toHaveValue("My competing draft remains available");
  page.once("dialog",dialog => dialog.accept());
  await page.getByRole("button",{ name: "Load latest",exact: true }).click();
  await expect(buyer).toHaveValue("Saved from another tab");
  await buyer.fill("New draft after resolving conflict");
  await saveSection(page,"icp");
});

test("layout changes and appearance preferences survive a full reload", async ({ page, isMobile }) => {
  const ws = await copyDemo(page); const id = ws.startup.id;
  await page.goto(`/startups/${id}/dashboard`);
  await page.getByRole("button",{ name: "Workspace preferences",exact: true }).click();
  const preferences = page.getByRole("dialog",{ name: "Workspace preferences",exact: true });
  for (const value of ["light","compact","reduced"]) {
    const saved = page.waitForResponse(r => r.request().method() === "PATCH" && r.url().endsWith(`/api/startups/${id}`));
    const radio = preferences.getByRole("radio",{ name: value,exact: true });
    await radio.click();
    expect((await saved).status()).toBe(200);
    await expect(radio).toBeChecked();
  }
  await preferences.getByRole("button",{ name: "Close",exact: true }).click();
  await page.getByRole("button",{ name: "Customize",exact: true }).click();
  const first = await page.locator("[data-plate-id]").first().getAttribute("data-plate-id");
  const later = page.getByRole("button",{ name: "Move Strategy readout later",exact: true });
  if (await later.isEnabled()) await later.click();
  else await page.getByRole("button",{ name: "Move Strategy readout earlier",exact: true }).click();
  if (!isMobile) await page.getByRole("button",{ name: "Strategy readout: Half",exact: true }).click();
  await page.getByRole("button",{ name: "Hide Profile snapshot",exact: true }).click();
  const saved = page.waitForResponse(r => r.request().method() === "PATCH" && r.url().endsWith(`/api/startups/${id}`));
  await page.getByRole("button",{ name: "Done",exact: true }).click();
  expect((await saved).status()).toBe(200);
  const layout = (await savedWorkspace(page,id)).startup.preferences.dashboardLayout;
  expect(layout).not.toBeNull();
  expect(layout!.plates.find(p => p.id === "profile")?.hidden).toBe(true);
  if (!isMobile) expect(layout!.plates.find(p => p.id === "readout")?.size).toBe("M");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme","light");
  await expect(page.locator("html")).toHaveAttribute("data-density","compact");
  await expect(page.locator("html")).toHaveAttribute("data-motion","reduced");
  expect(await page.locator("[data-plate-id]").first().getAttribute("data-plate-id")).not.toBe(first);
  await expect(page.getByRole("heading",{ name: "Profile snapshot",exact: true })).not.toBeVisible();
  await page.screenshot({ path: test.info().outputPath("personalized-dashboard.png"),fullPage: true });
  await page.getByRole("button",{ name: "Customize",exact: true }).click();
  page.once("dialog",confirmation => confirmation.accept());
  await page.getByRole("button",{ name: "Reset",exact: true }).click();
  const reset = page.waitForResponse(r => r.request().method() === "PATCH" && r.url().endsWith(`/api/startups/${id}`));
  await page.getByRole("button",{ name: "Done",exact: true }).click();
  expect((await reset).status()).toBe(200);
  expect((await savedWorkspace(page,id)).startup.preferences.dashboardLayout).toBeNull();
  await expect(page.getByRole("heading",{ name: "Profile snapshot",exact: true })).toBeVisible();
});

test("custom tasks can be edited, archived and restored without losing their content", async ({ page }) => {
  const ws = await copyDemo(page); const id = ws.startup.id;
  await page.goto(`/startups/${id}/roadmap`);
  await page.getByRole("button",{ name: "Add task",exact: true }).click();
  const dialog = page.getByRole("dialog",{ name: "Add a custom task",exact: true });
  await dialog.getByLabel(/^Title/).fill("Discuss the pilot with a mentor");
  await dialog.getByLabel(/^Deliverable/).fill("One written recommendation");
  await dialog.getByLabel(/^Week/).selectOption("3");
  await dialog.getByRole("button",{ name: "Add task",exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const created = (await savedWorkspace(page,id)).tasks.find(t => t.title === "Discuss the pilot with a mentor")!;
  expect(created.source).toBe("custom");
  const card = page.locator(`#task-${created.id}`);
  await card.getByRole("button",{ name: /^Edit / }).click();
  await card.getByLabel(/^Title/).fill("Discuss the revised pilot with a mentor");
  await card.getByLabel(/^Notes \(optional\)/).fill("Keep this founder context");
  await card.getByRole("button",{ name: "Save task",exact: true }).click();
  await expect(card.getByRole("heading")).toHaveText("Discuss the revised pilot with a mentor");
  await card.getByRole("button",{ name: /^Archive / }).click();
  await page.getByText(/^Archived \(1\)$/).click();
  const archived = page.getByRole("listitem").filter({ hasText: "Discuss the revised pilot with a mentor" });
  await archived.getByRole("button",{ name: "Restore",exact: true }).click();
  await expect(card.getByRole("heading")).toBeVisible();
  await page.reload();
  const saved = (await savedWorkspace(page,id)).tasks.find(t => t.id === created.id)!;
  expect(saved).toMatchObject({ archived: false,week: 3,notes: "Keep this founder context",title: "Discuss the revised pilot with a mentor" });
});

test("declining Escape discard keeps a custom task dialog and its draft open", async ({ page }) => {
  const ws = await copyDemo(page);
  await page.goto(`/startups/${ws.startup.id}/roadmap`);
  await page.getByRole("button",{ name: "Add task",exact: true }).click();
  const dialog = page.getByRole("dialog",{ name: "Add a custom task",exact: true });
  await dialog.getByLabel(/^Title/).fill("Keep my unfinished task");
  page.on("dialog",confirmation => confirmation.dismiss());
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/^Title/)).toHaveValue("Keep my unfinished task");
});

test("keyboard navigation protects drafts and reduced motion keeps the interface usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const ws = await copyDemo(page); const id = ws.startup.id;
  await page.goto(`/startups/${id}/strategy?section=icp`);
  await page.getByLabel(/^Buyer type/).fill("A draft that should stay here");
  await page.getByRole("heading",{ name: "Strategy",exact: true }).focus();
  page.once("dialog",confirmation => confirmation.dismiss());
  await page.keyboard.press("g"); await page.keyboard.press("r");
  await expect(page).toHaveURL(/\/strategy\?section=icp$/);
  await expect(page.getByLabel(/^Buyer type/)).toHaveValue("A draft that should stay here");
  page.once("dialog",confirmation => confirmation.dismiss());
  await navigate(page,"Dashboard");
  await expect(page).toHaveURL(/\/strategy\?section=icp$/);
  await saveSection(page,"icp");
  await navigate(page,"Dashboard");
  await expect(page.getByRole("heading",{ name: "Dashboard",exact: true })).toBeVisible();
  const widths = await page.evaluate(() => ({ viewport: window.innerWidth,document: document.documentElement.scrollWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
});

test("pointer dragging and keyboard cancellation keep a predictable panel order", async ({ page, isMobile }) => {
  test.skip(isMobile,"Phones use the already-tested explicit move buttons.");
  const ws = await copyDemo(page); const id = ws.startup.id;
  await page.goto(`/startups/${id}/dashboard`);
  await page.getByRole("button",{ name: "Customize",exact: true }).click();
  const order = () => page.locator("[data-plate-id]").evaluateAll(nodes => nodes.map(n => n.getAttribute("data-plate-id")));
  const initial = await order();
  const handle = page.getByRole("button",{ name: /^Move Strategy readout, position/ });
  await handle.focus(); await page.keyboard.press("Space"); await page.keyboard.press("ArrowDown");
  await expect.poll(order).not.toEqual(initial);
  await page.keyboard.press("Escape");
  await expect.poll(order).toEqual(initial);
  // Actual pointer movement, rather than invoking the reorder callback.
  await handle.hover();
  const from = await handle.boundingBox();
  const to = await page.locator('[data-plate-id="next"]').boundingBox();
  expect(from).not.toBeNull(); expect(to).not.toBeNull();
  await page.mouse.move(from!.x + from!.width/2,from!.y + from!.height/2);
  await page.mouse.down();
  await page.mouse.move(to!.x + to!.width/2,to!.y + Math.min(to!.height/2,100),{ steps: 12 });
  await page.mouse.up();
  await expect.poll(order).not.toEqual(initial);
  const moved = await order();
  await page.getByRole("button",{ name: "Done",exact: true }).click();
  await expect(page.getByRole("button",{ name: "Customize",exact: true })).toBeVisible();
  await page.reload();
  await expect.poll(order).toEqual(moved);
});
