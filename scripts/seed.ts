import { getStore } from "../src/server/store";
import { ensureDemo } from "../src/server/demo";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
const store = await getStore();
const demo = await ensureDemo(store);
console.log(`Demo ready: /startups/${demo.startup.id}`);
await store.db.close();
