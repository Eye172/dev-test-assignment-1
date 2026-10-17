"use client";
import { useRef, useState } from "react";
import { FileText, Paperclip, X } from "lucide-react";

export type Attached = { name: string; size: number; kind: "text" | "binary"; text: string };
const textTypes = /\.(txt|md|markdown|csv)$/i;
const accepted = ".txt,.md,.markdown,.csv,.pdf,.docx,.pptx";
const maxFiles = 3; const maxBytes = 5 * 1024 * 1024;

/**
 * Attach existing material. Plain-text files are read in the browser right away; PDF, DOCX and PPTX are kept
 * for the AI reader and the interface says so honestly — they are never silently ignored.
 */
export function FileAttach({ files, onChange, aiReading }: { files: Attached[]; onChange: (files: Attached[]) => void; aiReading: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");
  async function add(list: FileList | null) {
    if (!list) return;
    setError("");
    const next = [...files];
    for (const file of Array.from(list)) {
      if (next.length >= maxFiles) { setError(`Up to ${maxFiles} files.`); break; }
      if (file.size > maxBytes) { setError(`${file.name} is larger than 5 MB.`); continue; }
      if (next.some(f => f.name === file.name)) continue;
      const isText = textTypes.test(file.name) || file.type.startsWith("text/");
      next.push({ name: file.name, size: file.size, kind: isText ? "text" : "binary", text: isText ? (await file.text()).slice(0, 20000) : "" });
    }
    onChange(next);
  }
  return <div className={`attach ${over ? "over" : ""}`} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
    onDrop={e => { e.preventDefault(); setOver(false); void add(e.dataTransfer.files); }}>
    <button type="button" className="attach-button" onClick={() => input.current?.click()}><Paperclip size={16} aria-hidden/>Attach a deck, notes or one-pager</button>
    <span className="attach-hint">or drop files here · PDF, DOCX, PPTX, TXT, MD · up to 3</span>
    <input ref={input} type="file" multiple accept={accepted} hidden onChange={e => { void add(e.target.files); e.target.value = ""; }}/>
    {files.length > 0 && <ul className="attach-list">{files.map(f => <li key={f.name}>
      <FileText size={15} aria-hidden/><span className="attach-name">{f.name}</span>
      <span className="attach-state">{f.kind === "text" ? "Read" : aiReading ? "Will be read by AI" : "Kept · needs AI access to read"}</span>
      <button type="button" className="icon-button small" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter(x => x !== f))}><X size={14}/></button>
    </li>)}</ul>}
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>;
}
