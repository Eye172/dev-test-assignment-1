import { getDatabase } from "../src/server/database";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
const db = await getDatabase();
console.log(`Schema ready (${db.mode}).`);
await db.close();
