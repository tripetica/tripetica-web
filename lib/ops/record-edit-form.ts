import { istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";
import { isKnownVehicleCode } from "@/lib/booking/fx/vehicle-totals";
import { isValidEmail } from "@/lib/booking/phone";
import {
  BABY_SEAT_COUNT_MAX,
  BABY_SEAT_COUNT_MIN,
  LUGGAGE_COUNT_MAX,
  LUGGAGE_COUNT_MIN,
  PASSENGER_COUNT_MAX,
  PASSENGER_COUNT_UNSET,
} from "@/lib/booking/occupancy";
import {
  DISPLAY_CURRENCIES,
  isDisplayCurrency,
  normalizeDisplayCurrency,
  type DisplayCurrency,
} from "@/lib/booking/pricing/format-eur";
import {
  normalizeManualAmount,
  validateManualPriceTotals,
  type ManualPriceTotals,
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
const PASSENGER_GENDERS = ["female", "male"] as const;

function trimField(value: string, max = 500) {
  return value.trim().slice(0, max);
}

function validateCount(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function passengerIsBlank(passenger: OpsRecordEditPassenger) {
  return (
    !trimField(passenger.firstName) &&
    !trimField(passenger.lastName) &&
    !trimField(passenger.countryCode) &&
    !trimField(passenger.identityNumber) &&
    !passenger.gender
  );
}

function normalizeTotals(totals: ManualPriceTotals): ManualPriceTotals {
  const next: ManualPriceTotals = {};
  for (const code of DISPLAY_CURRENCIES) {
    const amount = totals[code];
    if (amount == null || String(amount).trim() === "") {
      continue;
    }
    const normalized = normalizeManualAmount(String(amount));
    if (normalized) {
      next[code] = normalized;
    }
  }
  return next;
}

export function canonicalizeOpsRecordEdit(input: OpsRecordEditInput): string {
  const passengers = [...input.passengers]
    .map((passenger) => ({
      sequenceNo: passenger.sequenceNo,
      firstName: trimField(passenger.firstName, 120),
      lastName: trimField(passenger.lastName, 120),
      countryCode: trimField(passenger.countryCode, 8),
      identityNumber: trimField(passenger.identityNumber, 64),
      gender: passenger.gender,
      isPrimary: passenger.isPrimary,
    }))
    .sort((a, b) => a.sequenceNo - b.sequenceNo);
  return JSON.stringify({
    kind: input.kind,
    id: input.id,
    pickupDate: input.pickupDate,
    pickupTime: input.pickupTime,
    pickupName: trimField(input.pickupName, 300),
    pickupAddress: trimField(input.pickupAddress, 500),
    dropoffName: trimField(input.dropoffName, 300),
    dropoffAddress: trimField(input.dropoffAddress, 500),
    flightCode: trimField(input.flightCode, 32),
    passengerCount: input.passengerCount,
    luggageCount: input.luggageCount,
    babySeatCount: input.babySeatCount,
    meetAndGreet: input.meetAndGreet,
    customerFirstName: trimField(input.customerFirstName, 120),
    customerLastName: trimField(input.customerLastName, 120),
    customerEmail: trimField(input.customerEmail, 320),
    customerPhone: trimField(input.customerPhone, 40),
    notes: trimField(input.notes, 2000),
    vehicleCode: input.vehicleCode,
    paymentMethod: input.paymentMethod,
    currency: normalizeDisplayCurrency(input.currency),
    priceManuallyOverridden: input.priceManuallyOverridden,
    manualPriceTotals: normalizeTotals(input.manualPriceTotals),
    passengers,
  });
}

export function isOpsRecordEditDirty(
  current: OpsRecordEditInput,
  original: OpsRecordEditInput,
) {
  return canonicalizeOpsRecordEdit(current) !== canonicalizeOpsRecordEdit(original);
}

export type OpsDetailToolbarMode = "detail" | "edit-clean" | "edit-dirty";

export function opsDetailToolbarMode(input: {
  editing: boolean;
  dirty: boolean;
}): OpsDetailToolbarMode {
  if (!input.editing) {
    return "detail";
  }
  return input.dirty ? "edit-dirty" : "edit-clean";
}

export function opsProcessToolbarActions(mode: OpsDetailToolbarMode) {
  return {
    downloadPdf: mode === "detail",
    edit: mode === "detail",
    saveChanges: mode === "edit-dirty",
  };
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
  const minPassengers =
    input.kind === "process" ? PASSENGER_COUNT_UNSET : 1;
  if (
    !validateCount(input.passengerCount, minPassengers, PASSENGER_COUNT_MAX) ||
    !validateCount(input.luggageCount, LUGGAGE_COUNT_MIN, LUGGAGE_COUNT_MAX) ||
    !validateCount(input.babySeatCount, BABY_SEAT_COUNT_MIN, BABY_SEAT_COUNT_MAX)
  ) {
    return { ok: false, reason: "counts" };
  }
  const customerFirst = trimField(input.customerFirstName, 120);
  const customerLast = trimField(input.customerLastName, 120);
  const customerEmail = trimField(input.customerEmail, 320);
  const customerPhone = trimField(input.customerPhone, 40);
  if (input.kind === "reservation") {
    if (!customerFirst || !customerLast) {
      return { ok: false, reason: "customer" };
    }
    if (!customerEmail || !customerPhone) {
      return { ok: false, reason: "contact" };
    }
  }
  if (customerEmail && !isValidEmail(customerEmail)) {
    return { ok: false, reason: "contact" };
  }
  if (input.vehicleCode && !isKnownVehicleCode(input.vehicleCode)) {
    return { ok: false, reason: "vehicle" };
  }
  if (
    input.paymentMethod &&
    !PAYMENT_METHODS.includes(input.paymentMethod as (typeof PAYMENT_METHODS)[number])
  ) {
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
    if (input.kind === "process" && passengerIsBlank(passenger)) {
      continue;
    }
    if (!trimField(passenger.firstName) || !trimField(passenger.lastName)) {
      return { ok: false, reason: "passenger" };
    }
    if (
      passenger.gender &&
      !PASSENGER_GENDERS.includes(passenger.gender as (typeof PASSENGER_GENDERS)[number])
    ) {
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
      customerFirstName: customerFirst,
      customerLastName: customerLast,
      customerEmail,
      customerPhone,
      notes: trimField(input.notes, 2000),
    },
  };
}
