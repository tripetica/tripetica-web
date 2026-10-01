import { isPartnerVehicleCatalogPair, partnerVehicleCatalogLabels } from "@/lib/partner/vehicle-catalog";
import {
  initialVehicleStatusForClass,
  isPartnerVehicleClassCode,
  vehicleClassRequiresApproval,
} from "@/lib/partner/vehicle-class";
import { type PartnerVehicleStatus } from "@/lib/partner/fleet-view";

export const PARTNER_VEHICLE_MAX_AGE_YEARS = 15;
export const PARTNER_VEHICLE_PASSENGER_MIN = 1;
export const PARTNER_VEHICLE_PASSENGER_MAX = 45;
export const PARTNER_VEHICLE_LUGGAGE_MIN = 0;
export const PARTNER_VEHICLE_LUGGAGE_MAX = 45;
export const PARTNER_VEHICLE_PLATE_MAX = 24;

export const PARTNER_VEHICLE_COLOR_CODES = [
  "black",
  "white",
  "gray",
  "silver",
  "navy",
  "blue",
  "red",
  "brown",
  "beige",
  "other",
] as const;

export type PartnerVehicleColorCode = (typeof PARTNER_VEHICLE_COLOR_CODES)[number];

export const PARTNER_VEHICLE_FEATURE_CODES = [
  "ac",
  "wifi",
  "leather",
  "partition",
  "starlight",
  "tv",
  "fridge",
  "usb",
  "baby-seat",
  "electric-door",
  "other",
] as const;

export type PartnerVehicleFeatureCode = (typeof PARTNER_VEHICLE_FEATURE_CODES)[number];

export type PartnerVehicleApplicationError =
  | "invalid-plate"
  | "invalid-brand"
  | "invalid-model"
  | "invalid-year"
  | "invalid-color"
  | "invalid-passengers"
  | "invalid-luggage"
  | "invalid-class"
  | "invalid-features";

export type PartnerVehicleField =
  | "plate"
  | "brand"
  | "model"
  | "modelYear"
  | "color"
  | "passengers"
  | "luggage"
  | "vehicleClass"
  | "features";

export function partnerVehicleYearBounds(now = new Date()) {
  const maxYear = now.getFullYear();
  return { minYear: maxYear - PARTNER_VEHICLE_MAX_AGE_YEARS, maxYear };
}

export function partnerVehicleYearOptions(now = new Date()) {
  const { minYear, maxYear } = partnerVehicleYearBounds(now);
  const years: number[] = [];
  for (let year = maxYear; year >= minYear; year -= 1) {
    years.push(year);
  }
  return years;
}

export function isPartnerVehicleYearValid(year: number, now = new Date()) {
  const { minYear, maxYear } = partnerVehicleYearBounds(now);
  return Number.isInteger(year) && year >= minYear && year <= maxYear;
}

export function normalizePartnerPlate(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function isPartnerVehicleColorCode(value: string): value is PartnerVehicleColorCode {
  return (PARTNER_VEHICLE_COLOR_CODES as readonly string[]).includes(value);
}

export function isPartnerVehicleFeatureCode(value: string): value is PartnerVehicleFeatureCode {
  return (PARTNER_VEHICLE_FEATURE_CODES as readonly string[]).includes(value);
}

export function normalizePartnerVehicleFeatureCodes(values: readonly string[]) {
  const unique: PartnerVehicleFeatureCode[] = [];
  for (const value of values) {
    if (isPartnerVehicleFeatureCode(value) && !unique.includes(value)) {
      unique.push(value);
    }
  }
  return unique;
}

export function partnerVehicleErrorField(
  error:
    | PartnerVehicleApplicationError
    | "duplicate-plate"
    | "failed"
    | "not-found"
    | "needs-approval"
    | "in-use"
    | "invalid-uetds-company"
    | "invalid-fleet-pair",
): PartnerVehicleField | null {
  switch (error) {
    case "invalid-plate":
    case "duplicate-plate":
      return "plate";
    case "invalid-brand":
      return "brand";
    case "invalid-model":
      return "model";
    case "invalid-year":
      return "modelYear";
    case "invalid-color":
      return "color";
    case "invalid-passengers":
      return "passengers";
    case "invalid-luggage":
      return "luggage";
    case "invalid-class":
      return "vehicleClass";
    case "invalid-features":
      return "features";
    default:
      return null;
  }
}

export function parsePartnerVehicleInput(input: {
  plate: string;
  brandCode: string;
  modelCode: string;
  modelYear: string | number;
  colorCode: string;
  colorOther: string;
  passengerCapacity: string | number;
  luggageCapacity: string | number;
  vehicleClassCode: string;
  featureCodes: readonly string[];
  featureOther: string;
  now?: Date;
}) {
  const plate = normalizePartnerPlate(input.plate);
  if (!plate || plate.length > PARTNER_VEHICLE_PLATE_MAX) {
    return { ok: false as const, error: "invalid-plate" as const };
  }
  const brandCode = input.brandCode.trim();
  const modelCode = input.modelCode.trim();
  if (!brandCode) {
    return { ok: false as const, error: "invalid-brand" as const };
  }
  if (!modelCode || !isPartnerVehicleCatalogPair(brandCode, modelCode)) {
    return { ok: false as const, error: "invalid-model" as const };
  }
  const modelYear = Number(input.modelYear);
  if (!isPartnerVehicleYearValid(modelYear, input.now)) {
    return { ok: false as const, error: "invalid-year" as const };
  }
  const colorCode = input.colorCode.trim();
  if (!isPartnerVehicleColorCode(colorCode)) {
    return { ok: false as const, error: "invalid-color" as const };
  }
  const colorOther = input.colorOther.trim().replace(/\s+/g, " ");
  if (colorCode === "other" && (!colorOther || colorOther.length > 40)) {
    return { ok: false as const, error: "invalid-color" as const };
  }
  const passengerCapacity = Number(input.passengerCapacity);
  if (
    !Number.isInteger(passengerCapacity) ||
    passengerCapacity < PARTNER_VEHICLE_PASSENGER_MIN ||
    passengerCapacity > PARTNER_VEHICLE_PASSENGER_MAX
  ) {
    return { ok: false as const, error: "invalid-passengers" as const };
  }
  const luggageCapacity = Number(input.luggageCapacity);
  if (
    !Number.isInteger(luggageCapacity) ||
    luggageCapacity < PARTNER_VEHICLE_LUGGAGE_MIN ||
    luggageCapacity > PARTNER_VEHICLE_LUGGAGE_MAX
  ) {
    return { ok: false as const, error: "invalid-luggage" as const };
  }
  const vehicleClassCode = input.vehicleClassCode.trim();
  if (!isPartnerVehicleClassCode(vehicleClassCode)) {
    return { ok: false as const, error: "invalid-class" as const };
  }
  const featureCodes = normalizePartnerVehicleFeatureCodes(input.featureCodes);
  const featureOther = input.featureOther.trim().replace(/\s+/g, " ");
  if (featureCodes.includes("other") && (!featureOther || featureOther.length > 80)) {
    return { ok: false as const, error: "invalid-features" as const };
  }
  const labels = partnerVehicleCatalogLabels(brandCode, modelCode);
  return {
    ok: true as const,
    value: {
      plate,
      brandCode,
      modelCode,
      brand: labels.brand ?? brandCode,
      model: labels.model ?? modelCode,
      modelYear,
      colorCode,
      colorOther: colorCode === "other" ? colorOther : null,
      passengerCapacity,
      luggageCapacity,
      vehicleClassCode,
      featureCodes,
      featureOther: featureCodes.includes("other") ? featureOther : null,
    },
  };
}

export function nextPartnerVehicleStatus(input: {
  nextClassCode: string;
  currentStatus: PartnerVehicleStatus;
  currentClassCode: string | null;
  source: "partner" | "ops";
}): PartnerVehicleStatus {
  if (vehicleClassRequiresApproval(input.nextClassCode)) {
    if (input.currentClassCode !== input.nextClassCode) {
      return "pending_approval";
    }
    if (input.source === "partner" && input.currentStatus === "rejected") {
      return "pending_approval";
    }
    return input.currentStatus;
  }
  if (
    input.currentStatus === "pending_approval" ||
    (input.source === "partner" && input.currentStatus === "rejected")
  ) {
    return "active";
  }
  return input.currentStatus;
}

export function partnerCreateVehicleStatus(classCode: string): PartnerVehicleStatus {
  return initialVehicleStatusForClass(classCode);
}
