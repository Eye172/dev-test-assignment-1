import { getStore } from "@/server/store";
import { handle, idFrom, json, readJson } from "@/server/http";
import { z } from "zod";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(request,async()=>{
    const input=await readJson(request,{allowEmpty:true});
    const options=input===undefined?{}:z.object({replaceAiPlan:z.boolean(),expectedPlanId:z.uuid()}).strict().parse(input);
    return json(await(await getStore()).generate(idFrom((await context.params).id),options));
  });
}
