import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getDatabase } from "../database";
import { AppError } from "../errors";

const cookieName = "orbit_ai_owner";
const digest = (value: string) => createHash("sha256").update(value).digest();
const equal = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));
const signature = (payload: string) => createHmac("sha256", process.env.AI_ACCESS_CODE || "unconfigured").update(payload).digest("base64url");
export function isAiAuthorized(request: Request) {
  if (!process.env.AI_ACCESS_CODE) return false;
  const value = request.headers.get("cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || "";
  const [expires, signed, extra] = value.split(".");
  return !extra && /^\d{13}$/.test(expires || "") && Number(expires) > Date.now() && Number(expires) < Date.now() + 86401000 && equal(signed || "", signature(expires));
}
export function requireAiAuthorization(request: Request) {
  if (!isAiAuthorized(request)) throw new AppError("AI_ACCESS_REQUIRED", "Unlock the AI studio with the owner's access code.", 401);
}
export async function unlockAi(request: Request, input: unknown) {
  const { code } = z.object({ code: z.string().min(1).max(256) }).strict().parse(input);
  const identity = process.env.TRUST_PROXY === "true" ? request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown" : "local";
  const bucket = Math.floor(Date.now() / 900000);
  const key = `ai-unlock:${digest(identity).toString("hex")}:${bucket}`;
  const [limit] = await (await getDatabase()).query("INSERT INTO request_limits(key,count,expires_at) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET count=request_limits.count+1 RETURNING count", [key,new Date((bucket + 1) * 900000)]);
  if (Number(limit.count) > 8) throw new AppError("RATE_LIMIT", "Too many unlock attempts. Try again in 15 minutes.", 429, undefined, Math.ceil(((bucket + 1) * 900000 - Date.now()) / 1000));
  if (!process.env.AI_ACCESS_CODE || !equal(code, process.env.AI_ACCESS_CODE)) throw new AppError("AI_ACCESS_REQUIRED", "That access code did not match.", 401);
  const expires = String(Date.now() + 86400000);
  return `${cookieName}=${expires}.${signature(expires)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
export function lockAiCookie() { return `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`; }
