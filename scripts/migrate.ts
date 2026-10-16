import { getDatabase } from "../src/server/database";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const db = await getDatabase();
console.log(`Schema ready (${db.mode}).`);
await db.close();
