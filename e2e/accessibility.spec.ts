import { test,expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
import type { Preferences, Startup,Workspace } from "../src/lib/domain/types";

// Automated checks complement the keyboard, reduced-motion and rendered reviews.
// No excluded elements or suppressed rules: failures must be fixed or investigated.
test("six routes and interactive editing states pass automated accessibility checks", async ({ page },testInfo) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const response = await page.request.post("/api/demo");
  expect(response.status()).toBe(201);
  const ws = (await response.json()).data as Workspace;
  const base = `/startups/${ws.startup.id}`;
  const failures: { state: string;rule: string;impact: string | null | undefined;nodes: unknown[] }[] = [];
  async function audit(state: string) {
    await page.evaluate(() => document.fonts.ready);
    const result = await new AxeBuilder({ page }).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]).analyze();
    await writeFile(testInfo.outputPath(`accessibility-${state}.json`),JSON.stringify(result.violations,null,2));
    await testInfo.attach(`accessibility-${state}`,{ body: JSON.stringify(result),contentType: "application/json" });
    failures.push(...result.violations.map(v => ({ state,rule: v.id,impact: v.impact,nodes: v.nodes.map(n => ({ target: n.target,reason: n.failureSummary })) })));
  }
  for (const [name,path] of [["welcome","/"],["onboarding","/startups/new"],["overview",base],["strategy",`${base}/strategy?section=icp`],["dashboard",`${base}/dashboard`],["roadmap",`${base}/roadmap`]]) {
    await page.goto(path);
    await expect(page.getByRole("heading",{ level: 1 })).toBeVisible();
    await audit(name);
  }
  expect((await page.request.patch(`/api/startups/${ws.startup.id}/tasks/${ws.tasks[0].id}`,{ data: { expectedRevision: ws.tasks[0].revision,patch: { status: "skipped" } } })).ok()).toBe(true);
  await page.reload();
  await audit("skipped-task");
  await page.getByRole("button",{ name: "Add task",exact: true }).click();
  await expect(page.getByRole("dialog",{ name: "Add a custom task",exact: true })).toBeVisible();
  await audit("new-task-dialog");
  await page.getByRole("dialog").getByRole("button",{ name: "Close",exact: true }).click();
  await page.goto(base);
  await page.getByRole("button",{ name: "Edit profile",exact: true }).click();
  await expect(page.getByLabel(/^Startup name/)).toBeVisible();
  await audit("profile-editor");
  await page.goto(`${base}/strategy?section=channels`);
  await expect(page.getByLabel(/^First acquisition experiment/)).toBeVisible();
  await audit("channels-editor");
  await page.goto(`${base}/strategy?section=assumptions`);
  await expect(page.getByLabel(/^What do you believe is true/).first()).toBeVisible();
  await audit("assumptions-editor");
  await page.goto(`${base}/dashboard`);
  await page.getByRole("button",{ name: "Customize",exact: true }).click();
  await expect(page.getByRole("button",{ name: "Done",exact: true })).toBeVisible();
  await audit("customization");
  await page.getByRole("button",{ name: "Cancel",exact: true }).click();
  await page.getByRole("button",{ name: "Share and export",exact: true }).click();
  await expect(page.getByRole("menuitem",{ name: "Export workspace as JSON",exact: true })).toBeVisible();
  await audit("share-menu");
  await page.keyboard.press("Escape");
  await page.getByRole("button",{ name: "Workspace preferences",exact: true }).click();
  await expect(page.getByRole("dialog",{ name: "Workspace preferences",exact: true })).toBeVisible();
  await audit("preferences-dialog");
  await page.getByRole("dialog").getByRole("button",{ name: "Close",exact: true }).click();
  const latest = await page.request.get(`/api/startups/${ws.startup.id}`);
  let current = (await latest.json()).data.startup as Startup;
  for (const theme of ["light","dark","system"] as const) {
    for (const accent of ["green","lime","blue"] as const) {
      if (theme === "system") await page.emulateMedia({ colorScheme: "light",reducedMotion: "reduce" });
      const changed = await page.request.patch(`/api/startups/${ws.startup.id}`,{ data: { expectedRevision: current.revision,patch: { preferences: { theme,accent } satisfies Partial<Preferences> } } });
      expect(changed.ok()).toBe(true);
      current = (await changed.json()).data as Startup;
      await page.reload();
      if (theme === "system") await expect(page.locator("html")).toHaveAttribute("data-theme-system","");
      else await expect(page.locator("html")).toHaveAttribute("data-theme",theme);
      await audit(`${theme}-${accent}-dashboard`);
    }
  }
  expect(failures.map(v => ({ state: v.state,rule: v.rule,impact: v.impact,nodes: v.nodes.length })),"Automated accessibility violations by rendered state; complete details are attached").toEqual([]);
});
