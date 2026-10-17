export type GpsTrackerModel = "fmb920" | "fmc920";
export type GpsInstallationStatus = "pending" | "installed";
export type GpsLinkTechnology = "2g" | "4g";

export type GpsRegistrationProfile = {
  receiver: "esp32" | "teltonika";
  manufacturer: "esp32" | "teltonika";
  trackerModel: GpsTrackerModel | null;
  linkTechnology: GpsLinkTechnology | null;
  imei: string | null;
  serialNumber: string | null;
  simPhone: string | null;
  simOperator: string | null;
  simApn: string | null;
  installationStatus: GpsInstallationStatus;
};

const IMEI_PATTERN = /^[0-9]{14,16}$/;
const SERIAL_PATTERN = /^[A-Za-z0-9-]{1,40}$/;
const PHONE_PATTERN = /^\+?[0-9]{8,15}$/;
const APN_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

/** Compact a typed SIM number for storage. Empty stays empty. Invalid input is rejected. */
export function gpsSimPhone(value: string): string | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  let compact = trimmed.replace(/[\s().-]/g, "");
  if (compact.startsWith("00")) compact = `+${compact.slice(2)}`;
  if (/^0[0-9]{10}$/.test(compact)) compact = `+90${compact.slice(1)}`;
  if (!PHONE_PATTERN.test(compact)) return undefined;
  return compact;
}

export const GPS_SIM_OPERATORS = ["Turkcell", "Vodafone", "Türk Telekom"] as const;
export type GpsSimOperator = (typeof GPS_SIM_OPERATORS)[number];

export function gpsSimOperator(value: string): GpsSimOperator | null {
  const trimmed = value.trim();
  return (GPS_SIM_OPERATORS as readonly string[]).includes(trimmed) ? trimmed as GpsSimOperator : null;
}

export function gpsLinkForModel(model: GpsTrackerModel | null): GpsLinkTechnology | null {
  if (model === "fmb920") return "2g";
  if (model === "fmc920") return "4g";
  return null;
}

export function gpsSecretRegistrationField(name: string) {
  return /password|secret|pin|token/i.test(name);
}

export function gpsRegistrationProfile(input: {
  receiver: "esp32" | "teltonika";
  model: GpsTrackerModel | null;
  imei: string;
  serial: string;
  simPhone: string;
  simOperator: string;
  simApn: string;
}): { ok: true; value: GpsRegistrationProfile } | { ok: false; error: "imei" | "invalid" } {
  const imei = input.imei.trim();
  const serial = optionalText(input.serial);
  const simPhone = gpsSimPhone(input.simPhone);
  const simOperator = gpsSimOperator(input.simOperator);
  const simApn = optionalText(input.simApn);
  if (!simOperator || simPhone === undefined) return { ok: false, error: "invalid" };
  if (input.receiver === "esp32") {
    if (imei && !IMEI_PATTERN.test(imei)) return { ok: false, error: "imei" };
    if (serial || simApn) return { ok: false, error: "invalid" };
    return {
      ok: true,
      value: {
        receiver: "esp32",
        manufacturer: "esp32",
        trackerModel: null,
        linkTechnology: null,
        imei: imei || null,
        serialNumber: null,
        simPhone,
        simOperator,
        simApn: null,
        installationStatus: "installed",
      },
    };
  }
  if (!input.model || !IMEI_PATTERN.test(imei)) return { ok: false, error: "imei" };
  if (serial && !SERIAL_PATTERN.test(serial)) return { ok: false, error: "invalid" };
  if (simApn && !APN_PATTERN.test(simApn)) return { ok: false, error: "invalid" };
  return {
    ok: true,
    value: {
      receiver: "teltonika",
      manufacturer: "teltonika",
      trackerModel: input.model,
      linkTechnology: gpsLinkForModel(input.model),
      imei,
      serialNumber: serial,
      simPhone,
      simOperator,
      simApn,
      installationStatus: "pending",
    },
  };
}

export function gpsInitialLiveSource(input: {
  receiver: "esp32" | "teltonika";
  hasVehicle: boolean;
  vehicleHasLiveSource: boolean;
}) {
  if (input.receiver === "teltonika" || !input.hasVehicle) return false;
  return !input.vehicleHasLiveSource;
}

export function gpsLiveSourceAfterAssignment(input: {
  liveSource: boolean;
  vehicleId: string | null;
  destinationHasOtherLiveSource: boolean;
}) {
  if (!input.vehicleId) return input.liveSource;
  if (input.destinationHasOtherLiveSource) return false;
  return input.liveSource;
}

export function gpsInstallPromotion(input: { pending: boolean; vehicleHasOtherLiveSource: boolean }) {
  if (!input.pending) return null;
  return {
    installationStatus: "installed" as const,
    liveSource: !input.vehicleHasOtherLiveSource,
  };
}

export function gpsIsLiveMapSource(device: {
  status: "active" | "disabled";
  installationStatus: GpsInstallationStatus;
  liveSource: boolean;
}) {
  return device.status === "active" && device.installationStatus === "installed" && device.liveSource;
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}
