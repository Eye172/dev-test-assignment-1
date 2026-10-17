import "server-only";
import type { AiResult } from "@/lib/domain/ai";
export function referenceIds(value:unknown,ids=new Set<string>()):Set<string>{
  if(Array.isArray(value)){value.forEach(v=>referenceIds(v,ids));return ids;}
  if(value&&typeof value==="object")for(const [key,v] of Object.entries(value)){
    if(["findingRefs","hypothesisRefs","decisionRefs"].includes(key)&&Array.isArray(v))v.forEach(id=>ids.add(String(id)));
    else referenceIds(v,ids);
  }
  return ids;
}
/** Resolve only exact handles from this immutable snapshot. Never repair a guessed UUID. */
export function resolveTaskHandles(result:AiResult,tasks:{id:string}[]):AiResult {
  const resolved=structuredClone(result),refs=new Map(tasks.map((t,i)=>[`task_${i+1}`,t.id]));
  for(const e of resolved.experiments)if(e.contract)e.contract.existingTaskIds=e.contract.existingTaskIds.map(ref=>refs.get(ref)||ref);
  return resolved;
}
