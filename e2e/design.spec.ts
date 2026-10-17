import { test, expect } from "@playwright/test";

test("old demo copy switches language without rewriting saved work", async ({page}) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  const ws=(await (await page.request.post("/api/demo")).json()).data;
  const base=`/startups/${ws.startup.id}`;
  await page.goto(`${base}?lang=ru&ui=observatory`);
  await expect(page.locator(".obs-desc")).toContainText("Рабочее пространство");
  await expect(page.locator(".obs-next-title")).toContainText(/[А-Яа-я]/);
  await page.locator(".v4-display > button").click();
  await page.getByRole("button",{name:"Қазақша",exact:true}).click();
  await expect(page.locator(".obs-desc")).toContainText("Клиенттерді зерттеу");
  await expect(page.locator(".obs-next-title")).toContainText(/[әғқңөұүһі]/i);
  const after=(await (await page.request.get(`/api/startups/${ws.startup.id}`)).json()).data;
  expect(after.startup).toEqual(ws.startup);
  expect(after.sections).toEqual(ws.sections);
  expect(after.tasks).toEqual(ws.tasks);
});

test("black hole runs autonomously and ASCII keeps five-pixel cells and scene bounds", async ({page}) => {
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.goto("/?lang=en&ui=observatory");
  const hole=page.locator(".v4-blackhole"), canvas=hole.locator("canvas");
  await expect(hole).toHaveClass(/is-ready/);
  const first=Number(await canvas.getAttribute("data-frame"));
  await expect.poll(async()=>Number(await canvas.getAttribute("data-frame"))).toBeGreaterThan(first+2);
  const bounds=await canvas.boundingBox();
  await page.getByRole("button",{name:"ASCII · 5 px",exact:true}).click();
  await expect(hole).toHaveAttribute("data-renderer","ascii");
  await expect(hole).toHaveAttribute("data-cell-px","5");
  expect(await canvas.boundingBox()).toEqual(bounds);
  const asciiFirst=Number(await canvas.getAttribute("data-frame"));
  await expect.poll(async()=>Number(await canvas.getAttribute("data-frame"))).toBeGreaterThan(asciiFirst+2);
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
