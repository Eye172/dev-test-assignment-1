import { test, expect } from "@playwright/test";

// Continuous video/trace screenshots force GPU readbacks. On CI's software GPU
// those stalled the very animation being tested. Keep DOM/source failure traces;
// the regular suite and committed renders retain the visual evidence.
test.use({video:"off",trace:{mode:"retain-on-failure",screenshots:false,snapshots:true,sources:true}});

test("old demo copy switches language without rewriting saved work", async ({page}) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  const ws=(await (await page.request.post("/api/demo")).json()).data;
  const base=`/startups/${ws.startup.id}`;
  await page.goto(`${base}?lang=ru&ui=observatory`);
  await expect(page.locator(".obs-desc:visible")).toContainText("Рабочее пространство");
  await expect(page.locator(".obs-next-title:visible")).toContainText(/[А-Яа-я]/);
  await page.locator(".v4-display > button:visible").click();
  await page.getByRole("button",{name:"Қазақша",exact:true}).click();
  await expect(page.locator(".obs-desc:visible")).toContainText("Клиенттерді зерттеу");
  await expect(page.locator(".obs-next-title:visible")).toContainText(/[әғқңөұүһі]/i);
  const after=(await (await page.request.get(`/api/startups/${ws.startup.id}`)).json()).data;
  expect(after.startup).toEqual(ws.startup);
  expect(after.sections).toEqual(ws.sections);
  expect(after.tasks).toEqual(ws.tasks);
  // Explicit regeneration writes RU instructions quoting the saved English
  // seed. The KK display still localizes those untouched example quotations.
  const regenerated=await page.request.post(`/api/startups/${ws.startup.id}/roadmap`,{data:{locale:"ru"}});
  expect(regenerated.ok()).toBe(true);
  const generated=(await regenerated.json()).data;
  expect(generated.tasks.some((task:{deliverable:string})=>task.deliverable.includes("Customer interview evidence"))).toBe(true);
  await page.reload();
  await expect(page.locator(".obs-desc:visible")).toContainText("Клиенттерді зерттеу");
  await expect(page.locator(".obs-next-detail:visible")).not.toContainText(/Customer interview|A clear customer|Invite 20 SaaS/);
});

test("light black hole keeps native resolution, runs autonomously and respects pause", async ({page,isMobile}) => {
  // CI uses a software GPU. Bound this live-render smoke test's pixel budget;
  // the full-size layouts are covered by the responsive and accessibility suite.
  test.setTimeout(120000);
  if (!isMobile) await page.setViewportSize({width:960,height:740});
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.goto("/?lang=en&ui=observatory");
  const hole=page.locator(".v4-blackhole"), canvas=hole.locator("canvas");
  await expect(hole).toHaveClass(/is-ready/,{timeout:30000});
  const first=Number(await canvas.getAttribute("data-frame"));
  await expect.poll(async()=>Number(await canvas.getAttribute("data-frame")),{timeout:30000}).toBeGreaterThan(first+2);
  await expect(hole).toHaveAttribute("data-renderer","light");
  await expect(page.getByRole("button",{name:/ASCII/})).toHaveCount(0);
  const resolution=await canvas.evaluate(el=>{const c=el as HTMLCanvasElement;return {width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight};});
  expect(resolution.width).toBeGreaterThanOrEqual(resolution.cssWidth);
  expect(resolution.height).toBeGreaterThanOrEqual(resolution.cssHeight);
  await page.getByRole("button",{name:"Pause animation",exact:true}).click();
  await expect(page.getByRole("button",{name:"Play animation",exact:true})).toBeVisible();
  // ResizeObserver may draw a final still after renderer reconfiguration.
  const stable=await canvas.evaluate(async el=>{
    await new Promise(r=>setTimeout(r,150)); const frame=el.dataset.frame;
    await new Promise(r=>setTimeout(r,350)); return frame===el.dataset.frame;
  });
  expect(stable).toBe(true);
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.getByRole("button",{name:"Play animation",exact:true}).click();
  const still=Number(await canvas.getAttribute("data-frame"));
  expect(still).toBeLessThan(4);
});

test("landing example spreads hypotheses across the map and uses concrete plan labels",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/?lang=ru&ui=observatory");
  const map=page.locator(".land-model .v4-amap");
  for(const quadrant of ["test_first","proceed","park","monitor"])
    await expect(map.locator(`.v4-amap-dot.is-${quadrant}`).first()).toBeAttached();
  await expect(page.locator(".v4-radar-scores")).toContainText("Целевой клиент");
  await expect(page.locator(".v4-radar-scores")).toContainText("Гипотезы и проверки");
  await expect(page.locator(".v4-radar-why")).toHaveCount(0);
  await page.locator(".v4-radar-scores button").first().click();
  await expect(page.locator(".v4-radar-why")).toContainText("Целевой клиент");
  await expect(page.locator(".land-note,.v4-demo-tag")).toHaveCount(0);
});
