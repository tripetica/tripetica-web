import { assertExpectedDatabase } from "../lib/db/database-target";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();
assertExpectedDatabase(process.env.DATABASE_URL ?? "", "tripetica");

async function main() {
  const { runMobileGpsReminders } = await import("../lib/gps/mobile-reminder-run");
  const { getPool } = await import("../lib/db/postgres");
  const { closeSmtpTransports } = await import("../lib/mail/smtp");
  try {
    const deliver = process.env.MOBILE_GPS_REMINDER_DELIVER === "yes";
    const result = await runMobileGpsReminders(new Date(), deliver);
    console.log(JSON.stringify({ deliver, ...result }));
  } finally {
    closeSmtpTransports();
    await getPool().end();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "mobile_gps_reminder_failed";
  console.error(message);
  process.exitCode = 1;
});
