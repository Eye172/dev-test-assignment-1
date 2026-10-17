/** JSONB may reorder object keys; field order is not a user edit. */
export function stableJson(value:unknown):string {
  const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==="object"?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonical(x)])):v;
  return JSON.stringify(canonical(value));
}
