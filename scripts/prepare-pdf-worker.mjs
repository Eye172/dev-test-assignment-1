import { mkdir, copyFile } from "node:fs/promises";
await mkdir("public/vendor", { recursive: true });
await copyFile("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/vendor/pdf.worker.min.mjs");
await copyFile("node_modules/pdfjs-dist/LICENSE", "public/vendor/pdfjs-LICENSE.txt");
