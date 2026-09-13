export function assertProdAssignmentAlarmRuntime(
  env: Record<string, string | undefined> = process.env,
) {
  if (env.NODE_ENV !== "production") {
    throw new Error("Production assignment alarm requires NODE_ENV=production.");
  }
  const expected = env.EXPECTED_DATABASE?.trim();
  if (expected !== "tripetica") {
    throw new Error(
      "Production assignment alarm requires EXPECTED_DATABASE=tripetica.",
    );
  }
  if (!env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is not set");
  }
}
