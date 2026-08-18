import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

export type Database = Pick<pg.Pool, "query">;

export function createPool(connectionString: string) {
  return new pg.Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
}

export async function migrate(db: Database) {
  const path = fileURLToPath(new URL("../migrations/001_initial.sql", import.meta.url));
  await db.query(await readFile(path, "utf8"));
}
