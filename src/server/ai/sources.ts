import "server-only";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { createHash, randomUUID } from "node:crypto";
import type { SourcePage } from "@/lib/domain/analysis";
import { safeSourceUrl } from "@/lib/domain/ai";

// Pin the validated DNS answer for the connection, including on every redirect.
export function publicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a,b] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && [0,168].includes(b) || a === 100 && b >= 64 && b <= 127 || a === 198 && [18,19,51].includes(b) || a === 203 && b === 0);
  }
  // Public global-unicast IPv6 only. IPv4-mapped, loopback, link-local and ULA fail.
  return isIP(address) === 6 && /^[23][0-9a-f]{0,3}:/i.test(address) && !/^(?:2002:|2001:(?:0:|:|2:|10:|20:|db8:))/i.test(address);
}
const decode = (s: string) => s.replace(/&(?:amp|quot|apos|lt|gt|nbsp);/g, v => ({ "&amp;":"&", "&quot;":'"', "&apos;":"'", "&lt;":"<", "&gt;":">", "&nbsp;":" " }[v] || v)).replace(/&#(x[0-9a-f]+|\d+);/gi, (_,n:string) => { const value = n[0].toLowerCase() === "x" ? parseInt(n.slice(1),16) : Number(n); return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : " "; });
export function pageText(html: string) {
  return decode(html.replace(/<(script|style|noscript|svg|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1\s*>/gi," ").replace(/<\/(?:p|div|section|article|h[1-6]|li|tr)>/gi,"\n").replace(/<[^>]+>/g," ")).replace(/[\t\r ]+/g," ").split("\n").map(s=>s.trim()).filter(Boolean).join("\n");
}
async function readPage(url: URL, redirects = 0): Promise<{ html: string; url: string }> {
  if (!safeSourceUrl(url.href) || url.port && url.port !== "443" || redirects > 3) throw new Error("Source address is not permitted.");
  let dnsTimer:ReturnType<typeof setTimeout>|undefined;
  const addresses = await Promise.race([
    lookup(url.hostname,{all:true,verbatim:true}),
    new Promise<never>((_,reject)=>{dnsTimer=setTimeout(()=>reject(new Error("Source DNS lookup timed out.")),4000);dnsTimer.unref();}),
  ]).finally(()=>clearTimeout(dnsTimer));
  if (!addresses.length || addresses.some(a=>!publicAddress(a.address))) throw new Error("Source address is not public.");
  const address = addresses[0];
  const pinned: LookupFunction = (_hostname, options, callback) => {
    if (options.all) callback(null,[address]); else callback(null,address.address,address.family);
  };
  return new Promise((resolve,reject)=>{
    const req = request(url,{method:"GET",agent:false,lookup:pinned,signal:AbortSignal.timeout(10000),headers:{"User-Agent":"OrbitGTMResearch/2.0 (public source verification)","Accept":"text/html,text/plain","Accept-Encoding":"identity"}},res=>{
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();void readPage(new URL(res.headers.location,url),redirects+1).then(resolve,reject);return;
      }
      if (res.statusCode !== 200 || !/^(text\/html|text\/plain)/i.test(res.headers["content-type"]||"")) { res.resume();reject(new Error("Source did not return a readable public page."));return; }
      const chunks:Buffer[]=[];let size=0;
      res.on("data",(chunk:Buffer)=>{size+=chunk.length;if(size>750000){req.destroy(new Error("Source page exceeds the capture limit."));return;}chunks.push(chunk);});
      res.on("end",()=>resolve({html:Buffer.concat(chunks).toString("utf8"),url:url.href}));res.on("error",reject);
    });
    req.setTimeout(8000,()=>req.destroy(new Error("Source page timed out.")));req.on("error",reject);req.end();
  });
}
export async function capturePage(url: string, runId: string): Promise<SourcePage> {
  const id=randomUUID(),accessedAt=new Date().toISOString();
  try {
    const page=await readPage(new URL(url));
    const full=pageText(page.html);const text=full.slice(0,18000);
    const pieces=text.match(/[\s\S]{1,1100}(?:\n|$)|[\s\S]{1,1100}/g)||[];
    if(text.length<80)throw new Error("No usable public text could be captured.");
    return {id,runId,url,title:decode(page.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||new URL(url).hostname).trim().slice(0,300),accessedAt,contentHash:createHash("sha256").update(text).digest("hex"),status:"captured",limitation:full.length>text.length?"Capture truncated at 18,000 characters; uncaptured content is unknown.":"Public page text; vendor assertions are not verified customer outcomes.",passages:pieces.map((text,i)=>({id:`${id}:p${i+1}`,text}))};
  }catch{
    return {id,runId,url,title:new URL(url).hostname,accessedAt,contentHash:"",status:"unavailable",limitation:"The public page could not be captured within the network, format or size limits. Treat its contents as unverified.",passages:[]};
  }
}
