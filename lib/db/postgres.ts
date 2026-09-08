import "server-only";

import { Pool, type QueryResult, type QueryResultRow } from "pg";
import { assertExpectedDatabase } from "@/lib/db/database-target";

const globalForPg = globalThis as typeof globalThis & {
  tripeticaPgPool?: Pool;
};

function databaseUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  assertExpectedDatabase(url, process.env.EXPECTED_DATABASE);
  return url;
}

export function getPool() {
  if (!globalForPg.tripeticaPgPool) {
    globalForPg.tripeticaPgPool = new Pool({
      connectionString: databaseUrl(),
      max: 10,
    });
  }
  return globalForPg.tripeticaPgPool;
}

export function query<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, values);
}
