import { loadDevelopmentEnv } from "./load-env";
import { assertDevFlightTrackingRuntime } from "../lib/ops/flight-tracking-dev-guard";

loadDevelopmentEnv();
if (!process.env.PG_POOL_MAX) {
  process.env.PG_POOL_MAX = "2";
}
assertDevFlightTrackingRuntime();

async function main() {
  const { pollDueFlightTracking } = await import(
    "../lib/ops/flight-tracking-poll"
  );
  const { getPool } = await import("../lib/db/postgres");
  try {
    const result = await pollDueFlightTracking();
    console.log(
      `Flight tracking: considered=${result.considered} polled=${result.polled} errors=${result.errors}`,
    );
  } finally {
    await getPool().end();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Failed";
  console.error(message);
  process.exitCode = 1;
});
