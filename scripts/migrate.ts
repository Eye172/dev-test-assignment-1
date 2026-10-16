import { getDatabase } from "../src/server/database";
const db = await getDatabase();
console.log(`Schema ready (${db.mode}).`);
await db.close();
