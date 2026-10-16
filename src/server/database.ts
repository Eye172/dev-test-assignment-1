import { mkdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { schemaSql } from "./schema";
import { aiSchemaSql } from "./ai/schema";
import { analysisSchemaSql } from "./ai/analysis-schema";

export interface SqlExecutor {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]>;
}
export interface Database extends SqlExecutor {
  mode: "postgres" | "pglite";
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
function pgExecutor(client: Pool | PoolClient): SqlExecutor {
  return { async query<T extends QueryResultRow>(sql: string, params: unknown[] = []) { return (await client.query<T>(sql, params)).rows; } };
}
export async function createDatabase(location?: string): Promise<Database> {
  let db: Database;
  if (location?.startsWith("postgres")) {
    const pool = new Pool({ connectionString: location, max: 5, idleTimeoutMillis: 15000, connectionTimeoutMillis: 10000 });
    pool.on("error", () => console.error("PostgreSQL idle connection interrupted."));
    db = { mode: "postgres", ...pgExecutor(pool), close: () => pool.end(),
      async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>) {
        const client = await pool.connect();
        try { await client.query("BEGIN"); const result = await fn(pgExecutor(client)); await client.query("COMMIT"); return result; }
        catch (error) { await client.query("ROLLBACK"); throw error; }
        finally { client.release(); }
      },
    };
  } else {
    if (location && location !== "memory://") await mkdir(path.resolve(location), { recursive: true });
    const pg = new PGlite(location === "memory://" ? undefined : location);
    await pg.waitReady;
    db = { mode: "pglite", async query<T extends QueryResultRow>(sql: string, params: unknown[] = []) { return (await pg.query<T>(sql, params)).rows; },
      transaction: fn => pg.transaction(tx => fn({ async query<T extends QueryResultRow>(sql: string, params: unknown[] = []) { return (await tx.query<T>(sql, params)).rows; } })),
      close: () => pg.close(),
    };
  }
  // Serialize DDL across production instances. PGlite serializes its own transactions.
  try {
    await db.transaction(async tx => {
      if (db.mode === "postgres") await tx.query("SELECT pg_advisory_xact_lock(4815162342)");
      // pg's extended protocol cannot prepare multiple statements; run DDL statements separately.
      for (const statement of `${schemaSql}\n${aiSchemaSql}\n${analysisSchemaSql}`.split(";").map(s => s.trim()).filter(Boolean)) await tx.query(statement);
    });
  } catch (error) { await db.close().catch(() => {}); throw error; }
  return db;
}
const globalDb = globalThis as unknown as { orbitDatabase?: Promise<Database> };
export function databaseLocation(env: NodeJS.ProcessEnv = process.env): string {
  if (env.DEMO_MODE === "false" || (env.NODE_ENV === "production" && env.DEMO_MODE !== "true")) throw new Error("This release requires explicitly enabled synthetic demo mode.");
  if (env.DATABASE_URL) {
    let valid = false;
    try { const url = new URL(env.DATABASE_URL); valid = ["postgres:","postgresql:"].includes(url.protocol) && Boolean(url.hostname); } catch {}
    if (!valid) throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
    return env.DATABASE_URL;
  }
  if (env.NODE_ENV === "production" && env.ALLOW_LOCAL_DATABASE !== "true") throw new Error("DATABASE_URL is required in production.");
  return env.PGLITE_DATA_DIR || ".data/orbit";
}
export function getDatabase(): Promise<Database> {
  if (!globalDb.orbitDatabase) {
    globalDb.orbitDatabase = createDatabase(databaseLocation())
      .catch(error => { globalDb.orbitDatabase = undefined; throw error; });
  }
  return globalDb.orbitDatabase;
}
