import { loadDevelopmentEnv } from "./load-env";
import { assertDevPartnerScript } from "./partner-dev-guard";

if (!process.env.DATABASE_URL) {
  loadDevelopmentEnv();
}
assertDevPartnerScript();

function emptyFilters(overrides: {
  query?: string;
  sort?: "pickup_at" | "created_at" | "";
  dir?: "asc" | "desc" | "";
}) {
  return {
    query: overrides.query ?? "",
    status: "",
    payment: "",
    date: "" as const,
    from: "",
    to: "",
    sort: overrides.sort ?? "",
    dir: overrides.dir ?? "",
  };
}

async function main() {
  const { query } = await import("../lib/db/postgres");
  const { listReservations } = await import("../lib/ops/reservations");
  const {
    assignOpsReservationPartner,
    clearOpsReservationPartner,
  } = await import("../lib/ops/reservation-assignment");

  const partners = await query<{ id: string; is_primary_partner: boolean }>(
    `SELECT id, is_primary_partner
     FROM partners
     WHERE deleted_at IS NULL AND status = 'active'
     ORDER BY is_primary_partner DESC, partner_code ASC`,
  );
  if (partners.rows.length < 2) {
    throw new Error("Need two active DEV partners");
  }
  const partnerA = partners.rows[0];
  const partnerB = partners.rows[1];
  const stamp = Date.now();
  const prefix = `TST-SORT-${stamp}`;

  const ids: string[] = [];
  try {
    const earlyA = await query<{ id: string }>(
      `INSERT INTO reservations (
         reservation_code, status, locale, service_type, pickup_name_customer, pickup_name_tr,
         dropoff_name_customer, dropoff_name_tr, pickup_at, service_timezone, passenger_count,
         total_price, currency, payment_method, customer_first_name, customer_last_name,
         customer_email, customer_phone, confirmed_at, created_at
       ) VALUES (
         $1, 'confirmed', 'tr', 'airport_transfer', 'Sort pickup', 'Sort pickup',
         'Sort dropoff', 'Sort dropoff', TIMESTAMPTZ '2026-09-07 08:00:00+03',
         'Europe/Istanbul', 1, 100, 'EUR', 'cash', 'Sort', 'EarlyA',
         $2, '+905551110001', NOW(), NOW() - INTERVAL '2 seconds'
       ) RETURNING id`,
      [`${prefix}-A`, `sort-a-${stamp}@tripetica.local`],
    );
    ids.push(earlyA.rows[0].id);

    const earlyB = await query<{ id: string }>(
      `INSERT INTO reservations (
         reservation_code, status, locale, service_type, pickup_name_customer, pickup_name_tr,
         dropoff_name_customer, dropoff_name_tr, pickup_at, service_timezone, passenger_count,
         total_price, currency, payment_method, customer_first_name, customer_last_name,
         customer_email, customer_phone, confirmed_at, created_at
       ) VALUES (
         $1, 'confirmed', 'tr', 'airport_transfer', 'Sort pickup', 'Sort pickup',
         'Sort dropoff', 'Sort dropoff', TIMESTAMPTZ '2026-09-07 08:00:00+03',
         'Europe/Istanbul', 1, 100, 'EUR', 'cash', 'Sort', 'EarlyB',
         $2, '+905551110002', NOW(), NOW() - INTERVAL '1 second'
       ) RETURNING id`,
      [`${prefix}-B`, `sort-b-${stamp}@tripetica.local`],
    );
    ids.push(earlyB.rows[0].id);

    const late = await query<{ id: string }>(
      `INSERT INTO reservations (
         reservation_code, status, locale, service_type, pickup_name_customer, pickup_name_tr,
         dropoff_name_customer, dropoff_name_tr, pickup_at, service_timezone, passenger_count,
         total_price, currency, payment_method, customer_first_name, customer_last_name,
         customer_email, customer_phone, confirmed_at, created_at
       ) VALUES (
         $1, 'confirmed', 'tr', 'airport_transfer', 'Sort pickup', 'Sort pickup',
         'Sort dropoff', 'Sort dropoff', TIMESTAMPTZ '2026-09-30 09:25:00+03',
         'Europe/Istanbul', 1, 100, 'EUR', 'cash', 'Sort', 'Late',
         $2, '+905551110003', NOW(), NOW()
       ) RETURNING id`,
      [`${prefix}-C`, `sort-c-${stamp}@tripetica.local`],
    );
    ids.push(late.rows[0].id);

    const [idA, idB, idC] = ids;

    async function listed(
      sort: "pickup_at" | "created_at",
      dir: "asc" | "desc",
    ) {
      const { items } = await listReservations({
        filters: emptyFilters({ query: prefix, sort, dir }),
        page: 1,
        pageSize: 20,
      });
      return items.map((item) => item.id);
    }

    const pickupAsc = await listed("pickup_at", "asc");
    if (pickupAsc.join(",") !== [idA, idB, idC].join(",")) {
      throw new Error(`A: pickup_at ASC expected A,B,C got ${pickupAsc.join(",")}`);
    }
    console.log("A ok: pickup_at ASC is 7 Sep, 7 Sep, 30 Sep");

    const assignedLate = await assignOpsReservationPartner({
      reservationId: idC,
      partnerId: partnerA.id,
    });
    if (!assignedLate.ok) {
      throw new Error(`B: late partner assign failed ${assignedLate.error}`);
    }
    const afterLate = await listed("pickup_at", "asc");
    if (afterLate.join(",") !== [idA, idB, idC].join(",")) {
      throw new Error(`B: assigning partner to 30 Sep moved rows: ${afterLate.join(",")}`);
    }
    console.log("B ok: partner on 30 Sep did not move the row");

    const assignedEarly = await assignOpsReservationPartner({
      reservationId: idA,
      partnerId: partnerA.id,
    });
    if (!assignedEarly.ok) {
      throw new Error(`C: early partner assign failed ${assignedEarly.error}`);
    }
    const afterEarly = await listed("pickup_at", "asc");
    if (afterEarly.join(",") !== [idA, idB, idC].join(",")) {
      throw new Error(`C: assigning partner to 7 Sep moved rows: ${afterEarly.join(",")}`);
    }
    const switchedEarly = await assignOpsReservationPartner({
      reservationId: idA,
      partnerId: partnerB.id,
    });
    if (!switchedEarly.ok) {
      throw new Error(`C: early partner change failed ${switchedEarly.error}`);
    }
    const afterSwitch = await listed("pickup_at", "asc");
    if (afterSwitch.join(",") !== [idA, idB, idC].join(",")) {
      throw new Error(`C: changing partner moved rows: ${afterSwitch.join(",")}`);
    }
    const clearedEarly = await clearOpsReservationPartner({ reservationId: idA });
    if (!clearedEarly.ok) {
      throw new Error(`C: early partner clear failed ${clearedEarly.error}`);
    }
    const afterClear = await listed("pickup_at", "asc");
    if (afterClear.join(",") !== [idA, idB, idC].join(",")) {
      throw new Error(`C: removing partner moved rows: ${afterClear.join(",")}`);
    }
    console.log("C ok: assign/change/clear on 7 Sep kept pickup_at ASC");

    const pickupDesc = await listed("pickup_at", "desc");
    if (pickupDesc.join(",") !== [idC, idB, idA].join(",")) {
      throw new Error(`D: pickup_at DESC expected C,B,A got ${pickupDesc.join(",")}`);
    }
    console.log("D ok: pickup_at DESC puts 30 Sep first");

    const firstTie = await listed("pickup_at", "asc");
    await assignOpsReservationPartner({ reservationId: idB, partnerId: partnerA.id });
    const secondTie = await listed("pickup_at", "asc");
    if (firstTie[0] !== secondTie[0] || firstTie[1] !== secondTie[1]) {
      throw new Error(
        `E: same pickup_at pair swapped after assignment ${firstTie.slice(0, 2)} -> ${secondTie.slice(0, 2)}`,
      );
    }
    console.log("E ok: same pickup_at pair stayed stable after assignment");

    const createdAscBefore = await listed("created_at", "asc");
    if (createdAscBefore.join(",") !== [idA, idB, idC].join(",")) {
      throw new Error(`F: created_at ASC expected insert order A,B,C got ${createdAscBefore.join(",")}`);
    }
    await assignOpsReservationPartner({ reservationId: idC, partnerId: partnerB.id });
    const createdAscAfter = await listed("created_at", "asc");
    const createdDescAfter = await listed("created_at", "desc");
    if (createdAscAfter.join(",") !== [idA, idB, idC].join(",")) {
      throw new Error(`F: created_at ASC changed after assignment: ${createdAscAfter.join(",")}`);
    }
    if (createdDescAfter.join(",") !== [idC, idB, idA].join(",")) {
      throw new Error(`F: created_at DESC expected C,B,A got ${createdDescAfter.join(",")}`);
    }
    const touched = await query<{ created_at: string; pickup_at: string }>(
      `SELECT created_at::text, pickup_at::text FROM reservations WHERE id = $1`,
      [idC],
    );
    if (!touched.rows[0]) {
      throw new Error("F: missing created_at row");
    }
    console.log("F ok: created_at ASC/DESC unchanged by partner assignment");
    console.log(`DEV reservation sort scenarios passed on ${prefix}`);
  } finally {
    if (ids.length > 0) {
      await query(`DELETE FROM reservations WHERE id = ANY($1::uuid[])`, [ids]);
    }
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Failed";
  console.error(message);
  process.exitCode = 1;
});
