import { loadLocalEnv } from "./load-env";
import { assertProdAssignmentAlarmRuntime } from "../lib/ops/assignment-alarm-prod-guard";

loadLocalEnv();
assertProdAssignmentAlarmRuntime();

async function main() {
  const { dispatchAssignmentAlarms } = await import(
    "../lib/ops/assignment-alarm"
  );
  const { getPool } = await import("../lib/db/postgres");
  const { closeSmtpTransports } = await import("../lib/mail/smtp");
  try {
    const result = await dispatchAssignmentAlarms();
    console.log(
      `Assignment alarms: considered=${result.considered} alarmed=${result.alarmed}`,
    );
  } finally {
    closeSmtpTransports();
    await getPool().end();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Failed";
  console.error(message);
  process.exitCode = 1;
});
