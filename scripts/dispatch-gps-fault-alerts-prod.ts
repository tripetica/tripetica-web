import { assertExpectedDatabase } from "../lib/db/database-target";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();
assertExpectedDatabase(process.env.DATABASE_URL ?? "", "tripetica");

async function main() {
  const { scanGpsAtsFaultAlerts } = await import("../lib/gps/ats-fault-scan");
  const { getPool } = await import("../lib/db/postgres");
  const { closeSmtpTransports } = await import("../lib/mail/smtp");
  try {
    const result = await scanGpsAtsFaultAlerts(new Date());
    console.log(JSON.stringify(result));
  } finally {
    closeSmtpTransports();
    await getPool().end();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "gps_ats_fault_scan_failed";
  console.error(message);
  process.exitCode = 1;
});
