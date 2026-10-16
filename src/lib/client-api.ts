import type { ApiErrorShape } from "./domain/types";
export class ClientError extends Error {
  constructor(message: string, public status: number, public code: string, public fields?: Record<string, string>) { super(message); }
}
export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { ...init, headers: { "Content-Type": "application/json",...init.headers },cache: "no-store",signal: AbortSignal.timeout(20000) }); }
  catch { throw new ClientError("Can't reach the server. Your changes are still here. Please retry.",0,"NETWORK"); }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (payload as ApiErrorShape | null)?.error;
    throw new ClientError(error?.message || "The request could not be completed. Please retry.",response.status,error?.code || "UNKNOWN",error?.fields);
  }
  return payload.data as T;
}
