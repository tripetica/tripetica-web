import {
  PARTNER_VEHICLE_COLOR_CODES,
  PARTNER_VEHICLE_FEATURE_CODES,
  type PartnerVehicleColorCode,
  type PartnerVehicleFeatureCode,
} from "@/lib/partner/vehicle-policy";
import { type PartnerVehicleStatus } from "@/lib/partner/fleet-view";

export type VehicleChoiceCopy = {
  vehicleActive: string;
  vehicleInactive: string;
  vehiclePending: string;
  vehicleRejected: string;
  colorBlack: string;
  colorWhite: string;
  colorGray: string;
  colorSilver: string;
  colorNavy: string;
  colorBlue: string;
  colorRed: string;
  colorBrown: string;
  colorBeige: string;
  colorOther: string;
  featureAc: string;
  featureWifi: string;
  featureLeather: string;
  featurePartition: string;
  featureStarlight: string;
  featureTv: string;
  featureFridge: string;
  featureUsb: string;
  featureBabySeat: string;
  featureElectricDoor: string;
  featureOther: string;
};

const COLOR_KEYS: Record<PartnerVehicleColorCode, keyof VehicleChoiceCopy> = {
  black: "colorBlack",
  white: "colorWhite",
  gray: "colorGray",
  silver: "colorSilver",
  navy: "colorNavy",
  blue: "colorBlue",
  red: "colorRed",
  brown: "colorBrown",
  beige: "colorBeige",
  other: "colorOther",
};

const FEATURE_KEYS: Record<PartnerVehicleFeatureCode, keyof VehicleChoiceCopy> = {
  ac: "featureAc",
  wifi: "featureWifi",
  leather: "featureLeather",
  partition: "featurePartition",
  starlight: "featureStarlight",
  tv: "featureTv",
  fridge: "featureFridge",
  usb: "featureUsb",
  "baby-seat": "featureBabySeat",
  "electric-door": "featureElectricDoor",
  other: "featureOther",
};

export function vehicleColorLabel(code: string, copy: VehicleChoiceCopy) {
  if (code in COLOR_KEYS) {
    return copy[COLOR_KEYS[code as PartnerVehicleColorCode]];
  }
  return code || "—";
}

export function vehicleFeatureLabel(code: string, copy: VehicleChoiceCopy) {
  if (code in FEATURE_KEYS) {
    return copy[FEATURE_KEYS[code as PartnerVehicleFeatureCode]];
  }
  return code;
}

export function vehicleColorOptions(copy: VehicleChoiceCopy) {
  return PARTNER_VEHICLE_COLOR_CODES.map((code) => ({
    code,
    label: vehicleColorLabel(code, copy),
  }));
}

export function vehicleFeatureOptions(copy: VehicleChoiceCopy) {
  return PARTNER_VEHICLE_FEATURE_CODES.map((code) => ({
    code,
    label: vehicleFeatureLabel(code, copy),
  }));
}

export function vehicleStatusLabel(
  status: PartnerVehicleStatus,
  copy: Pick<
    VehicleChoiceCopy,
    "vehicleActive" | "vehicleInactive" | "vehiclePending" | "vehicleRejected"
  >,
) {
  if (status === "pending_approval") {
    return copy.vehiclePending;
  }
  if (status === "rejected") {
    return copy.vehicleRejected;
  }
  if (status === "active") {
    return copy.vehicleActive;
  }
  return copy.vehicleInactive;
}

export function formatVehicleFeatures(
  codes: readonly string[],
  other: string | null,
  copy: VehicleChoiceCopy,
) {
  const labels = codes.map((code) =>
    code === "other" ? other?.trim() || vehicleFeatureLabel(code, copy) : vehicleFeatureLabel(code, copy),
  );
  return labels.filter(Boolean).join(", ") || "—";
}

export function formatVehicleColor(
  colorCode: string | null,
  colorOther: string | null,
  fallback: string | null,
  copy: VehicleChoiceCopy,
) {
  if (colorCode === "other") {
    return colorOther?.trim() || fallback || "—";
  }
  if (colorCode) {
    return vehicleColorLabel(colorCode, copy);
  }
  return fallback || "—";
}
