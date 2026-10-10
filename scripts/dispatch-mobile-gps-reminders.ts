import { loadDevelopmentEnv } from "./load-env";

loadDevelopmentEnv();

async function main() {
  if (process.env.EXPECTED_DATABASE !== "tripetica_dev" || process.env.NODE_ENV === "production") {
    console.error("mobile gps reminders refuse this database");
    process.exit(1);
  }
  const { runMobileGpsReminders } = await import("@/lib/gps/mobile-reminder-run");
  const deliver = process.env.MOBILE_GPS_REMINDER_DELIVER === "yes";
  const result = await runMobileGpsReminders(new Date(), deliver);
  console.log(JSON.stringify({ deliver, ...result }));
}

void main();
