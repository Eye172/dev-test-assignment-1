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
  await page.locator(".land-actions").first().getByRole("link",{ name: "Create startup",exact: true }).click();
  // Free-form path: the founder writes; rules pick out what they can and ask only for the rest.
  await page.getByRole("button",{ name: /^Free form/ }).click();
  await page.getByLabel("Your startup in your own words").fill("Harbor pilot\nShared delivery coordination for small independent shops in Central Asia. We have an MVP.");
  await page.getByRole("button",{ name: "Continue without AI",exact: true }).click();
  // At most seven questions, and only for what the text did not cover; each screen settles before the next action.
  const confirm = page.getByRole("heading",{ name: "Is this your startup?",exact: true });
  const skip = page.getByRole("button",{ name: "Skip",exact: true });
  for (let i = 0; i < 8; i++) {
    await expect(skip.or(confirm)).toBeVisible();
    if (await confirm.isVisible()) break;
    const question = (await page.locator(".clarify-q").first().textContent())!;
    await skip.click();
    await expect(page.getByRole("heading",{ name: question,exact: true })).toBeHidden();
  }
  await expect(confirm).toBeVisible();
  await expect(page.getByLabel(/^Startup name/)).toHaveValue("Harbor pilot");
  await page.getByLabel(/^Startup name/).fill("");
  await page.getByRole("button",{ name: /Create and launch/ }).click();
  await expect(page.getByText("Some required details need attention.")).toBeVisible();
  await page.getByLabel(/^Startup name/).fill("Harbor pilot — synthetic example");
  await page.getByLabel(/^Short description/).fill("Shared delivery coordination for small independent shops.");
  await page.getByLabel(/^Target country or market/).fill("Central Asia");
  await page.getByLabel(/^Primary customer segment/).fill("Shop owners with a small local delivery operation");
  await page.getByLabel(/^Website \(optional\)/).fill("example.com");
  await page.getByLabel(/^Startup name/).click(); // Website normalization runs on blur.
  await page.getByRole("radio",{ name: "MVP",exact: true }).check();
  await page.getByRole("button",{ name: /Create and launch/ }).click();
  await expect(page.getByRole("heading",{ name: /workspace/ })).toBeVisible();
  await page.getByRole("button",{ name: /See what was prepared|Open workspace now/ }).click();
  await page.waitForURL(/\/startups\/[a-f0-9-]{36}(\?from=onboarding)?$/);
  const id = new URL(page.url()).pathname.split("/").pop()!;
  await expect(page.getByRole("heading",{ name: "Harbor pilot — synthetic example",exact: true })).toBeVisible();
  await expect(page.getByRole("heading",{ name: "Prepared for you",exact: true })).toBeVisible();
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
  await expect(page.getByRole("region",{ name: "Completion",exact: true })).toContainText("100%");
  expect((await savedWorkspace(page,id)).completion).toMatchObject({ percentage: 100,completed: 5 });
  await navigate(page,"Roadmap");
  // Onboarding already generated a first plan from the profile; refreshing it now uses the completed strategy.
  const generated = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith("/roadmap"));
  page.once("dialog",dialog => dialog.accept());
  await page.getByRole("button",{ name: "Refresh plan",exact: true }).click();
  expect((await generated).status()).toBe(200);
  await expect(page.locator(".v4-toast").filter({ hasText: "Plan refreshed" })).toBeVisible();
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
  await page.getByRole("button",{ name: "Share and export",exact: true }).click();
  await page.getByRole("menuitem",{ name: "Export workspace as JSON",exact: true }).click();
  const file = await (await download).path();
  expect(file).toBeTruthy();
  const backup = JSON.parse(await readFile(file!,"utf8"));
  expect(backup.workspace.startup.id).toBe(id);
  expect(backup.workspace.completion.percentage).toBe(100);
  await page.screenshot({ path: test.info().outputPath("completed-roadmap.png"),fullPage: true });
});

test("failed saves retain drafts and conflicts can load the current version", async ({ page }) => {
  // Explicit-save path: autosave (a per-device option) is covered by its own scenario below.
  await page.addInitScript(() => localStorage.setItem("orbit:device:autosave","off"));
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

test("a profile can be revised with personal context and reopened by its shared URL", async ({ page, context }) => {
  const ws = await copyDemo(page); const id = ws.startup.id;
  const profilePath = `/startups/${id}`;
  await page.goto(profilePath);
  await page.getByRole("button",{ name: "Edit profile",exact: true }).click();
  await page.getByLabel(/^Startup name/).fill("Fieldnote — founder's revised pilot");
  await page.getByLabel(/^Target country or market/).fill("Kazakhstan and nearby markets");
  await page.getByLabel(/^Website \(optional\)/).fill("example.com/pilot");
  await page.getByLabel(/^Startup name/).click();
  if (!await page.getByLabel(/^Anything the plan should consider/).isVisible()) await page.getByText("More context (optional)",{ exact: true }).click();
  await page.getByLabel(/^Anything the plan should consider/).fill("One founder; two afternoons available each week.");
  await page.getByRole("button",{ name: "Add field",exact: true }).click();
  const customNames = page.getByRole("textbox",{ name: /^Custom field \d+ name$/ });
  const customValues = page.getByRole("textbox",{ name: /^Custom field \d+ value$/ });
  await customNames.last().fill("Personal success criterion");
  await customValues.last().fill("Four observed conversations before building more");
  const saved = page.waitForResponse(r => r.request().method() === "PATCH" && r.url().endsWith(`/api/startups/${id}`));
  await page.getByRole("button",{ name: "Save profile",exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByRole("button",{ name: "Edit profile",exact: true })).toBeVisible();
  const persisted = (await savedWorkspace(page,id)).startup;
  expect(persisted).toMatchObject({ name: "Fieldnote — founder's revised pilot",targetMarket: "Kazakhstan and nearby markets",websiteUrl: "https://example.com/pilot",context: "One founder; two afternoons available each week." });
  expect(persisted.customFields["Personal success criterion"]).toBe("Four observed conversations before building more");
  const direct = await context.newPage();
  await direct.goto(profilePath);
  await expect(direct.getByRole("heading",{ name: persisted.name,exact: true })).toBeVisible();
  await expect(direct.locator(".v4-facts:visible").getByText(persisted.targetMarket,{ exact: true })).toBeVisible();
  await direct.getByRole("button",{ name: "Edit profile",exact: true }).click();
  await expect(direct.getByLabel(/^Anything the plan should consider/)).toHaveValue(persisted.context);
  await direct.close();
  await page.screenshot({ path: test.info().outputPath("reopened-profile.png"),fullPage: true });
});

test("language, interface version and theme survive a full reload", async ({ page }) => {
  const ws = await copyDemo(page); const id = ws.startup.id;
  await page.goto(`/startups/${id}/dashboard`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.locator(".v4-chip-button").click();
  const display = page.getByRole("dialog", { name: "Display", exact: true });
  await display.getByRole("button", { name: "Русский", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.getByRole("heading", { name: "Дашборд", exact: true })).toBeVisible();
  // A locale change keeps the Display popover open so another preference can
  // be chosen. Changing the interface remounts its header and closes it.
  await page.getByRole("dialog", { name: "Вид", exact: true }).getByRole("button", { name: /Досье/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-ui", "ledger");
  await expect(page.locator(".v4-ws")).toHaveClass(/is-ledger/);
  await page.locator(".v4-chip-button").click();
  await page.getByRole("dialog", { name: "Вид", exact: true }).getByRole("button", { name: "Тёмная", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.locator("html")).toHaveAttribute("data-ui", "ledger");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("navigation", { name: "Рабочее пространство", exact: true }).getByRole("link", { name: "Дашборд", exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("ledger-ru-dark.png"), fullPage: true });
  await page.goto(`/startups/${id}?lang=en&ui=observatory&theme=system`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("data-ui", "observatory");
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

test("autosave writes a pause in typing without moving focus, and stops on a conflict", async ({ page }) => {
  const ws = await copyDemo(page); const id = ws.startup.id;
  await page.goto(`/startups/${id}/strategy?section=pricing`);
  const price = page.getByLabel(/^Initial price assumption/);
  await expect(page.getByRole("switch",{ name: "Autosave" })).toBeChecked();
  const autosaved = page.waitForResponse(r => r.request().method() === "PUT" && r.url().endsWith("/strategy/pricing"));
  await price.fill("$39 per workspace");
  expect((await autosaved).status()).toBe(200);
  await expect(page.getByText(/^Saved ·/)).toBeVisible();
  await expect(price).toBeFocused();
  expect((await savedWorkspace(page,id)).sections.find(s => s.key === "pricing")!.data).toMatchObject({ initialPrice: "$39 per workspace" });
  // A newer external revision turns autosave into an explicit, visible conflict; it never retries over it.
  const latest = (await savedWorkspace(page,id)).sections.find(s => s.key === "pricing")!;
  expect((await page.request.put(`/api/startups/${id}/strategy/pricing`,{ data: { expectedRevision: latest.revision,data: { ...latest.data,initialPrice: "$45 from another tab" } } })).ok()).toBe(true);
  await price.fill("$49 per workspace");
  await expect(page.getByRole("button",{ name: "Load latest",exact: true })).toBeVisible();
  await expect(price).toHaveValue("$49 per workspace");
  expect((await savedWorkspace(page,id)).sections.find(s => s.key === "pricing")!.data).toMatchObject({ initialPrice: "$45 from another tab" });
  // Turning autosave off is remembered on this device.
  await page.getByRole("switch",{ name: "Autosave" }).uncheck();
  await page.reload();
  await expect(page.getByRole("switch",{ name: "Autosave" })).not.toBeChecked();
});

test("command menu jumps to a strategy section from the keyboard", async ({ page }) => {
  const ws = await copyDemo(page);
  await page.goto(`/startups/${ws.startup.id}`);
  await expect(page.getByRole("heading",{ name: ws.startup.name,exact: true })).toBeVisible();
  await page.getByRole("button",{ name: /^Jump to/ }).click();
  const menu = page.getByRole("dialog",{ name: "Command menu",exact: true });
  await expect(menu).toBeVisible();
  await page.keyboard.type("pricing");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/strategy\?section=pricing$/);
  await expect(page.getByLabel(/^Initial price assumption/)).toBeVisible();
});

test("guided brief builds a complete profile from choices and short answers", async ({ page }) => {
  await page.goto("/startups/new");
  await page.getByRole("button",{ name: /^Guided brief/ }).click();
  await page.getByPlaceholder("Fieldnote").fill("Kitabim — synthetic example");
  await page.getByLabel(/^One sentence/).fill("A reading tracker that turns school reading lists into weekly goals.");
  await page.getByRole("button",{ name: "Next",exact: true }).click();
  await page.getByRole("radio",{ name: /People pay/ }).click();
  await page.getByRole("button",{ name: "Next",exact: true }).click();
  await page.getByRole("radio",{ name: /^MVP/ }).click();
  await page.getByRole("button",{ name: "Next",exact: true }).click();
  await page.getByRole("button",{ name: "Kazakhstan",exact: true }).click();
  await page.getByRole("button",{ name: "Next",exact: true }).click();
  await page.getByRole("button",{ name: "Parents",exact: true }).click();
  await page.getByRole("button",{ name: "Next",exact: true }).click();
  await page.getByRole("button",{ name: "Next",exact: true }).click();
  await page.getByRole("button",{ name: "Review profile without AI",exact: true }).click();
  await expect(page.getByLabel(/^Primary customer segment/)).toHaveValue("Parents");
  await expect(page.getByRole("radio",{ name: "B2C",exact: true })).toBeChecked();
  await page.getByRole("button",{ name: /Create and launch/ }).click();
  await page.getByRole("button",{ name: /See what was prepared|Open workspace now/ }).click();
  await expect(page.getByRole("heading",{ name: "Kitabim — synthetic example",exact: true })).toBeVisible();
});
