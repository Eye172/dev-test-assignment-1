import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import type { AiStudioState } from "../src/lib/domain/ai";
import type { Workspace } from "../src/lib/domain/types";

test.skip(!!process.env.E2E_BASE_URL,"Offline fixtures are only installed in the isolated acceptance server.");
test.use({actionTimeout:10000});
async function unlock(page:Page,id:string){
  await page.goto(`/startups/${id}/agents`);
  await page.getByLabel("Studio access code").fill("ci-studio-code-no-production-access");
  await page.getByRole("button",{name:/Unlock studio/}).click();
  await expect(page.getByRole("button",{name:"Lock",exact:true})).toBeVisible();
}
const state=async(page:Page,id:string)=>(await (await page.request.get(`/api/startups/${id}/ai`)).json()).data as AiStudioState;
const workspace=async(page:Page,id:string)=>(await (await page.request.get(`/api/startups/${id}`)).json()).data as Workspace;

test("a new follow-up and an explicitly selected historical run survive refresh",async({page},info)=>{
  const fixtures=JSON.parse(await readFile(".data/ai-acceptance.json","utf8"));
  const {startupId:id}=fixtures[`${info.project.name}:${info.retry}`];
  await unlock(page,id);
  const saved=await state(page,id),original=saved.runs[0];
  const next={...structuredClone(original),id:randomUUID(),createdAt:new Date().toISOString()};
  let created=false;
  // Offline UI fixture: no provider request is made or represented as a real council run.
  await page.route(`**/api/startups/${id}/ai`,async route=>{
    if(route.request().method()==="GET")return route.fulfill({json:{data:{...saved,runs:created?[next,...saved.runs]:saved.runs}}});
    const body=route.request().postDataJSON();
    if(body.action==="create"){created=true;return route.fulfill({json:{data:{id:next.id,created:true}}});}
    return route.continue();
  });
  await page.getByRole("button",{name:"Follow up",exact:true}).click();
  const reviewScope=page.getByRole("button",{name:"Review saved work",exact:true});
  await reviewScope.click();
  await page.getByRole("button",{name:"Clear",exact:true}).click();
  await page.getByRole("button",{name:"New question",exact:true}).click();
  await expect(reviewScope).toBeDisabled();
  await expect(page.getByRole("button",{name:"Full team",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button",{name:"Follow up",exact:true}).click();
  await reviewScope.click();
  await page.getByRole("textbox",{name:"Your brief",exact:true}).fill("Offline follow-up selection and recovery fixture");
  await page.getByRole("button",{name:"Start the team",exact:true}).click();
  await expect(page.getByRole("combobox",{name:"Run"})).toHaveValue(next.id);
  await expect(page).toHaveURL(new RegExp(`run=${next.id}`));
  await page.reload();
  await expect(page.getByRole("combobox",{name:"Run"})).toHaveValue(next.id);
  await page.getByRole("combobox",{name:"Run"}).selectOption(original.id);
  await expect(page).toHaveURL(new RegExp(`run=${original.id}`));
  await page.reload();
  await expect(page.getByRole("combobox",{name:"Run"})).toHaveValue(original.id);
});

test("research, decision memory, reviewed plan and adverse observation form one persisted flow",async({page},info)=>{
  test.setTimeout(120000);
  const fixtures=JSON.parse(await readFile(".data/ai-acceptance.json","utf8"));
  const {startupId:id}=fixtures[`${info.project.name}:${info.retry}`];
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await unlock(page,id);
  await expect(page.getByRole("region",{name:"Case-specific alternatives comparison"})).toBeVisible();
  await expect(page.getByRole("columnheader",{name:/Our synthetic idea/})).toBeVisible();
  await page.screenshot({path:info.outputPath("analysis-overview.png"),fullPage:true});
  await page.getByRole("button",{name:"Arrange analysis"}).click();
  await page.getByRole("button",{name:"Move Decisions and tradeoffs earlier",exact:true}).click();
  await page.getByRole("button",{name:"Hide What changed",exact:true}).click();
  await page.getByRole("button",{name:"Save arrangement"}).click();
  // Wait for the visible save acknowledgement, including the bounded post-save view refresh.
  await expect(page.getByRole("button",{name:"Save arrangement",exact:true})).not.toBeVisible({timeout:25000});
  await expect.poll(async()=>(await state(page,id)).layout!.plates[0].id).toBe("decisions");
  const hypotheses=page.locator("section[aria-labelledby='analysis-hypotheses']");
  for(let i=0;i<3;i++)await hypotheses.getByRole("button",{name:"Accept hypothesis",exact:true}).first().click();
  await page.locator("section[aria-labelledby='analysis-decisions']").getByRole("button",{name:"Accept decision",exact:true}).click();
  await expect.poll(async()=>(await state(page,id)).memory!.filter(m=>["active","accepted"].includes(m.status)).length).toBe(4);
  const review=page.locator("section[aria-labelledby='analysis-review']");
  await review.getByText("Typed findings",{exact:true}).click();
  await review.getByRole("button",{name:"Evidence 1",exact:true}).click();
  await expect(page.getByRole("dialog").getByText(/Captured .*captured/)).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("blockquote")).toContainText("USD 12");
  await page.getByRole("dialog").getByRole("button",{name:"Close",exact:true}).click();
  await page.getByText("Specialist proposals and saved strategy changes",{exact:true}).click();
  await page.getByRole("group",{name:"Specialist results"}).getByRole("button",{name:/Strategy/}).click();
  for(const title of ["Ideal Customer Profile","Value Proposition","Acquisition Channels","Market Assumptions"]){
    await page.getByRole("button",{name:`Review: ${title}`,exact:true}).click();
    await page.getByRole("dialog").getByRole("button",{name:"Apply reviewed proposal",exact:true}).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
  await page.getByRole("group",{name:"Specialist results"}).getByRole("button",{name:/Pricing/}).click();
  await page.getByRole("button",{name:"Review: Pricing & Revenue",exact:true}).click();
  await page.getByRole("dialog").getByRole("button",{name:"Apply reviewed proposal",exact:true}).click();
  await expect.poll(async()=>(await workspace(page,id)).completion.percentage).toBe(100);
  await page.getByRole("button",{name:"Review one active plan",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByLabel("Remaining minutes for Founder-owned visit",{exact:true}).fill("60");
  await dialog.getByLabel("Remaining USD cash for Founder-owned visit",{exact:true}).fill("0");
  await dialog.getByRole("button",{name:"Add currency budget",exact:true}).click();
  await expect(dialog.getByRole("button",{name:"Apply reviewed plan"})).toBeDisabled();
  await dialog.getByRole("button",{name:"Remove budget USD",exact:true}).last().click();
  await dialog.getByLabel("Combined work capacity per week (minutes)",{exact:true}).fill("30");
  await expect(dialog.getByText(/Week 1 needs 120 minutes/)).toBeVisible();
  await expect(dialog.getByRole("button",{name:"Apply reviewed plan"})).toBeDisabled();
  await dialog.getByLabel("Combined work capacity per week (minutes)",{exact:true}).fill("240");
  await expect(dialog.getByRole("button",{name:"Apply reviewed plan"})).toBeEnabled();
  await page.screenshot({path:info.outputPath("plan-review.png")});
  let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route(`**/api/startups/${id}/ai`,async route=>{if(route.request().method()==="POST"&&route.request().postDataJSON()?.target==="roadmap")await held;await route.continue();});
  await dialog.getByRole("button",{name:"Apply reviewed plan"}).click();
  try{await expect(dialog.getByLabel("Combined work capacity per week (minutes)",{exact:true})).toBeDisabled();}finally{release();}
  await expect(dialog).not.toBeVisible();
  await page.unroute(`**/api/startups/${id}/ai`);
  const applied=await workspace(page,id);
  expect(applied.activePlan?.id).toBeTruthy();expect(applied.tasks.filter(t=>!t.archived)).toHaveLength(7);
  expect(applied.tasks.filter(t=>t.source==="generated"&&!t.archived)).toHaveLength(0);
  await hypotheses.getByRole("button",{name:"Record observation",exact:true}).first().click();
  await dialog.getByLabel("What happened?",{exact:false}).fill("Synthetic observation: one of five screened managers needed separate dispatch records; no price was tested.");
  await dialog.getByLabel("How was it observed?",{exact:false}).fill("Five screened recent-work interviews, synthetic fixture");
  await dialog.getByLabel("Sample size (optional)",{exact:true}).fill("5");
  await dialog.getByLabel(/^Interpretation/).selectOption("contradicts");
  await dialog.getByRole("button",{name:"Save observation",exact:true}).click();
  await expect(dialog).not.toBeVisible();
  await expect(hypotheses.getByText("New evidence needs review",{exact:true})).toBeVisible();
  await page.reload();
  await expect(hypotheses.getByText("New evidence needs review",{exact:true})).toBeVisible();
  await expect(page.getByText("1 hidden displays.",{exact:false})).toBeVisible();
  await page.getByRole("button",{name:"Follow up",exact:true}).click();
  await expect(page.getByText("Following up from saved specialist artifacts",{exact:false})).toBeVisible();
  const exported=await (await page.request.get(`/api/startups/${id}/ai?export=1`)).json();
  expect(exported.memoryHistory.length).toBeGreaterThanOrEqual(8);expect(exported.plans).toHaveLength(1);
  expect(exported.executions.every((e:{input_payload:unknown})=>!!e.input_payload)).toBe(true);
  const accessibility=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.getByRole("button",{name:"Lock",exact:true}).click();
  const privateState=await state(page,id);expect(privateState.runs).toEqual([]);expect(privateState.memory).toBeUndefined();
  expect((await page.request.get(`/api/startups/${id}/ai?export=1`)).status()).toBe(401);
  expect(errors).toEqual([]);
});

test("unfinished manual hypotheses survive reload before any paid run exists",async({page})=>{
  const ws=(await (await page.request.post("/api/demo")).json()).data as Workspace;
  await unlock(page,ws.startup.id);
  await page.getByRole("button",{name:"Record hypothesis",exact:true}).click();
  await page.getByLabel("Testable hypothesis",{exact:false}).fill("A partial founder hypothesis, still missing its reasoning");
  page.on("dialog",d=>void d.accept());
  await page.reload();
  await page.getByRole("button",{name:"Record hypothesis",exact:true}).click();
  await expect(page.getByLabel("Testable hypothesis",{exact:false})).toHaveValue("A partial founder hypothesis, still missing its reasoning");
  await page.getByLabel("What would make you revisit it?",{exact:false}).fill("Screened buyers show no repeated need");
  await page.getByLabel("Reasoning and basis",{exact:false}).fill("A hypothesis derived from the founder's current workflow, not customer evidence");
  await page.getByLabel("Why record this change?",{exact:false}).fill("Record the basis before testing it");
  await page.getByRole("button",{name:"Save with history",exact:true}).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const saved=await state(page,ws.startup.id);expect(saved.memory).toHaveLength(1);expect(saved.runs).toHaveLength(0);
});

test("memory risk keeps its saved enum while Russian and Kazakh labels change",async({page})=>{
  const ws=(await (await page.request.post("/api/demo")).json()).data as Workspace;
  await unlock(page,ws.startup.id);
  await page.goto(`/startups/${ws.startup.id}/ai?lang=ru`);
  await page.getByRole("button",{name:"Записать гипотезу",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.locator('select').first().selectOption("high");
  await expect(dialog.locator('select').first()).toHaveValue("high");
  await dialog.locator('textarea').nth(0).fill("A saved high-risk hypothesis");
  await dialog.locator('textarea').nth(1).fill("Three buyer refusals");
  await dialog.locator('textarea').nth(2).fill("Founder assumption, no commercial proof");
  await dialog.locator('textarea').nth(3).fill("Record before testing");
  await dialog.getByRole("button",{name:"Сохранить с историей",exact:true}).click();
  await expect(dialog).not.toBeVisible();
  for(const locale of ["ru","kk"]){
    await page.goto(`/startups/${ws.startup.id}/ai?lang=${locale}`);
    await page.getByRole("button",{name:locale==="ru"?"Изменить / решить":"Өзгерту / шешу",exact:true}).first().click();
    await expect(dialog.locator('select').first()).toHaveValue("high");
    await dialog.getByRole("button",{name:locale==="ru"?"Закрыть":"Жабу",exact:true}).click();
  }
  expect((await state(page,ws.startup.id)).memory?.[0].data).toMatchObject({kind:"hypothesis",proposal:{risk:"high"}});
});
