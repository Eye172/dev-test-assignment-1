import { test, expect, type Page, type Route } from "@playwright/test";
import type { Task, Workspace } from "../src/lib/domain/types";

async function copyDemo(page: Page): Promise<Workspace> {
  const response = await page.request.post("/api/demo");
  expect(response.status()).toBe(201);
  return (await response.json()).data;
}

async function savedWorkspace(page: Page, id: string): Promise<Workspace> {
  const response = await page.request.get(`/api/startups/${id}`);
  expect(response.ok()).toBe(true);
  return (await response.json()).data;
}

async function navigate(page: Page, name: string) {
  await page.getByRole("navigation", { name: "Workspace", exact: true }).getByRole("link", { name, exact: true }).click();
}

async function holdRequests(page: Page, url: string, method: string) {
  const pending: Route[] = [];
  await page.route(url, route => {
    if (route.request().method() !== method) return route.continue();
    pending.push(route);
  });
  return pending;
}

async function fail(route: Route, message: string) {
  await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "SERVICE_UNAVAILABLE", message } }) });
}

test("Back and Forward recover an unsaved strategy draft without saving it", async ({ page }) => {
  const ws = await copyDemo(page); const base = `/startups/${ws.startup.id}`;
  await page.goto(base);
  await navigate(page, "Strategy");
  const draft = "Unsaved buyer: owner of a seasonal equipment rental business";
  await page.getByLabel(/^Buyer type/).fill(draft);
  await page.goBack();
  await expect(page.getByRole("heading", { name: ws.startup.name, exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByLabel(/^Buyer type/)).toHaveValue(draft);
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
  expect((await savedWorkspace(page, ws.startup.id)).sections.find(s => s.key === "icp")!.data).toEqual(ws.sections.find(s => s.key === "icp")!.data);
});

test("Back and Forward recover profile edits without altering the saved profile", async ({ page }) => {
  const ws = await copyDemo(page); const base = `/startups/${ws.startup.id}`;
  await page.goto(`${base}/roadmap`);
  await navigate(page, "Overview");
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  const draft = "Unsaved profile: a flexible pilot for seasonal teams";
  await page.getByLabel(/^Description/).fill(draft);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "30-day roadmap", exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: ws.startup.name, exact: true })).toBeVisible();
  if (!await page.getByLabel(/^Description/).isVisible()) await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await expect(page.getByLabel(/^Description/)).toHaveValue(draft);
  expect((await savedWorkspace(page, ws.startup.id)).startup.description).toBe(ws.startup.description);
});

test("Back and Forward recover an unsaved dashboard arrangement", async ({ page }) => {
  const ws = await copyDemo(page); const base = `/startups/${ws.startup.id}`;
  await page.goto(base);
  await navigate(page, "Dashboard");
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  const order = () => page.locator("[data-plate-id]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-plate-id")));
  const original = await order();
  await page.getByRole("button", { name: "Move Next actions earlier", exact: true }).click();
  await expect.poll(order).not.toEqual(original);
  const draftOrder = await order();
  await page.goBack();
  await expect(page.getByRole("heading", { name: ws.startup.name, exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  if (await page.getByRole("button", { name: "Customize", exact: true }).isVisible()) await page.getByRole("button", { name: "Customize", exact: true }).click();
  await expect.poll(order).toEqual(draftOrder);
  await expect(page.getByRole("button", { name: "Done", exact: true })).toBeVisible();
  expect((await savedWorkspace(page, ws.startup.id)).startup.preferences.dashboardLayout).toEqual(ws.startup.preferences.dashboardLayout);
});

test("a slow failed task week change retains the editor, every field and a visible error", async ({ page }) => {
  const ws = await copyDemo(page); const id = ws.startup.id;
  const task = ws.tasks.find(t => t.week === 1)!;
  await page.goto(`/startups/${id}/roadmap`);
  const card = page.locator(`#task-${task.id}`);
  await card.getByRole("button", { name: `Edit ${task.title}`, exact: true }).click();
  const draft = { title: "Preserve this pilot task", deliverable: "Three written pilot commitments", notes: "The founder can only work on weekends" };
  await card.getByLabel(/^Title/).fill(draft.title);
  await card.getByLabel(/^Deliverable/).fill(draft.deliverable);
  await card.getByLabel(/^Notes/).fill(draft.notes);
  await card.getByLabel(/^Week/).selectOption("3");
  const pending = await holdRequests(page, `**/api/startups/${id}/tasks/${task.id}`, "PATCH");
  await card.getByRole("button", { name: "Save task", exact: true }).click();
  await expect.poll(() => pending.length).toBe(1);
  // Deliberately hold network latency past the card's exit transition: an immediate
  // rejection can mask the bug by rolling back before React unmounts the editor.
  await page.waitForTimeout(350);
  await expect(card.getByRole("button", { name: /Saving/ })).toBeVisible();
  await expect(card.getByLabel(/^Title/)).toHaveValue(draft.title);
  await fail(pending[0], "The pilot task could not be saved");
  await expect(card.getByText(/The pilot task could not be saved/)).toBeVisible();
  await expect(card.getByLabel(/^Title/)).toHaveValue(draft.title);
  await expect(card.getByLabel(/^Deliverable/)).toHaveValue(draft.deliverable);
  await expect(card.getByLabel(/^Notes/)).toHaveValue(draft.notes);
  await expect(card.getByLabel(/^Week/)).toHaveValue("3");
  await expect(card.getByRole("button", { name: "Save task", exact: true })).toBeEnabled();
  expect((await savedWorkspace(page, id)).tasks.find(t => t.id === task.id)).toEqual(task);
});

test("rapid week-panel intents never restore a stale revision over an acknowledged task", async ({ page }) => {
  const ws = await copyDemo(page); const id = ws.startup.id;
  // The first task is the large focus action; exercise a remaining checkbox row.
  const task = ws.tasks.filter(t => t.week === 1)[1]!;
  await page.goto(`/startups/${id}/dashboard`);
  const checkbox = page.getByRole("checkbox", { name: task.title, exact: true });
  const pending = await holdRequests(page, `**/api/startups/${id}/tasks/${task.id}`, "PATCH");
  await checkbox.check();
  await expect.poll(() => pending.length).toBe(1);
  // A pending lock is valid; a queue is valid too. An overlapping stale write must recover.
  const secondIntent = await checkbox.isEnabled();
  if (secondIntent) await checkbox.uncheck();
  const firstResponse = await page.request.fetch(pending[0].request());
  expect(firstResponse.status()).toBe(200);
  let latest = (await firstResponse.json()).data as Task;
  await pending[0].fulfill({ response: firstResponse });
  if (secondIntent) {
    await expect.poll(() => pending.length).toBe(2);
    const secondResponse = await page.request.fetch(pending[1].request());
    expect([200, 409]).toContain(secondResponse.status());
    if (secondResponse.status() === 200) latest = (await secondResponse.json()).data as Task;
    await pending[1].fulfill({ response: secondResponse });
    if (secondResponse.status() === 409) await expect(page.locator(".field-error[role=alert]")).toBeVisible();
  }
  await expect(checkbox).toBeEnabled();
  await expect(checkbox).toBeChecked({ checked: latest.status === "done" });
  const nextCount = pending.length + 1;
  await checkbox.setChecked(latest.status !== "done");
  await expect.poll(() => pending.length).toBe(nextCount);
  const next = pending[nextCount - 1];
  expect(next.request().postDataJSON().expectedRevision).toBe(latest.revision);
  const nextResponse = await page.request.fetch(next.request());
  expect(nextResponse.status()).toBe(200);
  const finalTask = (await nextResponse.json()).data as Task;
  await next.fulfill({ response: nextResponse });
  await expect(checkbox).toBeEnabled();
  await expect(checkbox).toBeChecked({ checked: finalTask.status === "done" });
  expect((await savedWorkspace(page, id)).tasks.find(t => t.id === task.id)).toMatchObject({ status: finalTask.status, revision: finalTask.revision });
});

test("an acknowledged profile closes immediately while its follow-up read is delayed", async ({ page }) => {
  const ws = await copyDemo(page); const id = ws.startup.id;
  await page.goto(`/startups/${id}`);
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page.getByLabel(/^Startup name/).fill("A profile saved before its background read");
  const pending = await holdRequests(page, `**/api/startups/${id}`, "GET");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect.poll(() => pending.length).toBe(1);
  await expect(page.getByLabel(/^Startup name/)).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "A profile saved before its background read", exact: true })).toBeVisible();
  expect((await savedWorkspace(page, id)).startup.name).toBe("A profile saved before its background read");
  await pending[0].continue();
});

test("an acknowledged custom task closes immediately while its follow-up read is delayed", async ({ page }) => {
  const ws = await copyDemo(page); const id = ws.startup.id;
  await page.goto(`/startups/${id}/roadmap`);
  const pending = await holdRequests(page, `**/api/startups/${id}`, "GET");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a custom task", exact: true });
  const title = "Schedule a pilot before the workspace refresh returns";
  await dialog.getByLabel(/^Title/).fill(title);
  await dialog.getByLabel(/^Deliverable/).fill("A confirmed pilot interview");
  await dialog.getByRole("button", { name: "Add task", exact: true }).click();
  await expect.poll(() => pending.length).toBe(1);
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: `Edit ${title}`, exact: true })).toBeVisible();
  expect((await savedWorkspace(page, id)).tasks.some(task => task.title === title)).toBe(true);
  await pending[0].continue();
});

test("a pending Add Task cannot be discarded and a failed save retains its complete draft", async ({ page }) => {
  const ws = await copyDemo(page); const id = ws.startup.id;
  await page.goto(`/startups/${id}/roadmap`);
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a custom task", exact: true });
  const draft = { title: "Arrange a founder pilot", deliverable: "A signed pilot scope", notes: "Contact the mentor after lunch" };
  await dialog.getByLabel(/^Title/).fill(draft.title);
  await dialog.getByLabel(/^Deliverable/).fill(draft.deliverable);
  await dialog.getByLabel(/^Notes/).fill(draft.notes);
  await dialog.getByLabel(/^Week/).selectOption("3");
  const pending = await holdRequests(page, `**/api/startups/${id}/tasks`, "POST");
  await dialog.getByRole("button", { name: "Add task", exact: true }).click();
  await expect.poll(() => pending.length).toBe(1);
  page.on("dialog", confirmation => confirmation.accept());
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await fail(pending[0], "The custom task could not be saved");
  await expect(dialog.getByText(/The custom task could not be saved/)).toBeVisible();
  await expect(dialog.getByLabel(/^Title/)).toHaveValue(draft.title);
  await expect(dialog.getByLabel(/^Deliverable/)).toHaveValue(draft.deliverable);
  await expect(dialog.getByLabel(/^Notes/)).toHaveValue(draft.notes);
  await expect(dialog.getByLabel(/^Week/)).toHaveValue("3");
  await expect(dialog.getByRole("button", { name: "Add task", exact: true })).toBeEnabled();
  expect((await savedWorkspace(page, id)).tasks).toHaveLength(ws.tasks.length);
});

for (const kind of ["notes", "week"] as const) {
  test(`declining dismissal preserves an Add Task draft with only ${kind} changed`, async ({ page }) => {
    const ws = await copyDemo(page);
    await page.goto(`/startups/${ws.startup.id}/roadmap`);
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add a custom task", exact: true });
    if (kind === "notes") await dialog.getByLabel(/^Notes/).fill("Keep this interview scheduling constraint");
    else await dialog.getByLabel(/^Week/).selectOption("4");
    let confirmations = 0;
    page.on("dialog", async confirmation => { confirmations++; await confirmation.dismiss(); });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    expect(confirmations).toBe(1);
    if (kind === "notes") await expect(dialog.getByLabel(/^Notes/)).toHaveValue("Keep this interview scheduling constraint");
    else await expect(dialog.getByLabel(/^Week/)).toHaveValue("4");
  });
}

test("overview and week-panel progress use the same skipped-task rule as the server", async ({ page }) => {
  const ws = await copyDemo(page); const id = ws.startup.id;
  for (const [index, task] of ws.tasks.entries()) {
    const response = await page.request.patch(`/api/startups/${id}/tasks/${task.id}`, {
      data: { expectedRevision: task.revision, patch: { status: index === 0 ? "skipped" : "done" } },
    });
    expect(response.status()).toBe(200);
  }
  const saved = await savedWorkspace(page, id);
  expect(saved.roadmapProgress).toMatchObject({ done: ws.tasks.length - 1, skipped: 1, percentage: 100 });
  await page.goto(`/startups/${id}`);
  await expect(page.getByRole("progressbar", { name: /^Roadmap/ })).toHaveAttribute("aria-valuenow", "100");
  await navigate(page, "Dashboard");
  await expect(page.getByRole("progressbar", { name: /^Roadmap/ })).toHaveAttribute("aria-valuenow", "100");
  await navigate(page, "Roadmap");
  await expect(page.getByRole("region", { name: "Roadmap progress", exact: true })).toContainText("100");
});

test("a recovered task draft can resolve a conflict explicitly and save again", async ({ page }) => {
  const ws = await copyDemo(page); const id = ws.startup.id;
  const task = ws.tasks.find(t => t.week === 1)!;
  await page.goto(`/startups/${id}`);
  await navigate(page,"Roadmap");
  const card = page.locator(`#task-${task.id}`);
  await card.getByRole("button",{ name: `Edit ${task.title}`,exact: true }).click();
  await card.getByLabel(/^Title/).fill("My recovered task draft");
  await page.goBack();
  const external = await page.request.patch(`/api/startups/${id}/tasks/${task.id}`,{ data: { expectedRevision: task.revision,patch: { title: "Saved in another tab" } } });
  expect(external.status()).toBe(200);
  await page.goForward();
  await expect(card.getByLabel(/^Title/)).toHaveValue("My recovered task draft");
  const conflict = page.waitForResponse(r => r.request().method() === "PATCH" && r.url().endsWith(`/tasks/${task.id}`));
  await card.getByRole("button",{ name: "Save task",exact: true }).click();
  expect((await conflict).status()).toBe(409);
  await expect(card.getByRole("button",{ name: "Copy my draft",exact: true })).toBeVisible();
  await expect(card.getByLabel(/^Title/)).toHaveValue("My recovered task draft");
  page.once("dialog",confirmation => confirmation.accept());
  await card.getByRole("button",{ name: "Load latest",exact: true }).click();
  await expect(card.getByLabel(/^Title/)).toHaveValue("Saved in another tab");
  await card.getByLabel(/^Title/).fill("Saved after resolving the conflict");
  await card.getByRole("button",{ name: "Save task",exact: true }).click();
  await expect(card.getByRole("heading")).toHaveText("Saved after resolving the conflict");
  expect((await savedWorkspace(page,id)).tasks.find(t => t.id === task.id)?.title).toBe("Saved after resolving the conflict");
});

test("a recovered strategy draft cannot overwrite a newer external revision and Load latest clears recovery", async ({ page }) => {
  const ws = await copyDemo(page); const id = ws.startup.id;
  const original = ws.sections.find(s => s.key === "icp")!;
  const draft = "My unsaved buyer description"; const external = "Buyer revised by a collaborator";
  await page.goto(`/startups/${id}`); await navigate(page, "Strategy");
  await page.getByLabel(/^Buyer type/).fill(draft);
  await page.goBack();
  await expect(page.getByRole("heading", { name: ws.startup.name, exact: true })).toBeVisible();
  const advanced = await page.request.put(`/api/startups/${id}/strategy/icp`, {
    data: { expectedRevision: original.revision, data: { ...original.data, buyerType: external }, notes: original.notes },
  });
  expect(advanced.status()).toBe(200);
  await page.goForward();
  await expect(page.getByLabel(/^Buyer type/)).toHaveValue(draft);
  const conflict = page.waitForResponse(r => r.request().method() === "PUT" && r.url().endsWith("/strategy/icp"));
  await page.getByRole("button", { name: "Save section", exact: true }).click();
  expect((await conflict).status()).toBe(409);
  await expect(page.getByLabel(/^Buyer type/)).toHaveValue(draft);
  expect((await savedWorkspace(page, id)).sections.find(s => s.key === "icp")!.data).toMatchObject({ buyerType: external });
  page.once("dialog", confirmation => confirmation.accept());
  await page.getByRole("button", { name: "Load latest", exact: true }).click();
  await expect(page.getByLabel(/^Buyer type/)).toHaveValue(external);
  await page.goBack(); await page.goForward();
  await expect(page.getByLabel(/^Buyer type/)).toHaveValue(external);
  await expect(page.getByText("Unsaved changes", { exact: true })).not.toBeVisible();
});

test("a recovered profile draft conflicts safely and Load latest remains current after reopening", async ({ page }) => {
  const ws = await copyDemo(page); const id = ws.startup.id;
  const draft = "My unsaved profile context"; const external = "Profile description revised by a collaborator";
  await page.goto(`/startups/${id}/roadmap`); await navigate(page, "Overview");
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page.getByLabel(/^Description/).fill(draft);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "30-day roadmap", exact: true })).toBeVisible();
  const advanced = await page.request.patch(`/api/startups/${id}`, {
    data: { expectedRevision: ws.startup.revision, patch: { description: external } },
  });
  expect(advanced.status()).toBe(200);
  await page.goForward();
  await expect(page.getByLabel(/^Description/)).toHaveValue(draft);
  const conflict = page.waitForResponse(r => r.request().method() === "PATCH" && r.url().endsWith(`/startups/${id}`));
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  expect((await conflict).status()).toBe(409);
  await expect(page.getByLabel(/^Description/)).toHaveValue(draft);
  expect((await savedWorkspace(page, id)).startup.description).toBe(external);
  page.once("dialog", confirmation => confirmation.accept());
  await page.getByRole("button", { name: "Load latest", exact: true }).click();
  await expect(page.getByLabel(/^Description/)).toHaveValue(external);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "30-day roadmap", exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: ws.startup.name, exact: true })).toBeVisible();
  if (!await page.getByLabel(/^Description/).isVisible()) await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await expect(page.getByLabel(/^Description/)).toHaveValue(external);
});

test("a recovered dashboard arrangement cannot overwrite preferences advanced elsewhere", async ({ page }) => {
  const ws = await copyDemo(page); const id = ws.startup.id;
  await page.goto(`/startups/${id}`); await navigate(page, "Dashboard");
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  await page.getByRole("button", { name: "Move Next actions earlier", exact: true }).click();
  const order = () => page.locator("[data-plate-id]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-plate-id")));
  const draftOrder = await order();
  await page.goBack();
  await expect(page.getByRole("heading", { name: ws.startup.name, exact: true })).toBeVisible();
  const advanced = await page.request.patch(`/api/startups/${id}`, {
    data: { expectedRevision: ws.startup.revision, patch: { preferences: { accent: "blue" } } },
  });
  expect(advanced.status()).toBe(200);
  await page.goForward();
  await expect(page.getByRole("button", { name: "Done", exact: true })).toBeVisible();
  await expect.poll(order).toEqual(draftOrder);
  const conflict = page.waitForResponse(r => r.request().method() === "PATCH" && r.url().endsWith(`/startups/${id}`));
  await page.getByRole("button", { name: "Done", exact: true }).click();
  expect((await conflict).status()).toBe(409);
  await expect(page.getByText(/Couldn't save the layout/)).toBeVisible();
  await expect.poll(order).toEqual(draftOrder);
  expect((await savedWorkspace(page, id)).startup.preferences).toMatchObject({ accent: "blue", dashboardLayout: ws.startup.preferences.dashboardLayout });
});

test("an older delayed workspace read cannot replace a later acknowledged strategy save", async ({ page }) => {
  const ws = await copyDemo(page); const id = ws.startup.id;
  await page.goto(`/startups/${id}/strategy?section=icp`);
  let releaseOlderRead: (() => Promise<void>) | undefined;
  let holdingFirstRead = false;
  await page.route(`**/api/startups/${id}`, async route => {
    if (route.request().method() !== "GET" || holdingFirstRead) return route.continue();
    holdingFirstRead = true;
    // Obtain a real snapshot after save one, but deliver it after save two.
    const response = await route.fetch();
    releaseOlderRead = () => route.fulfill({ response });
  });
  await page.getByLabel(/^Buyer type/).fill("Earlier acknowledged buyer");
  const firstWrite = page.waitForResponse(r => r.request().method() === "PUT" && r.url().endsWith("/strategy/icp"));
  await page.getByRole("button", { name: "Save section", exact: true }).click();
  expect((await firstWrite).status()).toBe(200);
  await expect.poll(() => !!releaseOlderRead).toBe(true);
  await expect(page.getByRole("button", { name: "Save section", exact: true })).toBeEnabled();
  const latest = "Most recent acknowledged buyer";
  await page.getByLabel(/^Buyer type/).fill(latest);
  const secondWrite = page.waitForResponse(r => r.request().method() === "PUT" && r.url().endsWith("/strategy/icp"));
  await page.getByRole("button", { name: "Save section", exact: true }).click();
  expect((await secondWrite).status()).toBe(200);
  await expect(page.getByRole("button", { name: "Save section", exact: true })).toBeEnabled();
  await navigate(page, "Dashboard");
  await expect(page.locator(".decision-list")).toContainText(latest);
  const staleResponse = page.waitForResponse(r => r.request().method() === "GET" && r.url().endsWith(`/api/startups/${id}`));
  await releaseOlderRead!();
  await (await staleResponse).finished();
  // Let the delivered read and its React update complete before assessing the dashboard.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.locator(".decision-list")).toContainText(latest);
  expect((await savedWorkspace(page, id)).sections.find(s => s.key === "icp")!.data).toMatchObject({ buyerType: latest });
});

test("a late acknowledged section save preserves a newer recovered draft across another history round trip", async ({ page }) => {
  const ws = await copyDemo(page); const id = ws.startup.id;
  await page.goto(`/startups/${id}`); await navigate(page, "Strategy");
  const submitted = "Buyer A submitted before leaving the editor";
  const newer = "Buyer B drafted after returning to the editor";
  await page.getByLabel(/^Buyer type/).fill(submitted);
  const pending = await holdRequests(page, `**/api/startups/${id}/strategy/icp`, "PUT");
  await page.getByRole("button", { name: "Save section", exact: true }).click();
  await expect.poll(() => pending.length).toBe(1);
  await page.goBack();
  await expect(page.getByRole("heading", { name: ws.startup.name, exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByLabel(/^Buyer type/)).toHaveValue(submitted);
  await page.getByLabel(/^Buyer type/).fill(newer);
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
  // The real write succeeds only now, after a new editor owns a newer unsaved draft.
  const acknowledged = await page.request.fetch(pending[0].request());
  expect(acknowledged.status()).toBe(200);
  await pending[0].fulfill({ response: acknowledged });
  await expect(page.getByText("Ideal Customer Profile saved", { exact: true })).toBeVisible();
  await expect(page.getByLabel(/^Buyer type/)).toHaveValue(newer);
  await page.goBack();
  await expect(page.getByRole("heading", { name: ws.startup.name, exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByLabel(/^Buyer type/)).toHaveValue(newer);
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
  expect((await savedWorkspace(page, id)).sections.find(s => s.key === "icp")!.data).toMatchObject({ buyerType: submitted });
});

test("a late custom-task creation preserves a different recovered task draft without creating it", async ({ page }) => {
  const ws = await copyDemo(page); const id = ws.startup.id;
  await page.goto(`/startups/${id}`); await navigate(page, "Roadmap");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a custom task", exact: true });
  const submitted = { title: "Submitted mentor interview", deliverable: "One recorded mentor conversation" };
  const newer = { title: "Unsubmitted pilot follow-up", deliverable: "A written pilot decision", notes: "Discuss after the second interview", week: "4" };
  await dialog.getByLabel(/^Title/).fill(submitted.title);
  await dialog.getByLabel(/^Deliverable/).fill(submitted.deliverable);
  const pending = await holdRequests(page, `**/api/startups/${id}/tasks`, "POST");
  await dialog.getByRole("button", { name: "Add task", exact: true }).click();
  await expect.poll(() => pending.length).toBe(1);
  await page.goBack();
  await expect(page.getByRole("heading", { name: ws.startup.name, exact: true })).toBeVisible();
  await page.goForward();
  await expect(dialog.getByLabel(/^Title/)).toHaveValue(submitted.title);
  await dialog.getByLabel(/^Title/).fill(newer.title);
  await dialog.getByLabel(/^Deliverable/).fill(newer.deliverable);
  await dialog.getByLabel(/^Notes/).fill(newer.notes);
  await dialog.getByLabel(/^Week/).selectOption(newer.week);
  const acknowledged = await page.request.fetch(pending[0].request());
  expect(acknowledged.status()).toBe(201);
  await pending[0].fulfill({ response: acknowledged });
  await expect(page.getByText("Custom task added", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel(/^Title/)).toHaveValue(newer.title);
  await page.goBack();
  await expect(page.getByRole("heading", { name: ws.startup.name, exact: true })).toBeVisible();
  await page.goForward();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/^Title/)).toHaveValue(newer.title);
  await expect(dialog.getByLabel(/^Deliverable/)).toHaveValue(newer.deliverable);
  await expect(dialog.getByLabel(/^Notes/)).toHaveValue(newer.notes);
  await expect(dialog.getByLabel(/^Week/)).toHaveValue(newer.week);
  const saved = await savedWorkspace(page, id);
  expect(saved.tasks).toHaveLength(ws.tasks.length + 1);
  expect(saved.tasks.filter(task => task.title === submitted.title)).toHaveLength(1);
  expect(saved.tasks.some(task => task.title === newer.title)).toBe(false);
});
