import "server-only";

import { istanbulLocalToUtcMs, timestamptzToIstanbulLocal } from "@/lib/booking/istanbul-time";
import { isKnownVehicleCode } from "@/lib/booking/fx/vehicle-totals";
import {
  BABY_SEAT_COUNT_MAX,
  BABY_SEAT_COUNT_MIN,
  LUGGAGE_COUNT_MAX,
  LUGGAGE_COUNT_MIN,
  PASSENGER_COUNT_MAX,
  PASSENGER_COUNT_UNSET,
} from "@/lib/booking/occupancy";
import { PASSENGER_GENDERS } from "@/lib/booking/reservation-search";
import {
  DISPLAY_CURRENCIES,
  isDisplayCurrency,
  normalizeDisplayCurrency,
  type DisplayCurrency,
} from "@/lib/booking/pricing/format-eur";
import { vehicleCardCopyFor } from "@/lib/booking/vehicles/copy";
import { type Locale } from "@/lib/i18n/config";
import { getPool } from "@/lib/db/postgres";
import { type ProcessDetail } from "@/lib/ops/processes";
import { type ReservationDetail } from "@/lib/ops/reservations";
import { diffAuditValues, writeOpsRecordAudits } from "@/lib/ops/record-audit";
import {
  buildCalculatedPriceTotals,
  parseManualPriceTotals,
  type ManualPriceTotals,
  validateManualPriceTotals,
  resolveStoredPriceAmount,
} from "@/lib/ops/price-override";

export type OpsRecordEditPassenger = {
  sequenceNo: number;
  firstName: string;
  lastName: string;
  countryCode: string;
  identityNumber: string;
  gender: "" | "female" | "male";
  isPrimary: boolean;
};

export type OpsRecordEditForm = {
  kind: "process" | "reservation";
  id: string;
  passengers: OpsRecordEditPassenger[];
  pickupDate: string;
  pickupTime: string;
  pickupName: string;
  pickupAddress: string;
  dropoffName: string;
  dropoffAddress: string;
  flightCode: string;
  passengerCount: number;
  luggageCount: number;
  babySeatCount: number;
  meetAndGreet: boolean;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string;
  vehicleCode: string;
  paymentMethod: string;
  currency: DisplayCurrency;
  priceManuallyOverridden: boolean;
  manualPriceTotals: ManualPriceTotals;
  calculatedPriceTotals: ManualPriceTotals;
  fxSnapshot: unknown;
};

export type OpsRecordEditInput = OpsRecordEditForm;

const PAYMENT_METHODS = ["cash", "sbp"] as const;

function splitPickupAt(value: string | null | undefined) {
  const local = value ? timestamptzToIstanbulLocal(value) : "";
  const match = local.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return {
    pickupDate: match?.[1] ?? "",
    pickupTime: match?.[2] ?? "",
  };
}

function buildPassengers(
  items: Array<{
    sequenceNo: number;
    firstName: string | null;
    lastName: string | null;
    countryCode: string | null;
    identityNumber: string | null;
    gender: string | null;
    isPrimary: boolean;
  }>,
): OpsRecordEditPassenger[] {
  return items.map((item) => ({
    sequenceNo: item.sequenceNo,
    firstName: item.firstName?.trim() ?? "",
    lastName: item.lastName?.trim() ?? "",
    countryCode: item.countryCode?.trim() ?? "",
    identityNumber: item.identityNumber?.trim() ?? "",
    gender:
      item.gender === "female" || item.gender === "male" ? item.gender : ("" as const),
    isPrimary: item.isPrimary,
  }));
}

export function processToEditForm(item: ProcessDetail): OpsRecordEditForm {
  const pickupAt = item.appliedPickupAt ?? item.selectedPickupAt;
  const { pickupDate, pickupTime } = splitPickupAt(pickupAt);
  const manualPriceTotals =
    parseManualPriceTotals(item.manualPriceTotals) ??
    buildCalculatedPriceTotals({
      currency: item.currency,
      appliedVehicleTotal: item.appliedVehicleTotal,
      appliedVehicleTotalEur: item.appliedVehicleTotalEur,
      fxSnapshot: item.fxSnapshot,
    });
  return {
    kind: "process",
    id: item.id,
    pickupDate,
    pickupTime,
    pickupName: item.appliedPickup ?? item.selectedPickup ?? "",
    pickupAddress: item.appliedPickupAddress ?? item.selectedPickupAddress ?? "",
    dropoffName: item.appliedDropoff ?? item.selectedDropoff ?? "",
    dropoffAddress: item.appliedDropoffAddress ?? item.selectedDropoffAddress ?? "",
    flightCode: item.appliedFlightCode ?? item.selectedFlightCode ?? "",
    passengerCount: item.appliedPassengerCount ?? item.selectedPassengerCount ?? 1,
    luggageCount: item.appliedLuggageCount ?? item.selectedLuggageCount ?? 0,
    babySeatCount: item.appliedBabySeatCount ?? item.selectedBabySeatCount ?? 0,
    meetAndGreet: item.appliedMeetAndGreet ?? item.selectedMeetAndGreet ?? false,
    customerFirstName: item.customerFirstName?.trim() ?? "",
    customerLastName: item.customerLastName?.trim() ?? "",
    customerEmail: item.email?.trim() ?? "",
    customerPhone: item.phone?.trim() ?? "",
    notes: item.notes?.trim() ?? "",
    vehicleCode: item.appliedVehicleCode ?? item.selectedVehicleCode ?? "",
    paymentMethod: item.paymentMethod?.trim() ?? "",
    currency: normalizeDisplayCurrency(item.currency ?? "USD"),
    priceManuallyOverridden: item.priceManuallyOverridden ?? false,
    manualPriceTotals,
    calculatedPriceTotals: buildCalculatedPriceTotals({
      currency: item.currency,
      appliedVehicleTotal: item.appliedVehicleTotal,
      appliedVehicleTotalEur: item.appliedVehicleTotalEur,
      fxSnapshot: item.fxSnapshot,
    }),
    fxSnapshot: item.fxSnapshot,
    passengers: buildPassengers(item.passengers),
  };
}

export function reservationToEditForm(item: ReservationDetail): OpsRecordEditForm {
  const { pickupDate, pickupTime } = splitPickupAt(item.pickupAt);
  const manualPriceTotals =
    parseManualPriceTotals(item.manualPriceTotals) ??
    buildCalculatedPriceTotals({
      currency: item.currency,
      totalPrice: item.totalPrice,
      fxSnapshot: item.fxSnapshot,
    });
  return {
    kind: "reservation",
    id: item.id,
    pickupDate,
    pickupTime,
    pickupName: item.pickupName ?? "",
    pickupAddress: item.pickupAddress ?? "",
    dropoffName: item.dropoffName ?? "",
    dropoffAddress: item.dropoffAddress ?? "",
    flightCode: item.flightCode ?? "",
    passengerCount: item.passengerCount ?? 1,
    luggageCount: item.luggageCount ?? 0,
    babySeatCount: item.babySeatCount ?? 0,
    meetAndGreet: item.meetAndGreet ?? false,
    customerFirstName: item.customerFirstName?.trim() ?? "",
    customerLastName: item.customerLastName?.trim() ?? "",
    customerEmail: item.customerEmail?.trim() ?? "",
    customerPhone: item.customerPhone?.trim() ?? "",
    notes: item.notes?.trim() ?? "",
    vehicleCode: item.vehicleCode ?? "",
    paymentMethod: item.paymentMethod?.trim() ?? "",
    currency: normalizeDisplayCurrency(item.currency ?? "USD"),
    priceManuallyOverridden: item.priceManuallyOverridden ?? false,
    manualPriceTotals,
    calculatedPriceTotals: buildCalculatedPriceTotals({
      currency: item.currency,
      totalPrice: item.totalPrice,
      fxSnapshot: item.fxSnapshot,
    }),
    fxSnapshot: item.fxSnapshot,
    passengers: buildPassengers(item.passengers),
  };
}

function trimField(value: string, max = 500) {
  return value.trim().slice(0, max);
}

function validateCount(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max;
}

export function validateOpsRecordEditInput(
  input: OpsRecordEditInput & { passengers: OpsRecordEditPassenger[] },
):
  | { ok: true; value: OpsRecordEditInput & { passengers: OpsRecordEditPassenger[] } }
  | { ok: false; reason: string } {
  if (!input.pickupDate || !input.pickupTime) {
    return { ok: false, reason: "pickup-at" };
  }
  const pickupLocal = `${input.pickupDate}T${input.pickupTime}`;
  if (!Number.isFinite(istanbulLocalToUtcMs(pickupLocal))) {
    return { ok: false, reason: "pickup-at" };
  }
  if (!trimField(input.pickupName) || !trimField(input.dropoffName)) {
    return { ok: false, reason: "places" };
  }
  if (
    !validateCount(input.passengerCount, 1, PASSENGER_COUNT_MAX) ||
    !validateCount(input.luggageCount, LUGGAGE_COUNT_MIN, LUGGAGE_COUNT_MAX) ||
    !validateCount(input.babySeatCount, BABY_SEAT_COUNT_MIN, BABY_SEAT_COUNT_MAX)
  ) {
    return { ok: false, reason: "counts" };
  }
  if (!trimField(input.customerFirstName) || !trimField(input.customerLastName)) {
    return { ok: false, reason: "customer" };
  }
  if (!trimField(input.customerEmail) || !trimField(input.customerPhone)) {
    return { ok: false, reason: "contact" };
  }
  if (input.vehicleCode && !isKnownVehicleCode(input.vehicleCode)) {
    return { ok: false, reason: "vehicle" };
  }
  if (input.paymentMethod && !PAYMENT_METHODS.includes(input.paymentMethod as (typeof PAYMENT_METHODS)[number])) {
    return { ok: false, reason: "payment" };
  }
  const currency = normalizeDisplayCurrency(input.currency);
  if (!isDisplayCurrency(currency)) {
    return { ok: false, reason: "currency" };
  }
  let manualTotals: ManualPriceTotals | null = null;
  if (input.priceManuallyOverridden) {
    manualTotals = validateManualPriceTotals(input.manualPriceTotals);
    if (!manualTotals || !manualTotals[currency]) {
      return { ok: false, reason: "price" };
    }
  }
  for (const passenger of input.passengers) {
    if (!trimField(passenger.firstName) || !trimField(passenger.lastName)) {
      return { ok: false, reason: "passenger" };
    }
    if (passenger.gender && !PASSENGER_GENDERS.includes(passenger.gender)) {
      return { ok: false, reason: "passenger" };
    }
  }
  return {
    ok: true,
    value: {
      ...input,
      currency,
      manualPriceTotals: manualTotals ?? input.manualPriceTotals,
      pickupName: trimField(input.pickupName, 300),
      pickupAddress: trimField(input.pickupAddress, 500),
      dropoffName: trimField(input.dropoffName, 300),
      dropoffAddress: trimField(input.dropoffAddress, 500),
      flightCode: trimField(input.flightCode, 32),
      customerFirstName: trimField(input.customerFirstName, 120),
      customerLastName: trimField(input.customerLastName, 120),
      customerEmail: trimField(input.customerEmail, 320),
      customerPhone: trimField(input.customerPhone, 40),
      notes: trimField(input.notes, 2000),
    },
  };
}

function vehicleLabels(code: string, locale: Locale | null) {
  const copy = vehicleCardCopyFor(code, locale === "tr" ? "tr" : locale === "ru" ? "ru" : "en");
  return {
    labelCustomer: copy.title,
    labelTr: vehicleCardCopyFor(code, "tr").title,
  };
}

export async function updateProcessRecord(
  actorId: string,
  before: ProcessDetail,
  input: OpsRecordEditInput & { passengers: OpsRecordEditPassenger[] },
) {
  const validated = validateOpsRecordEditInput(input);
  if (!validated.ok) {
    return { ok: false as const, reason: validated.reason };
  }
  const value = validated.value;
  const pickupAt = new Date(istanbulLocalToUtcMs(`${value.pickupDate}T${value.pickupTime}`));
  const labels = value.vehicleCode ? vehicleLabels(value.vehicleCode, before.locale as Locale) : null;
  const selectedPrice = resolveStoredPriceAmount({
    currency: value.currency,
    appliedVehicleTotal: before.appliedVehicleTotal,
    fxSnapshot: before.fxSnapshot,
    priceManuallyOverridden: value.priceManuallyOverridden,
    manualPriceTotals: value.manualPriceTotals,
  });
  const appliedVehicleTotal = value.priceManuallyOverridden
    ? value.manualPriceTotals[value.currency] ?? selectedPrice.amount
    : before.appliedVehicleTotal;

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const changes = [
      diffAuditValues("pickup_at", before.appliedPickupAt ?? before.selectedPickupAt, pickupAt.toISOString()),
      diffAuditValues("pickup_name", before.appliedPickup, value.pickupName),
      diffAuditValues("pickup_address", before.appliedPickupAddress, value.pickupAddress),
      diffAuditValues("dropoff_name", before.appliedDropoff, value.dropoffName),
      diffAuditValues("dropoff_address", before.appliedDropoffAddress, value.dropoffAddress),
      diffAuditValues("flight_code", before.appliedFlightCode, value.flightCode || null),
      diffAuditValues("passenger_count", before.appliedPassengerCount, value.passengerCount),
      diffAuditValues("luggage_count", before.appliedLuggageCount, value.luggageCount),
      diffAuditValues("baby_seat_count", before.appliedBabySeatCount, value.babySeatCount),
      diffAuditValues("meet_and_greet", before.appliedMeetAndGreet, value.meetAndGreet),
      diffAuditValues("customer_first_name", before.customerFirstName, value.customerFirstName),
      diffAuditValues("customer_last_name", before.customerLastName, value.customerLastName),
      diffAuditValues("customer_email", before.email, value.customerEmail),
      diffAuditValues("customer_phone", before.phone, value.customerPhone),
      diffAuditValues("notes", before.notes, value.notes || null),
      diffAuditValues("vehicle_code", before.appliedVehicleCode, value.vehicleCode || null),
      diffAuditValues("payment_method", before.paymentMethod, value.paymentMethod || null),
      diffAuditValues("currency", before.currency, value.currency),
      diffAuditValues(
        "price",
        before.priceManuallyOverridden
          ? before.manualPriceTotals
          : before.appliedVehicleTotal,
        value.priceManuallyOverridden ? value.manualPriceTotals : appliedVehicleTotal,
      ),
      diffAuditValues("price_manually_overridden", before.priceManuallyOverridden, value.priceManuallyOverridden),
    ].filter((item): item is NonNullable<typeof item> => item !== null);

    await client.query(
      `UPDATE reservation_searches SET
         applied_pickup_at = $2,
         selected_pickup_at = $2,
         applied_pickup_name_customer = $3,
         selected_pickup_name_customer = $3,
         applied_pickup_address_customer = $4,
         selected_pickup_address_customer = $4,
         applied_dropoff_name_customer = $5,
         selected_dropoff_name_customer = $5,
         applied_dropoff_address_customer = $6,
         selected_dropoff_address_customer = $6,
         applied_flight_code = $7,
         selected_flight_code = $7,
         applied_passenger_count = $8,
         selected_passenger_count = $8,
         applied_luggage_count = $9,
         selected_luggage_count = $9,
         applied_baby_seat_count = $10,
         selected_baby_seat_count = $10,
         applied_meet_and_greet = $11,
         selected_meet_and_greet = $11,
         customer_first_name = $12,
         customer_last_name = $13,
         customer_email = $14,
         customer_phone = $15,
         notes = $16,
         applied_vehicle_code = $17,
         selected_vehicle_code = $17,
         applied_vehicle_label_customer = $18,
         selected_vehicle_label_customer = $18,
         applied_vehicle_label_tr = $19,
         selected_vehicle_label_tr = $19,
         payment_method = $20,
         currency = $21,
         price_manually_overridden = $22,
         manual_price_totals = $23,
         applied_vehicle_total = CASE WHEN $22 THEN $24 ELSE applied_vehicle_total END,
         updated_at = NOW()
       WHERE id = $1`,
      [
        before.id,
        pickupAt,
        value.pickupName,
        value.pickupAddress || value.pickupName,
        value.dropoffName,
        value.dropoffAddress || value.dropoffName,
        value.flightCode || null,
        value.passengerCount,
        value.luggageCount,
        value.babySeatCount,
        value.meetAndGreet,
        value.customerFirstName,
        value.customerLastName,
        value.customerEmail,
        value.customerPhone,
        value.notes || null,
        value.vehicleCode || null,
        labels?.labelCustomer ?? before.appliedVehicleLabel,
        labels?.labelTr ?? null,
        value.paymentMethod || null,
        value.currency,
        value.priceManuallyOverridden,
        value.priceManuallyOverridden ? JSON.stringify(value.manualPriceTotals) : null,
        appliedVehicleTotal,
      ],
    );

    for (const passenger of value.passengers) {
      await client.query(
        `UPDATE reservation_searches_passengers SET
           first_name = $3,
           last_name = $4,
           country_code = $5,
           identity_number = $6,
           gender = $7,
           is_primary_passenger = $8,
           updated_at = NOW()
         WHERE reservation_search_id = $1 AND sequence_no = $2`,
        [
          before.id,
          passenger.sequenceNo,
          passenger.firstName,
          passenger.lastName,
          passenger.countryCode || null,
          passenger.identityNumber || null,
          passenger.gender || null,
          passenger.isPrimary,
        ],
      );
    }

    await writeOpsRecordAudits(client, {
      recordKind: "process",
      recordId: before.id,
      changedBy: actorId,
      changes,
    });
    await client.query("COMMIT");
    return { ok: true as const };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateReservationRecord(
  actorId: string,
  before: ReservationDetail,
  input: OpsRecordEditInput & { passengers: OpsRecordEditPassenger[] },
) {
  const validated = validateOpsRecordEditInput(input);
  if (!validated.ok) {
    return { ok: false as const, reason: validated.reason };
  }
  const value = validated.value;
  const pickupAt = new Date(istanbulLocalToUtcMs(`${value.pickupDate}T${value.pickupTime}`));
  const labels = value.vehicleCode ? vehicleLabels(value.vehicleCode, before.locale as Locale) : null;
  const totalPrice = value.priceManuallyOverridden
    ? value.manualPriceTotals[value.currency] ?? before.totalPrice
    : before.totalPrice;
  const preserveSystem =
    value.priceManuallyOverridden &&
    !before.priceManuallyOverridden &&
    before.systemTotalPrice == null;

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const changes = [
      diffAuditValues("pickup_at", before.pickupAt, pickupAt.toISOString()),
      diffAuditValues("pickup_name", before.pickupName, value.pickupName),
      diffAuditValues("pickup_address", before.pickupAddress, value.pickupAddress),
      diffAuditValues("dropoff_name", before.dropoffName, value.dropoffName),
      diffAuditValues("dropoff_address", before.dropoffAddress, value.dropoffAddress),
      diffAuditValues("flight_code", before.flightCode, value.flightCode || null),
      diffAuditValues("passenger_count", before.passengerCount, value.passengerCount),
      diffAuditValues("luggage_count", before.luggageCount, value.luggageCount),
      diffAuditValues("baby_seat_count", before.babySeatCount, value.babySeatCount),
      diffAuditValues("meet_and_greet", before.meetAndGreet, value.meetAndGreet),
      diffAuditValues("customer_first_name", before.customerFirstName, value.customerFirstName),
      diffAuditValues("customer_last_name", before.customerLastName, value.customerLastName),
      diffAuditValues("customer_email", before.customerEmail, value.customerEmail),
      diffAuditValues("customer_phone", before.customerPhone, value.customerPhone),
      diffAuditValues("notes", before.notes, value.notes || null),
      diffAuditValues("vehicle_code", before.vehicleCode, value.vehicleCode || null),
      diffAuditValues("payment_method", before.paymentMethod, value.paymentMethod || null),
      diffAuditValues("currency", before.currency, value.currency),
      diffAuditValues(
        "price",
        before.priceManuallyOverridden ? before.manualPriceTotals : before.totalPrice,
        value.priceManuallyOverridden ? value.manualPriceTotals : totalPrice,
      ),
      diffAuditValues("price_manually_overridden", before.priceManuallyOverridden, value.priceManuallyOverridden),
    ].filter((item): item is NonNullable<typeof item> => item !== null);

    await client.query(
      `UPDATE reservations SET
         pickup_at = $2,
         pickup_name_customer = $3,
         pickup_address_customer = $4,
         dropoff_name_customer = $5,
         dropoff_address_customer = $6,
         flight_code = $7,
         passenger_count = $8,
         luggage_count = $9,
         baby_seat_count = $10,
         meet_and_greet = $11,
         customer_first_name = $12,
         customer_last_name = $13,
         customer_email = $14,
         customer_phone = $15,
         notes = $16,
         vehicle_code = $17,
         vehicle_label_customer = $18,
         vehicle_label_tr = $19,
         payment_method = $20,
         currency = $21,
         total_price = $22,
         price_manually_overridden = $23,
         manual_price_totals = $24,
         system_total_price = CASE WHEN $25 THEN total_price ELSE system_total_price END,
         system_currency = CASE WHEN $25 THEN currency ELSE system_currency END,
         system_fx_snapshot = CASE WHEN $25 THEN fx_snapshot ELSE system_fx_snapshot END,
         updated_at = NOW()
       WHERE id = $1`,
      [
        before.id,
        pickupAt,
        value.pickupName,
        value.pickupAddress || value.pickupName,
        value.dropoffName,
        value.dropoffAddress || value.dropoffName,
        value.flightCode || null,
        value.passengerCount,
        value.luggageCount,
        value.babySeatCount,
        value.meetAndGreet,
        value.customerFirstName,
        value.customerLastName,
        value.customerEmail,
        value.customerPhone,
        value.notes || null,
        value.vehicleCode || null,
        labels?.labelCustomer ?? before.vehicleLabel,
        labels?.labelTr ?? null,
        value.paymentMethod || null,
        value.currency,
        totalPrice,
        value.priceManuallyOverridden,
        value.priceManuallyOverridden ? JSON.stringify(value.manualPriceTotals) : null,
        preserveSystem,
      ],
    );

    for (const passenger of value.passengers) {
      await client.query(
        `UPDATE reservations_passengers SET
           first_name = $3,
           last_name = $4,
           country_code = $5,
           identity_number = $6,
           gender = $7,
           is_primary_passenger = $8,
           updated_at = NOW()
         WHERE reservation_id = $1 AND sequence_no = $2`,
        [
          before.id,
          passenger.sequenceNo,
          passenger.firstName,
          passenger.lastName,
          passenger.countryCode || null,
          passenger.identityNumber || null,
          passenger.gender || null,
          passenger.isPrimary,
        ],
      );
    }

    await writeOpsRecordAudits(client, {
      recordKind: "reservation",
      recordId: before.id,
      changedBy: actorId,
      changes,
    });
    await client.query("COMMIT");
    return { ok: true as const };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
