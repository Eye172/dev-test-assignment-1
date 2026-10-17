import "server-only";
import { z } from "zod";
import type { AgentOutputType } from "@openai/agents";
import { modelOutputSchema,type AiRole } from "@/lib/domain/ai";

/** Constrain the wire structure; validate all business bounds with Zod afterwards.
 * Constrained decoding at string/array boundaries can produce whitespace until
 * the output allowance expires instead of a useful validation failure. */
export function wireSchema(role:AiRole):AgentOutputType {
  const schema=z.toJSONSchema(modelOutputSchema(role),{io:"output"});
  const relax=(value:unknown):unknown=>{
    if(Array.isArray(value))return value.map(relax);
    if(!value||typeof value!=="object")return value;
    // An empty-only array is a role permission, not a verbosity bound. Dropping
    // it lets non-critics manufacture sourceChecks that the server must reject.
    return Object.fromEntries(Object.entries(value).filter(([key,v])=>key==="maxItems"&&v===0||!["$schema","maxLength","minLength","maxItems","minItems"].includes(key)).map(([key,v])=>[key,relax(v)]));
  };
  return {type:"json_schema",name:`orbit_${role}_v2`,strict:true,schema:relax(schema)} as AgentOutputType;
}
