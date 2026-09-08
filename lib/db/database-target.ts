export function databaseNameFromUrl(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (!database || database.includes("/")) {
    throw new Error("DATABASE_URL must name exactly one database");
  }
  return database;
}

export function assertExpectedDatabase(
  databaseUrl: string,
  expectedDatabase: string | null | undefined,
) {
  const expected = expectedDatabase?.trim();
  if (!expected) {
    return databaseNameFromUrl(databaseUrl);
  }
  const actual = databaseNameFromUrl(databaseUrl);
  if (actual !== expected) {
    throw new Error(
      `Database target mismatch: expected ${expected}, received ${actual}`,
    );
  }
  return actual;
}
