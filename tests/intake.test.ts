import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createDatabase, type Database } from "@/server/database";
import { Store } from "@/server/store";
import { AiStore } from "@/server/ai/store";
import { IntakeStore } from "@/server/ai/intake";
import { emptyDraft, extract, nextQuestion } from "@/lib/domain/intake";
import { demoProfile } from "@/server/demo";
import { executionInput } from "@/server/ai/context";

let db:Database,store:Store,intake:IntakeStore,ai:AiStore;
beforeAll(async()=>{process.env.OPENAI_API_KEY="offline-no-provider";process.env.AI_ACCESS_CODE="offline-code";db=await createDatabase(process.env.TEST_DATABASE_URL||"memory://");store=new Store(db);intake=new IntakeStore(db);ai=new AiStore(db);});
afterAll(async()=>{await db.close();});
const material=()=>({requestId:randomUUID(),text:"Synthetic case: a founder has no customers. Read attached material; do not treat it as external evidence.",files:[{name:"private-founder-notes.txt",size:100,kind:"text" as const,text:"Private extraction: we sell to independent courier operations managers.",coverage:"First 20,000 characters only",error:""}]});

describe("onboarding interpretation and safe recovery",()=>{
  it("respects explicit stage and exclusions, and stops questions once required fields exist",()=>{
    const d=extract("Idea stage: we have no paying customers and no revenue. A B2B SaaS prototype for teams. We explicitly will not use LinkedIn, paid ads or partnerships.");
    expect(d.profile.stage).toBe("Idea");expect(d.hints.channels).toEqual([]);
    const complete=emptyDraft();complete.profile={name:"Test",description:"Description",businessModel:"B2B",stage:"Idea",targetMarket:"Kazakhstan",customerSegment:"Courier managers",websiteUrl:""};expect(nextQuestion(complete,[])).toBeNull();expect(nextQuestion(emptyDraft(),Array.from({length:7},(_,i)=>String(i)))).toBeNull();
  });
  it("acknowledges the same startup creation once and detects changed retries",async()=>{
    const id=randomUUID();const a=await store.createStartupOnce(demoProfile,id),b=await store.createStartupOnce(demoProfile,id);expect(b.id).toBe(a.id);
    await expect(store.createStartupOnce({...demoProfile,name:"Changed"},id)).rejects.toMatchObject({code:"CREATION_CHANGED",fields:{createdStartupId:a.id}});
  });
  it("persists extraction input, fences duplicate workers and settles shared budget once",async()=>{
    const p=material(),a=await intake.create(p),b=await intake.create(p);expect(b.id).toBe(a.id);
    await expect(intake.create({...p,text:"Different material"})).rejects.toMatchObject({code:"IDEMPOTENCY_CONFLICT"});
    const claimed=(await intake.claim(a.id))!;expect(await intake.claim(a.id)).toBeNull();
    await intake.settle(claimed.callId,{inputTokens:100,outputTokens:50,cost:700,metadata:{responseId:"fixture"}});
    await intake.settle(claimed.callId,{inputTokens:200,outputTokens:100,cost:9999,metadata:{responseId:"duplicate"}});
    expect(await intake.get(a.id)).toMatchObject({inputTokens:100,outputTokens:50,estimatedMicros:700,status:"running"});
    const [call]=await db.query("SELECT reserved_micros,charged_micros FROM ai_intake_calls WHERE id=$1",[claimed.callId]);expect(Number(call.charged_micros)).toBe(700);
    await intake.fail(a.id,"Fixture stopped deliberately");expect(await intake.claim(a.id)).toBeNull();
  });
  it("does not rebill a lost provider outcome; its reservation remains visible",async()=>{
    const a=await intake.create(material()),c=(await intake.claim(a.id))!;
    await db.query("UPDATE ai_intakes SET updated_at=now()-interval '151 seconds' WHERE id=$1",[a.id]);
    expect((await intake.get(a.id)).status).toBe("failed");expect(await intake.claim(a.id)).toBeNull();
    const [call]=await db.query("SELECT charged_micros,reserved_micros FROM ai_intake_calls WHERE id=$1",[c.callId]);expect(call.charged_micros).toBeNull();expect(Number(call.reserved_micros)).toBeGreaterThan(0);
  });
  it("freezes readable private material, keeps confirmed values authoritative and scopes intake to its startup",async()=>{
    const input=material(),record=await intake.create(input);await intake.claim(record.id);
    const d=emptyDraft();d.profile.customerSegment="Earlier extracted segment";await intake.complete(record.id,{profile:d.profile,hints:d.hints,uncertainties:["Founder must confirm the first buyer."]});
    const startup=await store.createStartup({...demoProfile,customerSegment:"Confirmed courier managers"});
    const payload={mode:"experiments",brief:"Use my confirmed profile",requestId:randomUUID(),intakeId:record.id,material:{text:input.text,files:input.files}};
    const created=await ai.create(startup.id,payload);expect(await ai.create(startup.id,payload)).toMatchObject({id:created.id,created:false});
    await expect(ai.create(startup.id,{...payload,material:{...payload.material,text:"Changed content"}})).rejects.toMatchObject({code:"IDEMPOTENCY_CONFLICT"});
    const run=(await ai.lease(created.id))!,step=(await ai.steps(run.id))[0],view=await executionInput(ai,run,step,[]);
    expect(view.snapshot.workspace.startup.customerSegment).toBe("Confirmed courier managers");expect(view.snapshot.founderMaterial?.files[0].text).toContain("Private extraction");expect(view.instruction).toContain("confirmed saved profile is authoritative");
    expect(JSON.stringify(await store.workspace(startup.id))).not.toContain("Private extraction");expect(JSON.stringify(await ai.export(startup.id))).toContain("Private extraction");
    await ai.cancel(startup.id,run.id);
    const other=await store.createStartup(demoProfile);await expect(ai.create(other.id,{...payload,requestId:randomUUID()})).rejects.toMatchObject({status:404});
  });
});
