import { test, expect } from "@playwright/test";
import { zipSync, strToU8 } from "fflate";
import type { Startup } from "../src/lib/domain/types";

test.skip(!!process.env.E2E_BASE_URL,"Synthetic owner credentials and mocked paid responses are isolated to local/CI acceptance.");
const brief="Fieldnote helps operations managers turn interview notes into decisions. We are a B2B MVP in Kazakhstan. Manual notes are scattered across calls.";
const baseProfile={name:"Assembly case",description:"A synthetic MVP for courier operations managers.",businessModel:"B2B",stage:"MVP",targetMarket:"Kazakhstan",customerSegment:"Earlier extracted buyer",websiteUrl:""};
function initialSession(){return {step:"confirm",path:"guided",text:"",files:[],asked:[],answers:[],draft:{profile:baseProfile,hints:{painPoint:"Manual dispatch is slow",outcome:"",price:"KZT 20000 / pilot",pricingModel:"Paid pilot",channels:["Founder-led outreach"]},origin:{}},guided:{name:"Assembly case",oneLiner:baseProfile.description,model:"B2B",types:[],otherType:"",stage:"MVP",signals:[],markets:["Kazakhstan"],otherMarket:"",roles:[],sizes:[],industry:"",segment:baseProfile.customerSegment,pain:"Manual dispatch is slow",pricing:"Paid pilot",price:"KZT 20000 / pilot",channels:["Founder-led outreach"],website:""},sessionId:crypto.randomUUID(),creationRequestId:crypto.randomUUID(),created:null,pending:{},guidedTopic:0,runAi:false};}

test("clarification drafts and malformed nested recovery survive reload without a crash",async({page})=>{
  await page.goto("/startups/new");await page.getByRole("button",{name:/^Free form/}).click();
  await page.getByLabel("Your startup in your own words").fill("A B2B SaaS idea for teams. Manual updates are scattered.");
  await page.getByRole("button",{name:"Continue",exact:true}).click();
  await page.getByLabel("What is the startup called?").fill("A name still being edited");await page.reload();
  await expect(page.getByLabel("What is the startup called?")).toHaveValue("A name still being edited");
  await page.evaluate(()=>{const k="orbit:onboarding:v1",s=JSON.parse(sessionStorage.getItem(k)!);s.step="guided";s.guided={markets:null,roles:42};s.pending={name:{value:null,multi:8}};sessionStorage.setItem(k,JSON.stringify(s));});
  await page.reload();await expect(page.getByRole("heading",{name:"Guided brief",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Back",exact:true}).click();await page.getByRole("button",{name:/^Free form/}).click();
  await expect(page.getByLabel("Your startup in your own words")).toHaveValue("A B2B SaaS idea for teams. Manual updates are scattered.");
});

test("PDF, DOCX and PPTX contribute actual bounded text; unread documents are disclosed",async({page})=>{
  await page.goto("/startups/new");await page.getByRole("button",{name:/^Free form/}).click();
  // A minimal valid PDF with an actual text layer and correct cross-reference offsets.
  const stream="BT /F1 12 Tf 30 740 Td (Synthetic PDF: voice notes need dispatch records.) Tj ET";
  const objects=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>","<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf="%PDF-1.4\n";const offsets=[0];for(const [i,o] of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;}
  const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,"0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const docx=zipSync({"word/document.xml":strToU8('<w:document xmlns:w="urn:test"><w:body><w:p><w:r><w:t>Synthetic DOCX: weekly sales allowance is eight hours.</w:t></w:r></w:p></w:body></w:document>')});
  const pptx=zipSync({"ppt/slides/slide1.xml":strToU8('<p:sld xmlns:p="urn:test" xmlns:a="urn:text"><a:p><a:r><a:t>Synthetic PPTX: budget is USD 300.</a:t></a:r></a:p></p:sld>')});
  await page.locator('input[type="file"]').setInputFiles([{name:"case.pdf",mimeType:"application/pdf",buffer:Buffer.from(pdf)},{name:"notes.docx",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",buffer:Buffer.from(docx)},{name:"deck.pptx",mimeType:"application/vnd.openxmlformats-officedocument.presentationml.presentation",buffer:Buffer.from(pptx)}]);
  await expect(page.getByText(/Text read ·/)).toHaveCount(3);
  const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem("orbit:onboarding:v1")!).files as {text:string}[]);
  expect(saved.map(f=>f.text).join(" ")).toContain("Synthetic PDF");expect(saved[1].text).toContain("eight hours");expect(saved[2].text).toContain("USD 300");
  await page.getByRole("button",{name:"Remove notes.docx"}).click();
  await page.locator('input[type="file"]').setInputFiles({name:"broken.docx",mimeType:"application/octet-stream",buffer:Buffer.from("not a zip")});
  await expect(page.getByText(/Not read ·/)).toBeVisible();
});

test("explicit preflight retries use a new ID and preserve unknowns over outdated attachments",async({page})=>{
  const ids:string[]=[];
  await page.route("**/api/intake",async route=>{
    if(route.request().method()!=="POST"||route.request().postDataJSON().action!=="analyze"){await route.continue();return;}
    const {payload}=route.request().postDataJSON();ids.push(payload.requestId);
    await route.fulfill({status:202,json:{data:{id:crypto.randomUUID(),requestId:payload.requestId,status:ids.length===1?"failed":"completed",draft:ids.length===1?null:{profile:{...baseProfile,stage:""},hints:{painPoint:"",outcome:"",price:"",pricingModel:"",channels:[]},origin:{name:"ai"}},uncertainties:["Stage conflicts with old deck; confirm it."],error:ids.length===1?"Synthetic provider failure":null,inputTokens:100,outputTokens:50,estimatedMicros:700}}});
  });
  await page.goto("/startups/new");await page.getByRole("button",{name:/^Free form/}).click();await page.getByLabel("Your startup in your own words").fill(brief);
  await page.locator('input[type="file"]').setInputFiles({name:"old.txt",mimeType:"text/plain",buffer:Buffer.from("Old deck: we have revenue and paying customers.")});await expect(page.getByText(/Text read ·/)).toBeVisible();
  await page.getByRole("button",{name:"Interpret with AI",exact:true}).click();await page.getByLabel("Owner access code",{exact:true}).fill("ci-studio-code-no-production-access");await page.getByRole("button",{name:"Unlock AI",exact:true}).click();
  await page.getByRole("button",{name:"Interpret with AI",exact:true}).click();await expect(page.getByRole("alert").filter({hasText:"Synthetic provider failure"})).toBeVisible();
  await page.getByRole("button",{name:"Start a new paid interpretation",exact:true}).click();await expect(page.getByText(/Interpretation ready/)).toBeVisible();expect(ids).toHaveLength(2);expect(ids[0]).not.toBe(ids[1]);
  await page.getByRole("button",{name:"Continue",exact:true}).click();await expect(page.getByRole("heading",{name:"Where are you today?",exact:true})).toBeVisible();
});

test("lost creation acknowledgement recovers one workspace; latest consent and confirmed buyer win",async({page})=>{
  const createdIds:string[]=[];let release:(()=>void)|undefined;const held=new Promise<void>(r=>{release=r;});let writes=0;
  await page.route("**/api/startups",async route=>{
    if(route.request().method()!=="POST"){await route.continue();return;}
    const response=await route.fetch();const startup=(await response.json()).data as Startup;createdIds.push(startup.id);writes++;
    if(writes===1){await route.abort("connectionreset");return;}
    await held;await route.fulfill({response});
  });
  let paidStarts=0;await page.route("**/api/startups/*/ai",async route=>{if(route.request().method()==="POST"&&route.request().postDataJSON().action==="create")paidStarts++;await route.continue();});
  await page.goto("/startups/new");await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem("orbit:onboarding:v1")||"{}").sessionId)).toBeTruthy();await page.evaluate(s=>sessionStorage.setItem("orbit:onboarding:v1",JSON.stringify(s)),initialSession());await page.reload();
  await page.getByLabel(/^Primary customer segment/).fill("Confirmed independent courier managers");
  await page.getByRole("button",{name:/Create and launch/}).click();await expect(page.getByRole("alert").filter({hasText:"Can't reach the server"})).toBeVisible();
  await page.getByLabel(/Run the AI specialists after creation/).check();
  await page.getByRole("button",{name:/Create and launch/}).click();await expect.poll(()=>writes).toBe(2);
  await page.getByLabel(/Run the AI specialists after creation/).uncheck();release!();
  await expect(page.getByRole("heading",{name:"Your workspace is ready.",exact:true})).toBeVisible();expect(createdIds[0]).toBe(createdIds[1]);expect(paidStarts).toBe(0);
  const key=`orbit:tab-draft:v1:strategy:${createdIds[0]}:icp`;
  expect(await page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)!).value.data.buyerType,key)).toBe("Confirmed independent courier managers");
  await page.reload();await expect(page.getByRole("heading",{name:"Your workspace is ready.",exact:true})).toBeVisible();expect(createdIds).toHaveLength(2);
  await page.getByRole("button",{name:"Create another startup",exact:true}).click();await expect(page.getByRole("heading",{name:"How do you want to start?",exact:true})).toBeVisible();
});
