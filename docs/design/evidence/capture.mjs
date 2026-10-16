// Reproducible design evidence: screenshots of every screen (desktop + phone), the two dashboard
// compositions on identical data, and screen recordings of the main interactions.
// Usage: node docs/design/evidence/capture.mjs [baseUrl] [--only=shots|video]
// Writes into docs/design/evidence/. Uses a fresh synthetic demo copy; never touches other workspaces.
import { chromium } from "@playwright/test";
import { mkdir, rename, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const base = (process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "http://127.0.0.1:3000").replace(/\/$/, "");
const only = process.argv.find(a => a.startsWith("--only="))?.split("=")[1];
const out = (name) => path.join(here, name);
const desktop = { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 };
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

// The layout that shipped in PR #5: every plate visible, readout first.
const compositionA = { version: 1, plates: [
  { id: "readout", size: "L", hidden: false }, { id: "next", size: "S", hidden: false }, { id: "decisions", size: "XL", hidden: false },
  { id: "gaps", size: "M", hidden: false }, { id: "week", size: "M", hidden: false }, { id: "risks", size: "M", hidden: false },
  { id: "channels", size: "S", hidden: false }, { id: "profile", size: "S", hidden: false },
] };

async function api(ctx, method, url, data) {
  const res = await ctx.request.fetch(`${base}${url}`, { method, data, headers: { origin: base } });
  if (!res.ok()) throw new Error(`${method} ${url} → ${res.status()} ${await res.text()}`);
  return (await res.json()).data;
}
async function seed(ctx) {
  const ws = await api(ctx, "POST", "/api/demo");
  const planned = await api(ctx, "POST", `/api/startups/${ws.startup.id}/roadmap`);
  const first = planned.tasks.find(t => !t.archived && t.week === 1);
  await api(ctx, "PATCH", `/api/startups/${ws.startup.id}/tasks/${first.id}`, { expectedRevision: first.revision, patch: { status: "done" } });
  return ws.startup.id;
}
async function setLayout(ctx, id, layout) {
  const ws = await api(ctx, "GET", `/api/startups/${id}`);
  await api(ctx, "PATCH", `/api/startups/${id}`, { expectedRevision: ws.startup.revision, patch: { preferences: { dashboardLayout: layout } } });
}
// Full-page captures pin fixed elements at the first viewport, which misrepresents the phone tab bar.
// So phones get an above-the-fold shot with the tab bar, plus a full-page shot without it.
async function fullShot(page, label, name) {
  if (label === "phone") {
    await page.screenshot({ path: out(`${label}-${name}-fold.png`) });
    await page.addStyleTag({ content: ".workspace-nav{display:none!important}" });
  }
  await page.screenshot({ path: out(`${label}-${name}.png`), fullPage: true });
}
async function settle(page) { await page.waitForLoadState("networkidle"); await page.waitForTimeout(700); }

async function shots(browser) {
  for (const [label, device] of [["desktop", desktop], ["phone", phone]]) {
    const ctx = await browser.newContext({ ...device, reducedMotion: "no-preference" });
    const page = await ctx.newPage();
    const id = await seed(ctx);
    const w = `/startups/${id}`;
    for (const [name, url] of [["welcome", "/"], ["new-startup", "/startups/new"], ["overview", w], ["strategy", `${w}/strategy?section=channels`], ["dashboard-B", `${w}/dashboard`], ["roadmap", `${w}/roadmap`]]) {
      await page.goto(base + url); await settle(page);
      await fullShot(page, label, name);
    }
    await setLayout(ctx, id, compositionA);
    await page.goto(`${base}${w}/dashboard`); await settle(page);
    await fullShot(page, label, "dashboard-A");
    await setLayout(ctx, id, null);
    await page.goto(`${base}${w}/dashboard`); await page.getByRole("button", { name: "Customize", exact: true }).click(); await page.waitForTimeout(500);
    await page.screenshot({ path: out(`${label}-dashboard-customize.png`), fullPage: false });
    await ctx.close();
  }
}

async function record(browser, label, device, script) {
  const dir = out(`.video-${label}`);
  const ctx = await browser.newContext({ ...device, recordVideo: { dir, size: device.viewport }, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  const id = await seed(ctx);
  page.on("dialog", d => { console.log(`[${label}] dialog: ${d.message()}`); d.accept(); });
  try { await script(page, `${base}/startups/${id}`); }
  catch (e) { await page.screenshot({ path: out(`.fail-${label}.png`) }); throw e; }
  await page.waitForTimeout(600);
  const video = page.video();
  await ctx.close();
  const file = await video.path();
  await rename(file, out(`${label}.webm`));
  await rm(dir, { recursive: true, force: true });
}
const pause = (page, ms = 700) => page.waitForTimeout(ms);
async function nav(page, name) { await page.getByRole("navigation", { name: "Workspace", exact: true }).getByRole("link", { name, exact: true }).click(); await pause(page, 900); }

async function videos(browser) {
  await record(browser, "motion-desktop", desktop, async (page, w) => {
    await page.goto(w); await pause(page, 1200);
    await nav(page, "Strategy");
    await page.getByRole("button", { name: /^Pricing & Revenue/ }).click(); await pause(page);
    const price = page.getByLabel(/^Initial price assumption/);
    await price.fill(""); await pause(page, 600);
    await price.pressSequentially("$29/month; pilot at $15", { delay: 25 }); await pause(page, 400);
    await page.getByRole("button", { name: "Save section", exact: true }).click(); await pause(page, 1400);
    await nav(page, "Dashboard");
    await page.getByRole("button", { name: "Customize", exact: true }).click(); await pause(page);
    await page.getByRole("button", { name: "Move Strategy readout earlier", exact: true }).click(); await pause(page);
    await page.getByRole("button", { name: "Strategy readout: Two thirds", exact: true }).click(); await pause(page);
    await page.getByRole("button", { name: "Move Strategy readout later", exact: true }).click(); await pause(page);
    await page.getByRole("button", { name: "Hide Riskiest belief", exact: true }).or(page.getByRole("button", { name: "Hide Risk watch", exact: true })).click(); await pause(page);
    await page.getByRole("button", { name: "Reset", exact: true }).click().catch(() => {});
    await page.getByRole("button", { name: "Cancel", exact: true }).click(); await pause(page);
    await page.getByRole("button", { name: "Mark done", exact: true }).first().click(); await pause(page, 1200);
    await nav(page, "Roadmap");
    await page.getByLabel(/^Status for /).nth(1).selectOption("in_progress"); await pause(page, 900);
    await page.getByRole("button", { name: /^Edit / }).first().click(); await pause(page, 900);
    await page.getByRole("button", { name: "Cancel", exact: true }).click(); await pause(page);
    await page.getByRole("button", { name: "Add task", exact: true }).click(); await pause(page);
    await page.getByRole("dialog").getByLabel(/^Title/).pressSequentially("Call the incubator lead", { delay: 25 });
    await page.getByRole("dialog").getByLabel(/^Deliverable/).fill("Two warm introductions");
    await page.getByRole("dialog").getByRole("button", { name: "Add task", exact: true }).click(); await pause(page, 1400);
    await nav(page, "Overview");
  });
  await record(browser, "motion-phone", phone, async (page, w) => {
    await page.goto(`${w}/dashboard`); await pause(page, 1200);
    await page.mouse.wheel(0, 500); await pause(page);
    await page.getByRole("button", { name: "Mark done", exact: true }).first().click(); await pause(page, 1200);
    await nav(page, "Strategy");
    await page.getByLabel(/^Buyer type/).fill("Founder at a 2–10 person SaaS startup"); await pause(page, 500);
    await page.getByRole("button", { name: "Save section", exact: true }).click(); await pause(page, 1400);
    await nav(page, "Roadmap");
    await page.mouse.wheel(0, 600); await pause(page);
    await nav(page, "Overview");
  });
}

await mkdir(here, { recursive: true });
const browser = await chromium.launch();
try {
  if (only !== "video") await shots(browser);
  if (only !== "shots") await videos(browser);
} finally { await browser.close(); }
console.log((await readdir(here)).filter(f => /\.(png|webm)$/.test(f)).join("\n"));
