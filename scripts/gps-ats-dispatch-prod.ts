import { assertExpectedDatabase } from "../lib/db/database-target";
import { assertProdAtsDispatchWithheld } from "../lib/gps/ats-worker-guard";
import { atsLiveDispatchAllowed } from "../lib/uetds/ats-post";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();
assertProdAtsDispatchWithheld(process.env);
assertExpectedDatabase(process.env.DATABASE_URL ?? "", "tripetica");

async function main() {
  const { runAtsDispatch } = await import("../lib/gps/ats-run");
  const { getPool } = await import("../lib/db/postgres");
  try {
    const summary = await runAtsDispatch();
    if (!atsLiveDispatchAllowed(process.env) && (summary.sent !== 0 || summary.failed !== 0 || summary.retried !== 0)) {
      throw new Error("ats_live_dispatch_blocked");
    }
    const state = atsLiveDispatchAllowed(process.env) ? "approved" : "withheld";
    console.log(`ATS live dispatch ${state} sent=${summary.sent} skipped=${summary.skipped} failed=${summary.failed} retried=${summary.retried}`);
  } finally {
    await getPool().end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "ats_dispatch_failed";
  console.error(message);
  process.exit(1);
});
