import type { Attachment } from "./domain/intake-api";

const limit = 20000;
const accepted = /\.(txt|md|markdown|csv|pdf|docx|pptx)$/i;
/** Text extraction only: never executes document scripts or uploads the binary. */
export async function readAttachment(file: File): Promise<Attachment> {
  const base: Attachment = { name: file.name.slice(0, 240), size: file.size, kind: "binary", text: "", coverage: "", error: "" };
  if (!accepted.test(file.name)) throw new Error(`${file.name}: choose PDF, DOCX, PPTX, TXT, MD or CSV.`);
  if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} is larger than 5 MB.`);
  try {
    let text = ""; let coverage = "";
    if (/\.pdf$/i.test(file.name)) {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
      const loading = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), disableFontFace: true, useSystemFonts: true, isOffscreenCanvasSupported: false, stopAtErrors: true });
      // Destroy the worker on password prompts, timeout or parse failures as well.
      const timer = setTimeout(() => { void loading.destroy(); }, 20000);
      try {
        loading.onPassword = () => { void loading.destroy(); };
        const pdf = await loading.promise;
        const pages = Math.min(pdf.numPages, 30); let read = 0;
        for (let i = 1; i <= pages && text.length < limit; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += `\n[Page ${i}]\n` + content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("");
          page.cleanup(); read++;
        }
        coverage = `${read}/${pdf.numPages} pages; text layer only, images and charts not interpreted`;
      } finally { clearTimeout(timer); await loading.destroy(); }
    } else if (/\.(docx|pptx)$/i.test(file.name)) {
      const { unzipSync, strFromU8 } = await import("fflate");
      const docx = /\.docx$/i.test(file.name); let expanded = 0;
      const parts = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: entry => {
        const wanted = docx ? /^word\/(document|header\d+|footer\d+)\.xml$/.test(entry.name) : /^ppt\/slides\/slide\d+\.xml$/.test(entry.name);
        if (!wanted) return false;
        expanded += entry.originalSize;
        if (entry.originalSize > 1024 * 1024 || expanded > 2 * 1024 * 1024) throw new Error("Document text exceeds the safe extraction limit.");
        return true;
      } });
      const names = Object.keys(parts).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
      for (const name of names) {
        const xml = new DOMParser().parseFromString(strFromU8(parts[name]), "application/xml");
        if (xml.querySelector("parsererror")) throw new Error("The document XML is invalid.");
        const lines = Array.from(xml.getElementsByTagNameNS("*", "p")).map(p => Array.from(p.getElementsByTagNameNS("*", "t")).map(n => n.textContent).join(""));
        text += `\n[${name}]\n${lines.join("\n")}`;
      }
      coverage = docx ? "Body, headers and footers; images not interpreted" : `${names.length} slides; speaker notes, images and charts not interpreted`;
    } else { text = await file.text(); coverage = "Plain text"; }
    // Structural page/slide labels alone must never count as readable material.
    if (!text.replace(/\[(Page \d+|[^\]]+\.xml)\]/g, "").trim()) throw new Error("No readable text. Scans and image-only documents need OCR; paste their text instead.");
    if (text.length > limit) coverage += "; truncated to the first 20,000 characters";
    return { ...base, kind: "text", text: text.slice(0, limit), coverage };
  } catch (err) { return { ...base, error: err instanceof Error ? err.message.slice(0, 300) : "Could not read this document. Paste its text instead." }; }
}
