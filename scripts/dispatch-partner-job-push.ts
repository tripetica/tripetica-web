import { loadDevelopmentEnv } from "./load-env";
import { assertDevPartnerScript } from "./partner-dev-guard";

loadDevelopmentEnv();
assertDevPartnerScript();

async function main() {
  const { dispatchDuePartnerJobPushes } = await import(
    "../lib/partner/push/notify-job-release"
  );
  const { getPool } = await import("../lib/db/postgres");
  try {
    await dispatchDuePartnerJobPushes();
  } finally {
    await getPool().end();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Failed";
  console.error(message);
  process.exitCode = 1;
});
