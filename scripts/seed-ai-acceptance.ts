/** Offline browser fixture. No public seeding endpoint and no provider calls. */
import { mkdir, writeFile } from "node:fs/promises";
import { getDatabase } from "../src/server/database";
import { seedAnalysisCase } from "../tests/fixtures/analysis-case";

if(process.env.OPENAI_API_KEY!=="offline-ui-fixture-not-a-real-api-key")throw new Error("Acceptance fixtures require the isolated offline test environment.");
const db=await getDatabase();
try {
  const fixtures:Record<string,{startupId:string;runId:string}>={};
  for(const project of ["desktop","mobile"])for(const retry of [0,1]){
    const c=await seedAnalysisCase(db,{custom:true});
    fixtures[`${project}:${retry}`]={startupId:c.startup.id,runId:c.run.id};
  }
  await mkdir(".data",{recursive:true});
  await writeFile(".data/ai-acceptance.json",JSON.stringify(fixtures));
} finally {await db.close();}
