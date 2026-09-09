import { loadDevelopmentEnv } from "./load-env";
import { assertDevPartnerScript } from "./partner-dev-guard";

if (!process.env.DATABASE_URL) {
  loadDevelopmentEnv();
}
assertDevPartnerScript();

async function main() {
  const { query } = await import("../lib/db/postgres");
  const {
    assignOpsReservationDriver,
    assignOpsReservationPartner,
    assignOpsReservationVehicle,
    clearOpsReservationPartner,
  } = await import("../lib/ops/reservation-assignment");
  const { listAssignablePartnerDrivers, listAssignablePartnerVehicles } =
    await import("../lib/partner/fleet");
  const { loadPartnerJobAssignment } = await import("../lib/partner/job-assignment");
  const {
    NON_TRP_SELECTION,
    buildDriverAssignmentOptions,
    buildVehicleAssignmentOptions,
    parseNonTrpDriverSnapshot,
    parseNonTrpVehicleSnapshot,
  } = await import("../lib/partner/job-assignment-view");

  const partners = await query<{
    id: string;
    name: string;
    partner_code: string;
    is_primary_partner: boolean;
  }>(
    `SELECT id, name, partner_code, is_primary_partner
     FROM partners
     WHERE deleted_at IS NULL
       AND status = 'active'
     ORDER BY is_primary_partner DESC, partner_code ASC`,
  );
  if (partners.rows.length < 2) {
    throw new Error("Need two active DEV partners with fleet");
  }

  const fleets = [];
  for (const partner of partners.rows) {
    const [drivers, vehicles] = await Promise.all([
      listAssignablePartnerDrivers(partner.id),
      listAssignablePartnerVehicles(partner.id),
    ]);
    if (drivers[0] && vehicles[0]) {
      fleets.push({ partner, driver: drivers[0], vehicle: vehicles[0] });
    }
  }
  if (fleets.length < 2) {
    throw new Error("Need two active DEV partners each with an assignable driver and vehicle");
  }

  const partnerA = fleets[0];
  const partnerB = fleets[1];
  const primaryFleet = fleets.find((item) => item.partner.is_primary_partner);
  const normalFleet = fleets.find((item) => !item.partner.is_primary_partner);
  if (!primaryFleet || !normalFleet) {
    throw new Error("Need both a primary partner and a normal partner with assignable fleet");
  }
  const code = `TST-ASG-${Date.now()}`;
  const template = await query<{ id: string }>(
    `SELECT id FROM reservations WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
  );

  let reservationId: string;
  if (template.rows[0]) {
    const cloned = await query<{ id: string }>(
      `INSERT INTO reservations (
         reservation_code, status, locale, service_type, tour_code,
         pickup_name_customer, pickup_name_tr, dropoff_name_customer, dropoff_name_tr,
         pickup_at, service_timezone, passenger_count, vehicle_code,
         vehicle_label_customer, vehicle_label_tr, total_price, currency,
         payment_method, customer_first_name, customer_last_name, customer_email,
         customer_phone, confirmed_at
       )
       SELECT
         $1, 'confirmed', COALESCE(locale, 'tr'), COALESCE(service_type, 'airport_transfer'),
         tour_code, COALESCE(pickup_name_customer, 'Test pickup'),
         COALESCE(pickup_name_tr, 'Test pickup'), COALESCE(dropoff_name_customer, 'Test dropoff'),
         COALESCE(dropoff_name_tr, 'Test dropoff'), NOW() + INTERVAL '2 days',
         COALESCE(service_timezone, 'Europe/Istanbul'), COALESCE(passenger_count, 1),
         vehicle_code, vehicle_label_customer, vehicle_label_tr,
         COALESCE(total_price, 100), COALESCE(currency, 'EUR'), COALESCE(payment_method, 'cash'),
         COALESCE(customer_first_name, 'Ops'), COALESCE(customer_last_name, 'Test'),
         'ops-assignment-test@tripetica.local', COALESCE(customer_phone, '+905551112233'),
         NOW()
       FROM reservations
       WHERE id = $2
       RETURNING id`,
      [code, template.rows[0].id],
    );
    reservationId = cloned.rows[0].id;
  } else {
    const inserted = await query<{ id: string }>(
      `INSERT INTO reservations (
         reservation_code, status, locale, service_type, pickup_name_customer, pickup_name_tr,
         dropoff_name_customer, dropoff_name_tr, pickup_at, service_timezone, passenger_count,
         total_price, currency, payment_method, customer_first_name, customer_last_name,
         customer_email, customer_phone, confirmed_at
       ) VALUES (
         $1, 'confirmed', 'tr', 'airport_transfer', 'Test pickup', 'Test pickup',
         'Test dropoff', 'Test dropoff', NOW() + INTERVAL '2 days', 'Europe/Istanbul', 1,
         100, 'EUR', 'cash', 'Ops', 'Test', 'ops-assignment-test@tripetica.local',
         '+905551112233', NOW()
       )
       RETURNING id`,
      [code],
    );
    reservationId = inserted.rows[0].id;
  }

  const snapshot = async () => {
    const row = await query<{
      accepted_partner_id: string | null;
      assigned_driver_id: string | null;
      assigned_vehicle_id: string | null;
      assigned_driver_kind: string | null;
      assigned_vehicle_kind: string | null;
      assigned_driver_snapshot: unknown;
      assigned_vehicle_snapshot: unknown;
    }>(
      `SELECT accepted_partner_id, assigned_driver_id, assigned_vehicle_id,
              assigned_driver_kind, assigned_vehicle_kind,
              assigned_driver_snapshot, assigned_vehicle_snapshot
       FROM reservations WHERE id = $1`,
      [reservationId],
    );
    return row.rows[0];
  };

  try {
    let current = await snapshot();
    if (current.accepted_partner_id || current.assigned_driver_id || current.assigned_vehicle_id) {
      throw new Error("A: new reservation was not empty");
    }
    const driverWithoutPartner = await assignOpsReservationDriver({
      reservationId,
      selection: partnerA.driver.id,
    });
    if (driverWithoutPartner.ok || driverWithoutPartner.error !== "no-partner") {
      throw new Error(`A: driver assign without partner should be no-partner, got ${JSON.stringify(driverWithoutPartner)}`);
    }
    const vehicleWithoutPartner = await assignOpsReservationVehicle({
      reservationId,
      selection: partnerA.vehicle.id,
    });
    if (vehicleWithoutPartner.ok || vehicleWithoutPartner.error !== "no-partner") {
      throw new Error(`A: vehicle assign without partner should be no-partner, got ${JSON.stringify(vehicleWithoutPartner)}`);
    }
    const nonTrpWithoutPartner = await assignOpsReservationDriver({
      reservationId,
      selection: NON_TRP_SELECTION,
      fullName: "Ahmet Kaya",
      phoneCountryCode: "TR",
      phoneNational: "5332058219",
      languageCodes: ["tr"],
      notes: "",
    });
    if (nonTrpWithoutPartner.ok || nonTrpWithoutPartner.error !== "no-partner") {
      throw new Error(`A: NON TRP without partner should be no-partner, got ${JSON.stringify(nonTrpWithoutPartner)}`);
    }
    console.log("A ok: driver/vehicle locked without partner");

    const assignedA = await assignOpsReservationPartner({
      reservationId,
      partnerId: partnerA.partner.id,
    });
    if (!assignedA.ok) {
      throw new Error(`B: partner A assign failed ${assignedA.error}`);
    }
    current = await snapshot();
    if (current.accepted_partner_id !== partnerA.partner.id) {
      throw new Error("B: partner A not stored");
    }
    const foreignDriver = await assignOpsReservationDriver({
      reservationId,
      selection: partnerB.driver.id,
    });
    if (foreignDriver.ok || foreignDriver.error !== "foreign-fleet") {
      throw new Error(`F/B: foreign driver should be rejected, got ${JSON.stringify(foreignDriver)}`);
    }
    const ownDriver = await assignOpsReservationDriver({
      reservationId,
      selection: partnerA.driver.id,
    });
    if (!ownDriver.ok) {
      throw new Error(`B: partner A driver failed ${ownDriver.error}`);
    }
    const ownVehicle = await assignOpsReservationVehicle({
      reservationId,
      selection: partnerA.vehicle.id,
    });
    if (!ownVehicle.ok) {
      throw new Error(`B: partner A vehicle failed ${ownVehicle.error}`);
    }
    console.log("B ok: only partner A fleet accepted");

    current = await snapshot();
    if (
      current.assigned_driver_id !== partnerA.driver.id ||
      current.assigned_vehicle_id !== partnerA.vehicle.id
    ) {
      throw new Error("C: ops row missing driver/vehicle");
    }
    const accepted = await query<{ id: string }>(
      `SELECT id FROM reservations
       WHERE id = $1 AND accepted_partner_id = $2 AND deleted_at IS NULL`,
      [reservationId, partnerA.partner.id],
    );
    const open = await query<{ id: string }>(
      `SELECT id FROM reservations
       WHERE id = $1 AND accepted_partner_id IS NULL AND deleted_at IS NULL`,
      [reservationId],
    );
    if (!accepted.rows[0] || open.rows[0]) {
      throw new Error("C: job should be in partner A accepted pool, not open pool");
    }
    console.log("C ok: partner portal accepted job has same assignment");

    const switched = await assignOpsReservationPartner({
      reservationId,
      partnerId: partnerB.partner.id,
    });
    if (!switched.ok) {
      throw new Error(`D: switch to partner B failed ${switched.error}`);
    }
    current = await snapshot();
    if (current.accepted_partner_id !== partnerB.partner.id) {
      throw new Error("D: partner B not stored");
    }
    if (current.assigned_driver_id || current.assigned_vehicle_id || current.assigned_driver_kind || current.assigned_vehicle_kind || current.assigned_driver_snapshot || current.assigned_vehicle_snapshot) {
      throw new Error("D: old fleet was not cleared");
    }
    const oldDriverOnB = await assignOpsReservationDriver({
      reservationId,
      selection: partnerA.driver.id,
    });
    if (oldDriverOnB.ok || oldDriverOnB.error !== "foreign-fleet") {
      throw new Error("D: partner A driver must not work under partner B");
    }
    const bDriver = await assignOpsReservationDriver({
      reservationId,
      selection: partnerB.driver.id,
    });
    const bVehicle = await assignOpsReservationVehicle({
      reservationId,
      selection: partnerB.vehicle.id,
    });
    if (!bDriver.ok || !bVehicle.ok) {
      throw new Error("D: partner B fleet assign failed");
    }
    console.log("D ok: partner change resets fleet and switches pool");

    const cleared = await clearOpsReservationPartner({ reservationId });
    if (!cleared.ok) {
      throw new Error(`E: clear failed ${cleared.error}`);
    }
    current = await snapshot();
    if (
      current.accepted_partner_id ||
      current.assigned_driver_id ||
      current.assigned_vehicle_id ||
      current.assigned_driver_kind ||
      current.assigned_vehicle_kind ||
      current.assigned_driver_snapshot ||
      current.assigned_vehicle_snapshot
    ) {
      throw new Error("E: partner/driver/vehicle not fully cleared");
    }
    const backInOpen = await query<{ id: string }>(
      `SELECT id FROM reservations WHERE id = $1 AND accepted_partner_id IS NULL`,
      [reservationId],
    );
    if (!backInOpen.rows[0]) {
      throw new Error("E: reservation should return to open pool");
    }
    console.log("E ok: partner removal clears driver and vehicle");

    await assignOpsReservationPartner({
      reservationId,
      partnerId: partnerA.partner.id,
    });
    const foreignVehicle = await assignOpsReservationVehicle({
      reservationId,
      selection: partnerB.vehicle.id,
    });
    if (foreignVehicle.ok || foreignVehicle.error !== "foreign-fleet") {
      throw new Error(`F: foreign vehicle should be rejected, got ${JSON.stringify(foreignVehicle)}`);
    }
    console.log("F ok: server rejects foreign driver/vehicle ids");

    const normalDriverOptions = buildDriverAssignmentOptions(
      [normalFleet.driver],
      "tr",
      false,
      "NON TRP",
    );
    const normalVehicleOptions = buildVehicleAssignmentOptions(
      [normalFleet.vehicle],
      "tr",
      false,
      "NON TRP",
      true,
    );
    if (normalDriverOptions.some((item) => item.value === NON_TRP_SELECTION)) {
      throw new Error("B: NON TRP must not appear for a normal partner");
    }
    if (normalVehicleOptions.some((item) => item.value === NON_TRP_SELECTION)) {
      throw new Error("B: NON TRP vehicle must not appear for a normal partner");
    }
    await assignOpsReservationPartner({
      reservationId,
      partnerId: normalFleet.partner.id,
    });
    const nonTrpOnNormal = await assignOpsReservationDriver({
      reservationId,
      selection: NON_TRP_SELECTION,
      fullName: "Ahmet Kaya",
      phoneCountryCode: "TR",
      phoneNational: "5332058219",
      languageCodes: ["tr"],
      notes: "should fail",
    });
    if (nonTrpOnNormal.ok || nonTrpOnNormal.error !== "forbidden-non-trp") {
      throw new Error(`B: NON TRP on normal partner should be forbidden-non-trp, got ${JSON.stringify(nonTrpOnNormal)}`);
    }
    const nonTrpVehicleOnNormal = await assignOpsReservationVehicle({
      reservationId,
      selection: NON_TRP_SELECTION,
      plate: "34 ABC 123",
      brandModel: "Mercedes-Benz Vito",
      features: "VIP",
    });
    if (nonTrpVehicleOnNormal.ok || nonTrpVehicleOnNormal.error !== "forbidden-non-trp") {
      throw new Error(`B: NON TRP vehicle on normal partner should be forbidden-non-trp, got ${JSON.stringify(nonTrpVehicleOnNormal)}`);
    }
    console.log("B-nontrp ok: normal partner has no NON TRP option and server rejects it");

    const primaryDriverOptions = buildDriverAssignmentOptions(
      [primaryFleet.driver],
      "tr",
      true,
      "NON TRP",
    );
    const primaryVehicleOptions = buildVehicleAssignmentOptions(
      [primaryFleet.vehicle],
      "tr",
      true,
      "NON TRP",
      true,
    );
    if (primaryDriverOptions[0]?.value !== NON_TRP_SELECTION) {
      throw new Error("C: NON TRP must be first driver option for Ana Partner");
    }
    if (primaryVehicleOptions[0]?.value !== NON_TRP_SELECTION) {
      throw new Error("C: NON TRP must be first vehicle option for Ana Partner");
    }
    await assignOpsReservationPartner({
      reservationId,
      partnerId: primaryFleet.partner.id,
    });
    console.log("C ok: Ana Partner dropdowns include NON TRP first");

    const nonTrpDriver = await assignOpsReservationDriver({
      reservationId,
      selection: NON_TRP_SELECTION,
      fullName: "Ahmet Kaya",
      phoneCountryCode: "TR",
      phoneNational: "5332058219",
      languageCodes: ["tr", "ru"],
      notes: "ops nontrp driver",
    });
    if (!nonTrpDriver.ok) {
      throw new Error(`D-nontrp: driver failed ${nonTrpDriver.error}`);
    }
    const nonTrpVehicle = await assignOpsReservationVehicle({
      reservationId,
      selection: NON_TRP_SELECTION,
      plate: "34 ABC 123",
      brandModel: "Mercedes-Benz Vito",
      features: "VIP iç dizayn",
    });
    if (!nonTrpVehicle.ok) {
      throw new Error(`D-nontrp: vehicle failed ${nonTrpVehicle.error}`);
    }
    current = await snapshot();
    if (current.assigned_driver_kind !== "non_trp" || current.assigned_vehicle_kind !== "non_trp") {
      throw new Error("D-nontrp: kinds not stored as non_trp");
    }
    if (current.assigned_driver_id || current.assigned_vehicle_id) {
      throw new Error("D-nontrp: registered fleet ids must stay empty");
    }
    const driverSnap = parseNonTrpDriverSnapshot(current.assigned_driver_snapshot);
    const vehicleSnap = parseNonTrpVehicleSnapshot(current.assigned_vehicle_snapshot);
    if (!driverSnap || driverSnap.firstName !== "Ahmet" || driverSnap.lastName !== "Kaya") {
      throw new Error("D-nontrp: driver snapshot missing");
    }
    if (!vehicleSnap || vehicleSnap.plate !== "34 ABC 123" || !vehicleSnap.brandModel.includes("Vito")) {
      throw new Error("D-nontrp: vehicle snapshot missing");
    }
    const portalView = await loadPartnerJobAssignment({
      reservationId,
      partnerId: primaryFleet.partner.id,
    });
    if (
      !portalView ||
      portalView.driver.kind !== "non_trp" ||
      portalView.driver.fullName !== "Ahmet Kaya" ||
      portalView.vehicle.kind !== "non_trp" ||
      portalView.vehicle.plate !== "34 ABC 123"
    ) {
      throw new Error("D-nontrp: partner portal view does not match ops NON TRP assignment");
    }
    console.log("D-nontrp ok: Ops NON TRP driver/vehicle match Partner Portal");

    const switchedAway = await assignOpsReservationPartner({
      reservationId,
      partnerId: normalFleet.partner.id,
    });
    if (!switchedAway.ok) {
      throw new Error(`E-nontrp: switch away from Ana Partner failed ${switchedAway.error}`);
    }
    current = await snapshot();
    if (
      current.assigned_driver_kind ||
      current.assigned_vehicle_kind ||
      current.assigned_driver_snapshot ||
      current.assigned_vehicle_snapshot ||
      current.assigned_driver_id ||
      current.assigned_vehicle_id
    ) {
      throw new Error("E-nontrp: NON TRP data remained after partner change");
    }
    const leftoverNonTrp = await assignOpsReservationDriver({
      reservationId,
      selection: NON_TRP_SELECTION,
      fullName: "Ahmet Kaya",
      phoneCountryCode: "TR",
      phoneNational: "5332058219",
      languageCodes: ["tr"],
      notes: "",
    });
    if (leftoverNonTrp.ok || leftoverNonTrp.error !== "forbidden-non-trp") {
      throw new Error("E-nontrp: new partner must not accept NON TRP");
    }
    const ownNormalDriver = await assignOpsReservationDriver({
      reservationId,
      selection: normalFleet.driver.id,
    });
    if (!ownNormalDriver.ok) {
      throw new Error(`E-nontrp: normal partner registered driver failed ${ownNormalDriver.error}`);
    }
    console.log("E-nontrp ok: partner change clears NON TRP and uses new registered pool");

    await assignOpsReservationPartner({
      reservationId,
      partnerId: primaryFleet.partner.id,
    });
    const againDriver = await assignOpsReservationDriver({
      reservationId,
      selection: NON_TRP_SELECTION,
      fullName: "Ahmet Kaya",
      phoneCountryCode: "TR",
      phoneNational: "5332058219",
      languageCodes: ["tr"],
      notes: "to clear",
    });
    const againVehicle = await assignOpsReservationVehicle({
      reservationId,
      selection: NON_TRP_SELECTION,
      plate: "34 ABC 123",
      brandModel: "Mercedes-Benz Vito",
      features: "VIP",
    });
    if (!againDriver.ok || !againVehicle.ok) {
      throw new Error("F-nontrp: could not re-assign NON TRP before remove");
    }
    const removedPrimary = await clearOpsReservationPartner({ reservationId });
    if (!removedPrimary.ok) {
      throw new Error(`F-nontrp: clear primary failed ${removedPrimary.error}`);
    }
    current = await snapshot();
    if (
      current.accepted_partner_id ||
      current.assigned_driver_kind ||
      current.assigned_vehicle_kind ||
      current.assigned_driver_snapshot ||
      current.assigned_vehicle_snapshot
    ) {
      throw new Error("F-nontrp: removing Ana Partner did not clear NON TRP assignment");
    }
    console.log("F-nontrp ok: removing Ana Partner clears NON TRP driver/vehicle");
    console.log("G: UI uses FloatingPopover + pointerdown dismiss (unit-tested)");
    console.log(`DEV assignment scenarios passed on ${code}`);
  } finally {
    await query(`DELETE FROM reservations WHERE id = $1`, [reservationId]);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Failed";
  console.error(message);
  process.exitCode = 1;
});
