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
  const simPhone = optionalText(input.simPhone);
  const simOperator = optionalText(input.simOperator);
  const simApn = optionalText(input.simApn);
  if (input.receiver === "esp32") {
    if (imei && !IMEI_PATTERN.test(imei)) return { ok: false, error: "imei" };
    if (serial || simPhone || simOperator || simApn) return { ok: false, error: "invalid" };
    return {
      ok: true,
      value: {
        receiver: "esp32",
        manufacturer: "esp32",
        trackerModel: null,
        linkTechnology: null,
        imei: imei || null,
        serialNumber: null,
        simPhone: null,
        simOperator: null,
        simApn: null,
        installationStatus: "installed",
      },
    };
  }
  if (!input.model || !IMEI_PATTERN.test(imei)) return { ok: false, error: "imei" };
  if (serial && !SERIAL_PATTERN.test(serial)) return { ok: false, error: "invalid" };
  if (simPhone && !PHONE_PATTERN.test(simPhone)) return { ok: false, error: "invalid" };
  if (simOperator && (simOperator.length > 40 || /[\r\n]/.test(simOperator))) return { ok: false, error: "invalid" };
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
  if (!input.vehicleId || input.destinationHasOtherLiveSource) return false;
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
