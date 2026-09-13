export function assertDevAssignmentAlarmRuntime(
  env: Record<string, string | undefined> = process.env,
) {
  if (env.NODE_ENV === "production") {
    throw new Error("Assignment alarm is DEV-only until production cutover.");
  }
  const expected = env.EXPECTED_DATABASE?.trim();
  if (expected !== "tripetica_dev") {
    throw new Error(
      "Assignment alarm requires EXPECTED_DATABASE=tripetica_dev.",
    );
  }
  if (!env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is not set");
  }
}
