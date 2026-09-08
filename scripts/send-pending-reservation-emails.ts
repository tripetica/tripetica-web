import { loadLocalEnv } from "./load-env";

loadLocalEnv();

async function main() {
  const { sendPendingReservationConfirmationEmails } = await import(
    "../lib/mail/send-reservation-confirmation"
  );
  const { sendPendingOperationReservationNotifications } = await import(
    "../lib/mail/send-operation-reservation-notification"
  );
  const { closeSmtpTransports } = await import("../lib/mail/smtp");
  const { getPool } = await import("../lib/db/postgres");
  try {
    const result = await sendPendingReservationConfirmationEmails(10);
    if (result.processed > 0) {
      console.log(
        `Reservation email queue: processed=${result.processed} sent=${result.sent} failed=${result.failed}`,
      );
    }
    if (result.failed > 0) {
      process.exitCode = 1;
    }
    const operationResult =
      await sendPendingOperationReservationNotifications(10);
    if (operationResult.processed > 0) {
      console.log(
        `Operation email queue: processed=${operationResult.processed} sent=${operationResult.sent} failed=${operationResult.failed}`,
      );
    }
    if (operationResult.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    closeSmtpTransports();
    await getPool().end();
  }
}

void main();
