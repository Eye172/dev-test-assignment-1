import { cp } from "node:fs/promises";
import path from "node:path";

// Next traces server dependencies but intentionally leaves static assets out.
// Package them for the same server.js entry point used by our container.
const standalone = path.resolve(".next/standalone");
await cp("public",path.join(standalone,"public"),{ recursive: true });
await cp(".next/static",path.join(standalone,".next/static"),{ recursive: true });
