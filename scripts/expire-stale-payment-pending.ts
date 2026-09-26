import { loadLocalEnv } from "./load-env";
import { assertExpectedDatabase } from "../lib/db/database-target";

loadLocalEnv();

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const expectedDatabase = process.env.EXPECTED_DATABASE?.trim();
  if (!databaseUrl || !expectedDatabase) {
    throw new Error("DATABASE_URL and EXPECTED_DATABASE are required");
  }
  assertExpectedDatabase(databaseUrl, expectedDatabase);

  const { expireStalePaymentPendingReservations } = await import(
    "../lib/booking/expire-stale-payment-pending"
  );
  const result = await expireStalePaymentPendingReservations();
  console.log(`Expired payment-pending reservations: ${result.expired}`);
  const { deleteExpiredUetdsNotifications } = await import("../lib/uetds/retention");
  const retention = await deleteExpiredUetdsNotifications();
  console.log(`Expired local U-ETDS notifications deleted: ${retention.deleted}`);
}

void main().catch((error) => {
  console.error("Payment-pending expiry failed", error);
  process.exitCode = 1;
});
