import { isAirportPickup } from "@/lib/booking/occupancy";
import {
  formatHourlyPackageCoverage,
  formatHourlyPackageOverrunNote,
  hourlyKmOverrunNote,
} from "@/lib/booking/catalog";
import { bosphorusDinnerCopy } from "@/lib/booking/bosphorus-dinner-copy";
import { isBosphorusDinnerTour } from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import {
  parseReservationServiceSnapshot,
  type ReservationServiceContent,
} from "@/lib/booking/reservation-service-snapshot";
import {
  shouldShowDistance,
  shouldShowDropoff,
} from "@/lib/booking/reservation-output-visibility";
import { isLayoverTour } from "@/lib/booking/pricing/layover-pricing";
import { isFullDayTour } from "@/lib/booking/pricing/full-day-pricing";
import { isHalfDayTour } from "@/lib/booking/pricing/half-day-pricing";
import { isBursaTour } from "@/lib/booking/pricing/bursa-pricing";
import { isSapancaTour } from "@/lib/booking/pricing/sapanca-pricing";
import {
  bookingServiceDisplayLabel,
  formatPackageCoverageForTour,
  packageOverrunNoteForTour,
} from "@/lib/booking/tour-display";
import { countryName } from "@/lib/geo/countries";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { type OpsCopy } from "@/lib/ops/copy";
import { partnerLevelLabel } from "@/lib/ops/partner-labels";
import { formatPartnerFleetPhone } from "@/lib/partner/fleet-view";
import {
  emptyDriverAssignment,
  emptyVehicleAssignment,
  formatAssignmentVehicleName,
  formatDriverLanguagesDisplay,
} from "@/lib/partner/job-assignment-view";
import { partnerVehicleClassLabel } from "@/lib/partner/vehicle-class";
import { formatOpsDateTime, formatOpsDistance, formatOpsDuration } from "@/lib/ops/format";
import { timestamptzToIstanbulLocal } from "@/lib/booking/istanbul-time";
import {
  BUSINESS_MINIVAN_CODE,
  BUS_CODE,
  FIRST_CLASS_MINIVAN_CODE,
  FIRST_CLASS_SEDAN_CODE,
  MIDIBUS_CODE,
  MINIBUS_CODE,
  PREMIUM_ECONOMY_SEDAN_CODE,
  STANDARD_MINIVAN_CODE,
} from "@/lib/booking/pricing/vehicle-quote";
import { vehicleCardCopyFor } from "@/lib/booking/vehicles/copy";
import { priceFields, reservationPriceDisplay } from "@/lib/ops/reservation-price-display";
import { evaluateOpsCancelPolicy } from "@/lib/ops/cancellation-policy";
import { evaluateOpsRefundGate, isActiveRefundStatus } from "@/lib/ops/refund-gate";
import { ONLINE_PAYMENT_METHOD } from "@/lib/payments/online-payment";
import { passengerNoteText } from "@/lib/booking/passenger-note";

export { passengerNoteText };

const KNOWN_OPS_VEHICLE_CODES = new Set([
  PREMIUM_ECONOMY_SEDAN_CODE,
  STANDARD_MINIVAN_CODE,
  BUSINESS_MINIVAN_CODE,
  FIRST_CLASS_MINIVAN_CODE,
  FIRST_CLASS_SEDAN_CODE,
  MINIBUS_CODE,
  MIDIBUS_CODE,
  BUS_CODE,
]);

export function opsVehicleLabelFor(
  vehicleCode: string | null | undefined,
  locale: Locale,
): string | null {
  const code = vehicleCode?.trim();
  if (!code || !KNOWN_OPS_VEHICLE_CODES.has(code)) {
    return null;
  }
  return vehicleCardCopyFor(code, locale).title;
}

export type OpsDetailRow = {
  label: string;
  value: string;
  note?: string;
  emphasizeValue?: boolean;
  /** Slightly stronger amount emphasis in ops reservation UI (selected price). */
  strongAmount?: boolean;
};

export type OpsDetailPlace = {
  label: string;
  name: string;
  address: string;
};

export type OpsDetailPassenger = {
  sequenceNo: number;
  firstName: string;
  lastName: string;
  nationality: string;
  gender: string;
  identity: string;
  isPrimary: string;
};

export type OpsRecordDetail = {
  kind: "process" | "reservation";
  id: string;
  brand: string;
  title: string;
  code: string | null;
  status: string | null;
  pdfHref: string;
  pdfFilename: string;
  voucherPdfHref: string | null;
  voucherPdfFilename: string | null;
  summary: OpsDetailRow[];
  service: OpsDetailRow[];
  transfer: OpsDetailRow[];
  places: OpsDetailPlace[];
  /** PDF-only: show meet & greet when pickup is an airport. */
  pickupIsAirport: boolean;
  vehicle: OpsDetailRow[];
  selectedPrice: string | null;
  otherCurrencies: string[];
  pricing: OpsDetailRow[];
  customer: OpsDetailRow[];
  /** Passenger-written booking note. Null when empty — do not render a section. */
  passengerNote: string | null;
  passengers: OpsDetailPassenger[];
  technical: OpsDetailRow[] | null;
  /** Reservation-only context for cancel/refund toolbar actions. */
  actionContext: OpsReservationActionContext | null;
  /** Online payment ledger history for ops UI (not PDF). */
  paymentHistory: import("@/lib/ops/payment-history").OpsPaymentHistorySection | null;
  operationAssignment: {
    partner: OpsDetailRow[];
    driver: OpsDetailRow[];
    vehicle: OpsDetailRow[];
  } | null;
  driverTask: {
    stage: import("@/lib/ops/driver-task-stages").DriverTaskStage;
    openPath: string;
    events: Array<{
      stage: import("@/lib/ops/driver-task-stages").DriverTaskProgressStage;
      occurredAt: string;
      eventSource: import("@/lib/ops/driver-task-stages").DriverTaskEventSource;
    }>;
    showPriceInfo: boolean;
    showPassengerContact: boolean;
  } | null;
};

export type OpsCancelDialogKind =
  | "generic"
  | "bosphorus-within"
  | "bosphorus-outside"
  | "late-window";

export type OpsRefundDialogKind =
  | "blocked-not-cancelled"
  | "blocked-cash"
  | "blocked-not-paid"
  | "blocked-already"
  | "confirm-normal"
  | "confirm-override";

export type OpsReservationActionContext = {
  cancelled: boolean;
  cancelDialog: OpsCancelDialogKind;
  /**
   * True when remainingTime > 6h (customer mutation window still open).
   * False when ≤6h — ops may continue after explicit confirmation.
   * Null when pickup unknown.
   */
  mutationWindowOpen: boolean | null;
  refundButton: "hidden" | "disabled-cash" | "enabled";
  refundDialog: OpsRefundDialogKind | null;
  paymentAmountDisplay: string | null;
  paymentCurrencyDisplay: string | null;
  adminOverrideRequired: boolean;
};

export type ProcessDetailSource = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: string | null;
  currentStage: string | null;
  locale: string | null;
  serviceType: string | null;
  converted: boolean;
  reservationCode: string | null;
  tourCode: string | null;
  pickupAirportCode: string | null;
  pickupLocationType: string | null;
  pickupPlaceId: string | null;
  selectedPickup: string | null;
  appliedPickup: string | null;
  selectedPickupAddress: string | null;
  appliedPickupAddress: string | null;
  selectedDropoff: string | null;
  appliedDropoff: string | null;
  selectedDropoffAddress: string | null;
  appliedDropoffAddress: string | null;
  selectedPickupAt: string | null;
  appliedPickupAt: string | null;
  selectedPassengerCount: number | null;
  appliedPassengerCount: number | null;
  selectedLuggageCount: number | null;
  appliedLuggageCount: number | null;
  selectedBabySeatCount: number | null;
  appliedBabySeatCount: number | null;
  selectedFlightCode: string | null;
  appliedFlightCode: string | null;
  selectedMeetAndGreet: boolean | null;
  appliedMeetAndGreet: boolean | null;
  selectedDistanceKm: string | null;
  appliedDistanceKm: string | null;
  selectedDurationHours: string | null;
  appliedDurationHours: string | null;
  selectedBursaRoute: string | null;
  appliedBursaRoute: string | null;
  selectedVehicleCode: string | null;
  appliedVehicleCode: string | null;
  selectedVehicleLabel: string | null;
  appliedVehicleLabel: string | null;
  selectedPrice: string | null;
  appliedPrice: string | null;
  appliedVehicleTotal: string | null;
  appliedVehicleTotalEur: string | null;
  currency: string | null;
  paymentMethod: string | null;
  transferQuote: unknown;
  fxSnapshot: unknown;
  priceManuallyOverridden: boolean;
  manualPriceTotals: unknown;
  customerFirstName: string | null;
  customerLastName: string | null;
  email: string | null;
  phone: string | null;
  customerCountryCode: string | null;
  notes: string | null;
  deviceType: string | null;
  osName: string | null;
  osVersion: string | null;
  browserName: string | null;
  browserVersion: string | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  screenWidth: number | null;
  screenHeight: number | null;
  browserLanguage: string | null;
  clientTimezone: string | null;
  passengers: Array<{
    sequenceNo: number;
    firstName: string | null;
    lastName: string | null;
    countryCode: string | null;
    identityNumber: string | null;
    gender: string | null;
    isPrimary: boolean;
  }>;
};

export type ReservationDetailSource = {
  id: string;
  reservationCode: string;
  createdAt: string;
  updatedAt: string | null;
  status: string;
  locale: string | null;
  serviceType: string | null;
  tourCode: string | null;
  pickupAirportCode: string | null;
  pickupLocationType: string | null;
  pickupPlaceId: string | null;
  pickupAt: string | null;
  pickupName: string | null;
  pickupAddress: string | null;
  dropoffName: string | null;
  dropoffAddress: string | null;
  distanceKm: string | null;
  passengerCount: number | null;
  luggageCount: number | null;
  babySeatCount: number | null;
  flightCode: string | null;
  meetAndGreet: boolean | null;
  durationHours: string | null;
  bursaRoute: string | null;
  serviceContentSnapshot?: unknown;
  vehicleCode: string | null;
  vehicleLabel: string | null;
  totalPrice: string | null;
  currency: string | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  paymentAmount: string | null;
  paymentCurrency: string | null;
  paymentProvider: string | null;
  paymentProviderOrderId: string | null;
  refundStatus: string | null;
  refundAmount: string | null;
  refundCurrency: string | null;
  refundAdminOverride: boolean;
  refundRequestedAt: string | null;
  refundCompletedAt: string | null;
  refundProviderRefundId: string | null;
  financeGross: string | null;
  financeNet: string | null;
  financeCompletedRefunds: string | null;
  financePendingRefunds: string | null;
  paymentHistoryLines: string[] | null;
  paymentHistory: import("@/lib/ops/payment-history").OpsPaymentHistorySection | null;
  fxSnapshot: unknown;
  priceManuallyOverridden: boolean;
  manualPriceTotals: unknown;
  systemTotalPrice: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerCountryCode: string | null;
  notes: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  acceptedPartnerName?: string | null;
  acceptedPartnerCode?: string | null;
  acceptedPartnerIsPrimary?: boolean;
  acceptedPartnerPriorityLevel?: number | null;
  driverAssignment?: import("@/lib/partner/job-assignment-view").JobDriverAssignmentView;
  vehicleAssignment?: import("@/lib/partner/job-assignment-view").JobVehicleAssignmentView;
  passengers: Array<{
    sequenceNo: number;
    firstName: string | null;
    lastName: string | null;
    countryCode: string | null;
    identityNumber: string | null;
    gender: string | null;
    isPrimary: boolean;
  }>;
  driverTask?: import("@/lib/ops/driver-task").DriverTaskOpsView | null;
};

export function displayText(value: unknown): string {
  if (value === null || value === undefined || typeof value === "boolean") {
    return "";
  }
  const text = String(value).trim();
  if (!text || text === "null" || text === "undefined") {
    return "";
  }
  return text;
}

export function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = displayText(value);
    if (text) {
      return text;
    }
  }
  return "";
}

function row(label: string, value: string, note?: string): OpsDetailRow | null {
  return value ? { label, value, note } : null;
}

function withPackageOverrunNote(
  rows: OpsDetailRow[],
  locale: Locale,
  tourCode: string | null | undefined,
): OpsDetailRow[] {
  if (rows.length === 0) {
    return rows;
  }
  const note = packageOverrunNoteForTour(tourCode, locale);
  if (!note) {
    return rows;
  }
  const last = rows[rows.length - 1]!;
  return [
    ...rows.slice(0, -1),
    { ...last, note },
  ];
}

function withHourlyKmOverrunNote(
  rows: OpsDetailRow[],
  locale: Locale,
): OpsDetailRow[] {
  if (rows.length === 0) {
    return rows;
  }
  const last = rows[rows.length - 1]!;
  return [
    ...rows.slice(0, -1),
    { ...last, note: hourlyKmOverrunNote[locale] },
  ];
}

function compact(rows: Array<OpsDetailRow | null>): OpsDetailRow[] {
  return rows.filter((item): item is OpsDetailRow => item !== null);
}

function dashRow(label: string, value: string | null | undefined, empty: string): OpsDetailRow {
  const text = value?.trim();
  return { label, value: text || empty };
}

function reservationOperationAssignment(
  item: ReservationDetailSource,
  locale: Locale,
  copy: OpsCopy,
) {
  const empty = copy.assignmentUnassigned;
  const driver = item.driverAssignment ?? emptyDriverAssignment();
  const vehicle = item.vehicleAssignment ?? emptyVehicleAssignment();
  const partnerName = item.acceptedPartnerName?.trim() || "";
  const partnerRows = partnerName
    ? compact([
        row(copy.partnerCode, displayText(item.acceptedPartnerCode)),
        row(copy.partnerLegalName, partnerName),
        row(
          copy.partnerLevel,
          partnerLevelLabel(
            {
              isPrimaryPartner: Boolean(item.acceptedPartnerIsPrimary),
              priorityLevel: (item.acceptedPartnerPriorityLevel ?? null) as 1 | 2 | 3 | null,
            },
            copy,
          ),
        ),
      ])
    : [dashRow(copy.partnerLegalName, null, empty)];
  const driverKind = !driver.kind
    ? empty
    : driver.kind === "non_trp"
      ? copy.assignmentNonTrp
      : copy.assignmentRegistered;
  const driverRows = !driver.kind
    ? [dashRow(copy.assignmentDriver, null, empty)]
    : compact([
        row(copy.assignmentKind, driverKind),
        row(copy.driverFullName, displayText(driver.fullName)),
        row(copy.phone, driver.phone ? formatPartnerFleetPhone(driver.phone) : ""),
        driver.languageCodes.length
          ? row(copy.driverLanguages, formatDriverLanguagesDisplay(driver.languageCodes, locale))
          : null,
        row(copy.notes, displayText(driver.notes)),
      ]);
  const vehicleKind = !vehicle.kind
    ? empty
    : vehicle.kind === "non_trp"
      ? copy.assignmentNonTrp
      : copy.assignmentRegistered;
  const vehicleRows = !vehicle.kind
    ? [dashRow(copy.assignmentVehicle, null, empty)]
    : vehicle.kind === "non_trp"
      ? compact([
          row(copy.assignmentKind, vehicleKind),
          row(copy.vehiclePlate, displayText(vehicle.plate)),
          row(
            copy.vehicleBrandModel,
            formatAssignmentVehicleName(vehicle.brand, vehicle.model),
          ),
          row(
            copy.vehicleFeatures,
            displayText(vehicle.features) || displayText(vehicle.notes),
          ),
        ])
      : compact([
          row(copy.assignmentKind, vehicleKind),
          row(copy.vehiclePlate, displayText(vehicle.plate)),
          row(copy.vehicleBrand, displayText(vehicle.brand)),
          row(copy.vehicleModel, displayText(vehicle.model)),
          vehicle.modelYear != null ? row(copy.vehicleModelYear, String(vehicle.modelYear)) : null,
          vehicle.vehicleClassCode
            ? row(copy.vehicleClass, partnerVehicleClassLabel(vehicle.vehicleClassCode, locale))
            : null,
          vehicle.passengerCapacity != null
            ? row(copy.vehiclePassengers, String(vehicle.passengerCapacity))
            : null,
          vehicle.luggageCapacity != null
            ? row(copy.vehicleLuggage, String(vehicle.luggageCapacity))
            : null,
          row(copy.vehicleFeatures, displayText(vehicle.features)),
        ]);
  return {
    partner: partnerRows,
    driver: driverRows,
    vehicle: vehicleRows,
  };
}

function yn(value: boolean | null | undefined, copy: OpsCopy) {
  if (value === true) {
    return copy.yes;
  }
  if (value === false) {
    return copy.no;
  }
  return "";
}

function joined(parts: Array<string | null | undefined>) {
  return parts.map((part) => displayText(part)).filter(Boolean).join(" ");
}

export function statusLabel(value: string | null | undefined, copy: OpsCopy) {
  const raw = displayText(value);
  if (raw === "draft") {
    return copy.statusDraft;
  }
  if (raw === "completed") {
    return copy.statusCompleted;
  }
  if (raw === "expired") {
    return copy.statusExpired;
  }
  if (raw === "confirmed") {
    return copy.statusConfirmed;
  }
  if (raw === "cancelled") {
    return copy.statusCancelled;
  }
  return raw;
}

export function reservationStatusLabel(
  value: string | null | undefined,
  copy: OpsCopy,
) {
  const raw = displayText(value);
  if (raw === "cancelled") {
    return copy.reservationStatusCancelled;
  }
  // confirmed, payment_pending, and other non-cancelled reservation states → Active
  if (raw === "confirmed" || raw === "payment_pending" || raw) {
    return copy.reservationStatusActive;
  }
  return statusLabel(value, copy);
}

export function reservationStatusBadgeClass(status: string | null | undefined) {
  return displayText(status) === "cancelled" ? "is-cancelled" : "is-active";
}

export function isReservationCancelled(status: string | null | undefined) {
  return displayText(status) === "cancelled";
}

export function buildReservationActionContext(
  item: {
    status: string;
    serviceType: string | null;
    tourCode: string | null;
    pickupAt: string | null;
    paymentMethod: string | null;
    paymentStatus: string | null;
    paymentProvider: string | null;
    paymentProviderOrderId: string | null;
    paymentAmount: string | null;
    paymentCurrency: string | null;
    refundStatus: string | null;
  },
  nowUtcMs = Date.now(),
): OpsReservationActionContext {
  const cancelled = isReservationCancelled(item.status);
  const policy = evaluateOpsCancelPolicy({
    serviceType: item.serviceType,
    tourCode: item.tourCode,
    pickupAt: item.pickupAt,
    nowUtcMs,
  });
  const mutationWindowOpen = policy.withinRefundWindow;

  let cancelDialog: OpsCancelDialogKind = "generic";
  if (mutationWindowOpen === false) {
    cancelDialog = "late-window";
  } else if (policy.kind === "bosphorus-dinner") {
    cancelDialog = "bosphorus-within";
  }

  const amount = displayText(item.paymentAmount) || null;
  const currency = displayText(item.paymentCurrency) || null;
  const paymentAmountDisplay =
    amount && currency ? `${amount} ${currency}` : null;

  const method = displayText(item.paymentMethod);
  if (method === "cash") {
    return {
      cancelled,
      cancelDialog,
      mutationWindowOpen,
      refundButton: "disabled-cash",
      refundDialog: "blocked-cash",
      paymentAmountDisplay,
      paymentCurrencyDisplay: currency,
      adminOverrideRequired: false,
    };
  }

  if (method !== ONLINE_PAYMENT_METHOD) {
    return {
      cancelled,
      cancelDialog,
      mutationWindowOpen,
      refundButton: "hidden",
      refundDialog: null,
      paymentAmountDisplay,
      paymentCurrencyDisplay: currency,
      adminOverrideRequired: false,
    };
  }

  if (!cancelled) {
    return {
      cancelled,
      cancelDialog,
      mutationWindowOpen,
      refundButton: "enabled",
      refundDialog: "blocked-not-cancelled",
      paymentAmountDisplay,
      paymentCurrencyDisplay: currency,
      adminOverrideRequired: false,
    };
  }

  if (isActiveRefundStatus(item.refundStatus)) {
    return {
      cancelled,
      cancelDialog,
      mutationWindowOpen,
      refundButton: "enabled",
      refundDialog: "blocked-already",
      paymentAmountDisplay,
      paymentCurrencyDisplay: currency,
      adminOverrideRequired: false,
    };
  }

  const gate = evaluateOpsRefundGate({
    status: item.status,
    paymentMethod: item.paymentMethod,
    paymentStatus: item.paymentStatus,
    paymentProvider: item.paymentProvider,
    paymentProviderOrderId: item.paymentProviderOrderId,
    paymentAmount: item.paymentAmount,
    paymentCurrency: item.paymentCurrency,
    refundStatus: item.refundStatus,
    serviceType: item.serviceType,
    tourCode: item.tourCode,
    pickupAt: item.pickupAt,
    nowUtcMs,
  });

  if (!gate.ok) {
    const refundDialog: OpsRefundDialogKind =
      gate.reason === "cash"
        ? "blocked-cash"
        : gate.reason === "already-refunded"
          ? "blocked-already"
          : gate.reason === "not-cancelled"
            ? "blocked-not-cancelled"
            : "blocked-not-paid";
    return {
      cancelled,
      cancelDialog,
      mutationWindowOpen,
      refundButton: "enabled",
      refundDialog,
      paymentAmountDisplay,
      paymentCurrencyDisplay: currency,
      adminOverrideRequired: false,
    };
  }

  return {
    cancelled,
    cancelDialog,
    mutationWindowOpen,
    refundButton: "enabled",
    refundDialog: gate.adminOverride ? "confirm-override" : "confirm-normal",
    paymentAmountDisplay,
    paymentCurrencyDisplay: currency,
    adminOverrideRequired: gate.adminOverride,
  };
}

export function stageLabel(value: string | null | undefined, copy: OpsCopy) {
  const raw = displayText(value);
  if (raw === "vehicle_selection") {
    return copy.stageVehicleSelection;
  }
  if (raw === "checkout") {
    return copy.stageCheckout;
  }
  return raw;
}

export function serviceLabel(
  value: string | null | undefined,
  copy: OpsCopy,
  options?: { tourCode?: string | null; locale?: Locale },
) {
  if (options?.locale) {
    return bookingServiceDisplayLabel(value, options.tourCode, options.locale);
  }
  const raw = displayText(value);
  if (raw === "transfer") {
    return copy.serviceTransfer;
  }
  if (raw === "hourly") {
    return copy.serviceHourly;
  }
  if (raw === "tour") {
    return copy.serviceTour;
  }
  return raw;
}

export function isPackageTourServiceType(
  value: string | null | undefined,
  tourCode: string | null | undefined,
) {
  return isLayoverTour(value, tourCode) || isHalfDayTour(value, tourCode) || isFullDayTour(value, tourCode) || isSapancaTour(value, tourCode) || isBursaTour(value, tourCode);
}

export function isLayoverServiceType(
  value: string | null | undefined,
  tourCode: string | null | undefined,
) {
  return isLayoverTour(value, tourCode);
}

export function isHourlyServiceType(value: string | null | undefined) {
  return displayText(value) === "hourly";
}

export function isTransferServiceType(value: string | null | undefined) {
  const raw = displayText(value);
  return raw === "" || raw === "transfer";
}

export function paymentLabel(value: string | null | undefined, copy: OpsCopy) {
  const raw = displayText(value);
  if (raw === "cash") {
    return copy.paymentCash;
  }
  if (raw === "sbp") {
    return copy.paymentOnlineSbp;
  }
  return raw;
}

export function paymentProviderLabel(value: string | null | undefined) {
  const raw = displayText(value);
  if (!raw) {
    return "—";
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function paymentStatusLabel(
  paymentMethod: string | null | undefined,
  paymentStatus: string | null | undefined,
  copy: OpsCopy,
) {
  if (displayText(paymentMethod) !== "sbp") {
    return "—";
  }
  const raw = displayText(paymentStatus);
  if (raw === "pending") {
    return copy.paymentStatusPending;
  }
  if (raw === "paid") {
    return copy.paymentStatusPaid;
  }
  if (raw === "failed") {
    return copy.paymentStatusFailed;
  }
  return raw || "—";
}

export function paymentStatusBadgeClass(
  paymentMethod: string | null | undefined,
  paymentStatus: string | null | undefined,
) {
  if (displayText(paymentMethod) !== "sbp") {
    return "";
  }
  const raw = displayText(paymentStatus);
  if (raw === "pending") {
    return "is-pending";
  }
  if (raw === "paid") {
    return "is-active";
  }
  if (raw === "failed") {
    return "is-cancelled";
  }
  return "";
}

export function refundStatusLabel(
  paymentMethod: string | null | undefined,
  refundStatus: string | null | undefined,
  copy: OpsCopy,
) {
  if (displayText(paymentMethod) !== "sbp") {
    return "—";
  }
  const raw = displayText(refundStatus);
  if (!raw) {
    return copy.refundStatusNone;
  }
  if (raw === "submitted") {
    return copy.refundStatusSubmitted;
  }
  if (raw === "completed") {
    return copy.refundStatusCompleted;
  }
  if (raw === "failed") {
    return copy.refundStatusFailed;
  }
  return raw;
}

export function refundStatusBadgeClass(refundStatus: string | null | undefined) {
  const raw = displayText(refundStatus);
  if (raw === "submitted") {
    return "is-pending";
  }
  if (raw === "completed") {
    return "is-active";
  }
  if (raw === "failed") {
    return "is-cancelled";
  }
  return "";
}

export function genderLabel(value: string | null | undefined, copy: OpsCopy) {
  const raw = displayText(value);
  if (raw === "female") {
    return copy.genderFemale;
  }
  if (raw === "male") {
    return copy.genderMale;
  }
  return raw;
}

export function localeLabel(value: string | null | undefined, copy: OpsCopy) {
  const raw = displayText(value);
  if (raw === "tr") {
    return copy.localeTr;
  }
  if (raw === "en") {
    return copy.localeEn;
  }
  if (raw === "ru") {
    return copy.localeRu;
  }
  return raw;
}

function dateText(value: string | null | undefined, locale: Locale) {
  if (!displayText(value)) {
    return "";
  }
  const formatted = formatOpsDateTime(value ?? null, locale);
  return formatted === "—" ? "" : formatted;
}

function countText(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  return String(value);
}

function currentAndSelected(
  label: string,
  selectedLabel: string,
  applied: unknown,
  selected: unknown,
) {
  const current = firstText(applied, selected);
  const selectedText = displayText(selected);
  const appliedText = displayText(applied);
  const rows = [row(label, current)];
  if (appliedText && selectedText && appliedText !== selectedText) {
    rows.push(row(`${selectedLabel} · ${label}`, selectedText));
  }
  return compact(rows);
}

function mapPassengers(
  items: ProcessDetailSource["passengers"],
  locale: Locale,
  copy: OpsCopy,
  emptyIdentityFallback = "—",
): OpsDetailPassenger[] {
  return items.map((item) => ({
    sequenceNo: item.sequenceNo,
    firstName: displayText(item.firstName) || "—",
    lastName: displayText(item.lastName) || "—",
    nationality: countryName(item.countryCode, locale) || displayText(item.countryCode) || "—",
    gender: genderLabel(item.gender, copy) || "—",
    identity: displayText(item.identityNumber) || emptyIdentityFallback,
    isPrimary: item.isPrimary ? copy.yes : copy.no,
  }));
}

function reservationVehicleRow(
  item: ReservationDetailSource,
  locale: Locale,
  copy: OpsCopy,
  snapshottedSubtitle?: string | null,
): OpsDetailRow | null {
  const localizedTitle = opsVehicleLabelFor(item.vehicleCode, locale);
  const title = localizedTitle || displayText(item.vehicleCode);
  if (!title) {
    return null;
  }
  const example =
    snapshottedSubtitle ??
    (item.vehicleCode?.trim() ?
      vehicleCardCopyFor(item.vehicleCode.trim(), locale).example
    : "");
  return {
    label: copy.vehicle,
    value: title,
    note: example || undefined,
    emphasizeValue: true,
  };
}

function place(
  label: string,
  appliedName: string | null,
  appliedAddress: string | null,
  selectedName: string | null,
  selectedAddress: string | null,
): OpsDetailPlace | null {
  const name = firstText(appliedName, selectedName);
  const address = firstText(appliedAddress, selectedAddress);
  if (!name && !address) {
    return null;
  }
  return {
    label,
    name,
    address: address && address !== name ? address : "",
  };
}

export function processPdfFilename(createdAt: string) {
  const local = timestamptzToIstanbulLocal(createdAt).replace("T", "").replace(/[-:]/g, "");
  const stamp = local.slice(0, 12) || "kayit";
  return `Tripetica-Rezervasyon-Sureci-${stamp}.pdf`;
}

export function reservationPdfFilename(code: string) {
  const safe = code.replace(/[^A-Za-z0-9-]/g, "");
  return `TripeticaOps-${safe || "Rezervasyon"}.pdf`;
}

export function reservationVoucherPdfFilename(code: string) {
  const safe = code.replace(/[^A-Za-z0-9-]/g, "");
  return `Tripetica-Voucher-${safe || "Rezervasyon"}.pdf`;
}

export function isOpsContactRow(label: string, copy: OpsCopy) {
  return label === copy.email || label === copy.phone;
}

export function isOpsPricingRow(label: string, copy: OpsCopy) {
  return label === copy.selectedPrice;
}

export function opsTransferRowsForDisplay(
  rows: OpsRecordDetail["transfer"],
  copy: OpsCopy,
  includePricing: boolean,
) {
  if (includePricing) {
    return rows;
  }
  return rows.filter((item) => !isOpsPricingRow(item.label, copy));
}

export { reservationPriceDisplay };

export function toProcessRecordDetail(
  item: ProcessDetailSource,
  locale: Locale,
  copy: OpsCopy,
): OpsRecordDetail {
  const pdfHref = localizedPath(locale, `/ops/processes/${item.id}/pdf`);
  const pickupIsAirport = isAirportPickup({
    airportCode: item.pickupAirportCode,
    locationType: item.pickupLocationType,
    placeId: item.pickupPlaceId,
  });
  return {
    kind: "process",
    id: item.id,
    brand: copy.brand,
    title: copy.processDetailTitle,
    code: null,
    status: null,
    pdfHref,
    pdfFilename: processPdfFilename(item.createdAt),
    voucherPdfHref: null,
    voucherPdfFilename: null,
    summary: compact([
      row(copy.createdAt, dateText(item.createdAt, locale)),
      row(copy.updatedAt, dateText(item.updatedAt, locale)),
      row(copy.status, statusLabel(item.status, copy)),
      row(copy.stage, stageLabel(item.currentStage, copy)),
      row(copy.locale, localeLabel(item.locale, copy)),
      row(
        copy.conversion,
        item.converted
          ? [copy.converted, item.reservationCode].filter(Boolean).join(" · ")
          : copy.notConverted,
      ),
    ]),
    pickupIsAirport,
    service: compact([
      row(
        copy.serviceType,
        serviceLabel(item.serviceType, copy, {
          tourCode: item.tourCode,
          locale,
        }),
      ),
      ...currentAndSelected(
        copy.transferAt,
        copy.selected,
        dateText(item.appliedPickupAt, locale),
        dateText(item.selectedPickupAt, locale),
      ),
      ...(isPackageTourServiceType(item.serviceType, item.tourCode)
        ? withPackageOverrunNote(
            compact([
              row(
                copy.packageCoverage,
                formatPackageCoverageForTour(item.tourCode, locale, {
                  bursaRoute: item.appliedBursaRoute ?? item.selectedBursaRoute,
                }) ?? "",
              ),
            ]),
            locale,
            item.tourCode,
          )
        : isHourlyServiceType(item.serviceType)
        ? withHourlyKmOverrunNote(
            currentAndSelected(
              copy.durationHours,
              copy.selected,
              formatOpsDuration(item.appliedDurationHours, locale),
              formatOpsDuration(item.selectedDurationHours, locale),
            ),
            locale,
          )
        : []),
    ]),
    transfer: compact([
      ...(isHourlyServiceType(item.serviceType)
        ? []
        : currentAndSelected(
            copy.distance,
            copy.selected,
            item.appliedDistanceKm,
            item.selectedDistanceKm,
          )),
      ...currentAndSelected(
        copy.passengerCount,
        copy.selected,
        countText(item.appliedPassengerCount),
        countText(item.selectedPassengerCount),
      ),
      ...currentAndSelected(
        copy.luggage,
        copy.selected,
        countText(item.appliedLuggageCount),
        countText(item.selectedLuggageCount),
      ),
      ...currentAndSelected(
        copy.babySeat,
        copy.selected,
        countText(item.appliedBabySeatCount),
        countText(item.selectedBabySeatCount),
      ),
      ...currentAndSelected(
        copy.flight,
        copy.selected,
        item.appliedFlightCode,
        item.selectedFlightCode,
      ),
      ...currentAndSelected(
        copy.meetAndGreet,
        copy.selected,
        yn(item.appliedMeetAndGreet, copy),
        yn(item.selectedMeetAndGreet, copy),
      ),
    ]),
    places: [
      place(
        copy.pickup,
        item.appliedPickup,
        item.appliedPickupAddress,
        item.selectedPickup,
        item.selectedPickupAddress,
      ),
      ...(isHourlyServiceType(item.serviceType)
        ? []
        : [
            place(
              copy.dropoff,
              item.appliedDropoff,
              item.appliedDropoffAddress,
              item.selectedDropoff,
              item.selectedDropoffAddress,
            ),
          ]),
    ].filter((itemPlace): itemPlace is OpsDetailPlace => itemPlace !== null),
    vehicle: compact([
      ...currentAndSelected(
        copy.vehicle,
        copy.selected,
        item.appliedVehicleLabel,
        item.selectedVehicleLabel,
      ),
      ...currentAndSelected(
        copy.vehicleCode,
        copy.selected,
        item.appliedVehicleCode,
        item.selectedVehicleCode,
      ),
    ]),
    ...priceFields(
      locale,
      item.currency,
      item.appliedVehicleTotal,
      item.fxSnapshot,
      item.appliedVehicleTotalEur,
      null,
      item.priceManuallyOverridden,
      item.manualPriceTotals,
    ),
    pricing: [],
    customer: compact([
      row(copy.firstName, displayText(item.customerFirstName)),
      row(copy.lastName, displayText(item.customerLastName)),
      row(copy.email, displayText(item.email)),
      row(copy.phone, displayText(item.phone)),
      row(
        copy.nationality,
        countryName(item.customerCountryCode, locale) || displayText(item.customerCountryCode),
      ),
      row(copy.paymentMethod, paymentLabel(item.paymentMethod, copy)),
    ]),
    passengerNote: passengerNoteText(item.notes),
    passengers: mapPassengers(item.passengers, locale, copy),
    technical: compact([
      row(copy.locale, localeLabel(item.locale, copy)),
      row(copy.techDevice, displayText(item.deviceType)),
      row(copy.techOs, joined([item.osName, item.osVersion])),
      row(copy.techBrowser, joined([item.browserName, item.browserVersion])),
      row(
        copy.techViewport,
        item.viewportWidth && item.viewportHeight
          ? `${item.viewportWidth}×${item.viewportHeight}`
          : "",
      ),
      row(
        copy.techScreen,
        item.screenWidth && item.screenHeight
          ? `${item.screenWidth}×${item.screenHeight}`
          : "",
      ),
      row(copy.techBrowserLanguage, displayText(item.browserLanguage)),
      row(copy.techClientTimezone, displayText(item.clientTimezone)),
      row(copy.createdAt, dateText(item.createdAt, locale)),
    ]),
    actionContext: null,
    paymentHistory: null,
    operationAssignment: null,
    driverTask: null,
  };
}

export function toReservationRecordDetail(
  item: ReservationDetailSource,
  locale: Locale,
  copy: OpsCopy,
): OpsRecordDetail {
  const pickupIsAirport = isAirportPickup({
    airportCode: item.pickupAirportCode,
    locationType: item.pickupLocationType,
    placeId: item.pickupPlaceId,
  });
  const snapshottedContent =
    parseReservationServiceSnapshot(item.serviceContentSnapshot)?.locales[
      locale
    ] ?? null;
  const bosphorus = isBosphorusDinnerTour(item.serviceType, item.tourCode);
  const fallbackBosphorusContent: ReservationServiceContent | null = bosphorus
    ? {
        packageCoverage: null,
        packageNotes: [],
        includedSectionTitle:
          bosphorusDinnerCopy[locale].voucherIncludedSectionTitle,
        includedItems: [
          ...bosphorusDinnerCopy[locale].included,
          bosphorusDinnerCopy[locale].durationNotice,
        ],
        serviceInfoSectionTitle:
          bosphorusDinnerCopy[locale].voucherServiceInfoSectionTitle,
        serviceInfoGroups: bosphorusDinnerCopy[locale].serviceInfoGroups,
      }
    : null;
  const serviceContent = snapshottedContent ?? fallbackBosphorusContent;
  const packageRows = serviceContent
    ? compact([
        serviceContent.packageCoverage
          ? {
              label: copy.packageCoverage,
              value: serviceContent.packageCoverage,
              note: serviceContent.packageNotes.join("\n") || undefined,
            }
          : null,
        serviceContent.includedSectionTitle && serviceContent.includedItems.length
          ? row(
              serviceContent.includedSectionTitle,
              serviceContent.includedItems.join(" · "),
            )
          : null,
        ...serviceContent.serviceInfoGroups.map((group) =>
          row(group.title, group.body),
        ),
      ])
    : isPackageTourServiceType(item.serviceType, item.tourCode)
      ? withPackageOverrunNote(
          compact([
            row(
              copy.packageCoverage,
              formatPackageCoverageForTour(item.tourCode, locale, {
                bursaRoute: item.bursaRoute,
              }) ?? "",
            ),
          ]),
          locale,
          item.tourCode,
        )
      : isHourlyServiceType(item.serviceType)
        ? compact([
            row(
              copy.packageCoverage,
              formatHourlyPackageCoverage(item.durationHours, locale) ?? "",
              formatHourlyPackageOverrunNote(locale),
            ),
          ])
        : [];
  return {
    kind: "reservation",
    id: item.id,
    brand: copy.brand,
    title: copy.reservationDetailTitle,
    code: displayText(item.reservationCode) || null,
    status: displayText(item.status) || null,
    pdfHref: localizedPath(locale, `/ops/reservations/${item.id}/pdf`),
    pdfFilename: reservationPdfFilename(item.reservationCode),
    voucherPdfHref: localizedPath(locale, `/ops/reservations/${item.id}/voucher-pdf`),
    voucherPdfFilename: reservationVoucherPdfFilename(item.reservationCode),
    summary: compact([
      row(copy.locale, localeLabel(item.locale, copy)),
    ]),
    pickupIsAirport,
    service: compact([
      row(
        copy.serviceType,
        serviceLabel(item.serviceType, copy, {
          tourCode: item.tourCode,
          locale,
        }),
      ),
      row(copy.transferAt, dateText(item.pickupAt, locale)),
      ...packageRows,
    ]),
    places: [
      place(copy.pickup, item.pickupName, item.pickupAddress, null, null),
      ...(shouldShowDropoff(item.serviceType)
        ? [place(copy.dropoff, item.dropoffName, item.dropoffAddress, null, null)]
        : []),
    ].filter((itemPlace): itemPlace is OpsDetailPlace => itemPlace !== null),
    vehicle: compact([
      reservationVehicleRow(
        item,
        locale,
        copy,
        serviceContent?.vehicleSubtitle,
      ),
    ]),
    ...(() => {
      const pricing = priceFields(
        locale,
        item.currency,
        null,
        item.fxSnapshot,
        null,
        item.totalPrice,
        item.priceManuallyOverridden,
        item.manualPriceTotals,
      );
      return {
        ...pricing,
        transfer: compact([
          shouldShowDistance(item.serviceType)
            ? row(copy.distance, formatOpsDistance(item.distanceKm, locale))
            : null,
          row(copy.passengerCount, countText(item.passengerCount)),
          bosphorus ? null : row(copy.luggage, countText(item.luggageCount)),
          bosphorus ? null : row(copy.babySeat, countText(item.babySeatCount)),
          row(copy.flight, displayText(item.flightCode)),
          bosphorus ? null : row(copy.meetAndGreet, yn(item.meetAndGreet, copy)),
          pricing.selectedPrice
            ? {
                label: copy.selectedPrice,
                value: pricing.selectedPrice,
                emphasizeValue: true,
                strongAmount: true,
              }
            : null,
        ]),
      };
    })(),
    pricing: [],
    customer: compact([
      row(copy.email, displayText(item.customerEmail)),
      row(copy.phone, displayText(item.customerPhone)),
    ]),
    passengerNote: passengerNoteText(item.notes),
    passengers: mapPassengers(item.passengers, locale, copy, "111"),
    technical: null,
    paymentHistory: item.paymentHistory ?? null,
    operationAssignment: reservationOperationAssignment(item, locale, copy),
    driverTask: item.driverTask ?? null,
    actionContext: buildReservationActionContext({
      status: item.status,
      serviceType: item.serviceType,
      tourCode: item.tourCode,
      pickupAt: item.pickupAt,
      paymentMethod: item.paymentMethod,
      paymentStatus: item.paymentStatus,
      paymentProvider: item.paymentProvider,
      paymentProviderOrderId: item.paymentProviderOrderId,
      paymentAmount: item.paymentAmount,
      paymentCurrency: item.paymentCurrency,
      refundStatus: item.refundStatus,
    }),
  };
}
