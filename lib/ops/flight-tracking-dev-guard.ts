export function assertDevFlightTrackingRuntime(
  env: Record<string, string | undefined> = process.env,
) {
  if (env.NODE_ENV === "production") {
    throw new Error("Flight tracking poller is DEV-only until production cutover.");
  }
  const expected = env.EXPECTED_DATABASE?.trim();
  if (expected !== "tripetica_dev") {
    throw new Error(
      "Flight tracking poller requires EXPECTED_DATABASE=tripetica_dev.",
    );
  }
  if (!env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is not set");
  }
}
