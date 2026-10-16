import { test,expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("AI data and paid mutations require owner access",async({page})=>{
  const clone=await page.request.post("/api/demo");expect(clone.status()).toBe(201);const id=(await clone.json()).data.startup.id;
  const endpoint=`/api/startups/${id}/ai`;const state=(await(await page.request.get(endpoint)).json()).data;
  expect(state).toMatchObject({authorized:false,runs:[],evidence:[]});expect((await page.request.get(`${endpoint}?export=1`)).status()).toBe(401);
  for(const action of ["create","resume","cancel","apply","evidence"])expect((await page.request.post(endpoint,{data:{action}})).status()).toBe(401);
  await page.goto(`/startups/${id}/agents`);await expect(page.getByRole("heading",{name:"Your unfair advantage.",exact:true})).toBeVisible();
  await expect(page.getByRole("navigation",{name:"Workspace",exact:true}).getByRole("link",{name:"AI studio",exact:true})).toBeVisible();
  const violations=(await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze()).violations;expect(violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("owner can record an observation, reopen it and retain newer brief text after a late acknowledgement",async({page})=>{
  test.skip(!!process.env.E2E_BASE_URL,"Local fixture access code only; never attempts to unlock a deployed owner's studio.");
  const clone=await page.request.post("/api/demo");const id=(await clone.json()).data.startup.id;const endpoint=`/api/startups/${id}/ai`;
  await page.emulateMedia({reducedMotion:"reduce"});await page.goto(`/startups/${id}/agents`);
  await page.getByLabel("Studio access code",{exact:true}).fill("ci-studio-code-no-production-access");await page.getByRole("button",{name:"Unlock studio",exact:false}).click();
  await expect(page.getByLabel("Your brief",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Record observation",exact:true}).click();
  await page.getByRole("dialog",{name:"Record an observation",exact:true}).getByRole("textbox",{name:/^What happened/}).fill("Three of five screened buyers described a recent dispatch mistake.");
  await page.getByLabel(/^How was it observed/).fill("Five screened phone interviews");await page.getByLabel("Sample size (optional)").fill("5");
  await page.getByRole("button",{name:"Save observation",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Record an observation",exact:true})).not.toBeVisible();
  await page.reload();await expect(page.getByText("Three of five screened buyers described a recent dispatch mistake.",{exact:true})).toBeVisible();
  let release!:()=>void;const hold=new Promise<void>(resolve=>{release=resolve;});let arrived!:()=>void;const received=new Promise<void>(resolve=>{arrived=resolve;});
  await page.route(`**/api/startups/${id}/ai`,async route=>{if(route.request().method()==="POST"&&route.request().postDataJSON()?.action==="create"){arrived();await hold;await route.fulfill({status:201,json:{data:{id:"11111111-1111-4111-8111-111111111111",created:true}}});}else await route.continue();});
  const brief=page.getByLabel("Your brief",{exact:true});await brief.fill("Brief A submitted to the mocked transport.");await page.getByRole("button",{name:"Start the team",exact:false}).click();await received;
  await brief.fill("Brief B typed while the acknowledgement is pending.");release();await expect(page.getByRole("button",{name:"Start the team",exact:false})).toBeEnabled();await expect(brief).toHaveValue("Brief B typed while the acknowledgement is pending.");await brief.fill("");
  await page.getByRole("button",{name:"Record observation",exact:true}).click();
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze()).violations).toEqual([]);
  await page.getByRole("dialog").getByRole("button",{name:"Close",exact:true}).click();
  await page.getByRole("button",{name:"Lock",exact:true}).click();await expect(page.getByLabel("Studio access code",{exact:true})).toBeVisible();
  const locked=(await(await page.request.get(endpoint)).json()).data;expect(locked.runs).toEqual([]);expect(locked.evidence).toEqual([]);
});
