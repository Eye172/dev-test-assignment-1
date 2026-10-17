"use client";
import { useRef, useState } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { readAttachment } from "@/lib/read-attachment";
import type { Attachment } from "@/lib/domain/intake-api";
import { useDisplay } from "@/ui/display";

export type Attached = Attachment;
const accepted = ".txt,.md,.markdown,.csv,.pdf,.docx,.pptx";
const maxFiles = 3; const maxBytes = 5 * 1024 * 1024;

/**
 * Attach existing material. Plain-text files are read in the browser right away; PDF, DOCX and PPTX are kept
 * for the AI reader and the interface says so honestly — they are never silently ignored.
 */
export function FileAttach({ files, onChange,onReading }: { files: Attached[]; onChange: (files: Attached[]) => void; aiReading?: boolean;onReading?:(busy:boolean)=>void }) {
  const input = useRef<HTMLInputElement>(null);
  const { t } = useDisplay();
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const busy = useRef(false);
  async function add(list: FileList | null) {
    if (!list || busy.current) return;
    busy.current = true; setReading(true);onReading?.(true);
    setError("");
    const next = [...files];
    try { for (const file of Array.from(list)) {
      if (next.length >= maxFiles) { setError(t("files.max", { n: maxFiles })); break; }
      if (file.size > maxBytes) { setError(t("files.tooBig", { name: file.name })); continue; }
      if (next.some(f => f.name === file.name)) continue;
      next.push(await readAttachment(file));
    } onChange(next); }
    catch (err) { setError((err as Error).message); }
    finally { busy.current = false; setReading(false);onReading?.(false); }
  }
  return <div className={`attach ${over ? "over" : ""}`} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
    onDrop={e => { e.preventDefault(); setOver(false); void add(e.dataTransfer.files); }}>
    <button type="button" className="attach-button" disabled={reading} aria-busy={reading} onClick={() => input.current?.click()}><Paperclip size={16} aria-hidden/>{reading ? t("files.reading") : t("files.attach")}</button>
    <span className="attach-hint">{t("files.hint")}</span>
    <input ref={input} type="file" multiple accept={accepted} hidden onChange={e => { void add(e.target.files); e.target.value = ""; }}/>
    {files.length > 0 && <ul className="attach-list">{files.map(f => <li key={f.name}>
      <FileText size={15} aria-hidden/><span className="attach-name">{f.name}</span>
      <span className="attach-state">{f.kind === "text" ? `${t("files.read")} · ${f.coverage || ""}` : `${t("files.notRead")} · ${f.error || t("files.reattach")}`}</span>
      <button type="button" className="icon-button small" disabled={reading} aria-label={`${t("files.remove")}: ${f.name}`} onClick={() => onChange(files.filter(x => x !== f))}><X size={14}/></button>
    </li>)}</ul>}
    {error && <p className="field-error" role="alert">{error}</p>}
    <p className="field-help">{t("files.note")}</p>
  </div>;
}
