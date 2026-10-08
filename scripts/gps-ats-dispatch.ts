import { loadDevelopmentEnv } from "./load-env";
import { runAtsDispatch } from "../lib/gps/ats-run";
import { assertAtsWorkerWithheld } from "../lib/gps/ats-worker-guard";

loadDevelopmentEnv();
assertAtsWorkerWithheld(process.env);

async function main() {
  if (process.env.ATS_MINISTRY_DISPATCH !== "allow-test") {
    console.log("ATS dispatch withheld: ministry HTTP stays disabled until ATS_MINISTRY_DISPATCH=allow-test");
    return;
  }
  const summary = await runAtsDispatch();
  console.log(`ATS dispatch finished sent=${summary.sent} skipped=${summary.skipped} failed=${summary.failed} retried=${summary.retried}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "ats_dispatch_failed";
  console.error(message);
  process.exit(1);
});
