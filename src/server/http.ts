import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getDatabase } from "./database";
import { AppError } from "./errors";

export function json<T>(data: T, status = 200) { return Response.json({ data }, { status, headers: { "Cache-Control": "no-store" } }); }
export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new AppError("CONTENT_TYPE", "Send application/json.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("INVALID_JSON", "The request body must contain valid JSON.");
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { done,value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 65536) { await reader.cancel(); throw new AppError("BODY_TOO_LARGE", "Keep this request under 64 KB.", 413); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new AppError("INVALID_JSON", "The request body must contain valid JSON."); }
}
export function idFrom(value: string) {
  if (!z.uuid().safeParse(value).success) throw new AppError("NOT_FOUND", "This workspace could not be found.", 404);
  return value;
}
async function guard(request: Request) {
  const isWrite = !["GET","HEAD","OPTIONS"].includes(request.method);
  const origin = request.headers.get("origin");
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (isWrite && origin && origin !== expected) throw new AppError("ORIGIN_MISMATCH", "Open this workspace directly to save changes.", 403);
  const rawIdentity = process.env.TRUST_PROXY === "true" ? (request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown") : "local";
  const identity = createHash("sha256").update(rawIdentity).digest("hex").slice(0,32);
  const creation = isWrite && ["/api/startups","/api/demo"].includes(new URL(request.url).pathname);
  const period = creation ? 3600000 : 60000;
  const now = Date.now();
  const bucket = Math.floor(now/period);
  const key = `${creation ? "create" : "request"}:${identity}:${bucket}`;
  const db = await getDatabase();
  const [row] = await db.query("INSERT INTO request_limits(key,count,expires_at) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET count=request_limits.count+1 RETURNING count", [key,new Date(Date.now()+period)]);
  if (Number(row.count) > (creation ? 60 : 360)) throw new AppError("RATE_LIMIT", "Too many requests. Please wait a moment and retry.", 429,undefined,Math.max(1,Math.ceil(((bucket + 1) * period - now)/1000)));
  // Bound retained limiter data without running a background worker.
  if (Number(row.count) === 1) await db.query("DELETE FROM request_limits WHERE expires_at < now()");
}
export async function handle(request: Request, action: () => Promise<Response>) {
  try { await guard(request); return await action(); }
  catch (error) {
    let result: AppError;
    if (error instanceof AppError) result = error;
    else if (error instanceof z.ZodError) result = new AppError("VALIDATION", "Check the highlighted fields and try again.", 422,
      Object.fromEntries(error.issues.map(issue => [issue.path.join("."),issue.message])));
    else {
      // Log category only; connection strings, submitted data and stack traces stay out of responses/logs.
      console.error("Orbit request failed:", error instanceof Error ? error.name : "UnknownError");
      result = new AppError("SERVICE_UNAVAILABLE", "The workspace could not be reached. Your unsaved changes are still here; please retry.", 503);
    }
    return Response.json({ error: { code: result.code,message: result.message,...(result.fields ? { fields: result.fields } : {}) } },
      { status: result.status, headers: { "Cache-Control": "no-store", ...(result.status === 429 ? { "Retry-After": String(result.retryAfter ?? 60) } : {}) } });
  }
}
