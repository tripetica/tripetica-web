import { UETDS_OFFICIAL_TEST_ARAC_PLAKA } from "@/lib/uetds/ministry-test-fixtures";

export const ATS_MAX_TRANSPORT_ATTEMPTS = 3;
export const ATS_TRANSPORT_RETRY_MS = [60_000, 300_000, 900_000] as const;

export type AtsRuntime = "test" | "live" | null;

export type AtsBlockReason =
  | "environment"
  | "live_blocked"
  | "disabled"
  | "source_unset"
  | "not_source_device"
  | "device_reassigned"
  | "device_inactive"
  | "vehicle"
  | "company"
  | "company_not_ready"
  | "plate"
  | "gnss_time"
  | "district_unresolved"
  | "duplicate";

export function atsPlate(plate: string, runtime: AtsRuntime) {
  const canonical = plate.replace(/\s+/g, "").toUpperCase();
  if (!runtime || !canonical) {
    return null;
  }
  if (runtime === "live" && canonical === UETDS_OFFICIAL_TEST_ARAC_PLAKA) {
    return null;
  }
  return canonical;
}

export function decideAtsSubmission(input: {
  runtime: AtsRuntime;
  liveDispatchApproved: boolean;
  enabled: boolean;
  sourceDeviceId: string | null;
  device: { id: string; vehicleId: string | null; status: string };
  vehicle: { id: string; plate: string; companyId: string | null; deleted: boolean } | null;
  company: { id: string; status: string; integrationStatus: string } | null;
  position: {
    id: string;
    deviceId: string;
    vehicleId: string;
    recordedAt: string;
    receivedAt: string;
    latitude: number;
    longitude: number;
  };
  district: { ok: true; ilKodu: number; ilceMernisKodu: number } | { ok: false; reason: "unresolved" };
  alreadySubmitted: boolean;
}): { ok: true; plate: string; ilKodu: number; ilceMernisKodu: number; gnssTime: string } | { ok: false; reason: AtsBlockReason } {
  if (input.runtime === "live" && !input.liveDispatchApproved) {
    return { ok: false, reason: "live_blocked" };
  }
  if (input.runtime !== "test" && input.runtime !== "live") {
    return { ok: false, reason: "environment" };
  }
  if (!input.enabled) {
    return { ok: false, reason: "disabled" };
  }
  if (!input.sourceDeviceId) {
    return { ok: false, reason: "source_unset" };
  }
  if (input.position.deviceId !== input.sourceDeviceId || input.device.id !== input.sourceDeviceId) {
    return { ok: false, reason: "not_source_device" };
  }
  if (input.device.status !== "active") {
    return { ok: false, reason: "device_inactive" };
  }
  if (!input.vehicle || input.vehicle.deleted || input.position.vehicleId !== input.vehicle.id) {
    return { ok: false, reason: "vehicle" };
  }
  if (input.device.vehicleId !== input.vehicle.id) {
    return { ok: false, reason: "device_reassigned" };
  }
  if (!input.vehicle.companyId || !input.company || input.company.id !== input.vehicle.companyId) {
    return { ok: false, reason: "company" };
  }
  if (input.company.status !== "active" || input.company.integrationStatus !== "ready") {
    return { ok: false, reason: "company_not_ready" };
  }
  const plate = atsPlate(input.vehicle.plate, input.runtime);
  if (!plate) {
    return { ok: false, reason: "plate" };
  }
  const gnssTime = Date.parse(input.position.recordedAt);
  if (!Number.isFinite(gnssTime)) {
    return { ok: false, reason: "gnss_time" };
  }
  if (!input.district.ok) {
    return { ok: false, reason: "district_unresolved" };
  }
  if (input.alreadySubmitted) {
    return { ok: false, reason: "duplicate" };
  }
  return {
    ok: true,
    plate,
    ilKodu: input.district.ilKodu,
    ilceMernisKodu: input.district.ilceMernisKodu,
    gnssTime: input.position.recordedAt,
  };
}

export function nextAtsAttempt(input: {
  enabled: boolean;
  attemptCount: number;
  sonucKodu: number | null;
  now: Date;
}) {
  if (!input.enabled) {
    return { retry: false as const, reason: "disabled" as const };
  }
  if (input.sonucKodu === 0) {
    return { retry: false as const, reason: "succeeded" as const };
  }
  if (input.sonucKodu !== null) {
    return { retry: false as const, reason: "rejected" as const };
  }
  if (input.attemptCount >= ATS_MAX_TRANSPORT_ATTEMPTS) {
    return { retry: false as const, reason: "exhausted" as const };
  }
  const delay = ATS_TRANSPORT_RETRY_MS[Math.min(input.attemptCount, ATS_TRANSPORT_RETRY_MS.length - 1)] ?? ATS_TRANSPORT_RETRY_MS[0];
  return {
    retry: true as const,
    reason: "transport" as const,
    nextAttemptAt: new Date(input.now.getTime() + delay),
  };
}

export function planAtsControl(input: {
  actorAllowed: boolean;
  enable: boolean;
  device: { id: string; vehicleId: string | null; status: string; partnerId: string | null };
  vehicle: { id: string; partnerId: string; deleted: boolean; companyId: string | null } | null;
  companyReady: boolean;
  current: { enabled: boolean; sourceDeviceId: string | null } | null;
}): { ok: true; action: "enable" | "disable" | "unchanged"; sourceDeviceId: string | null } | { ok: false; error: "forbidden" | "no_vehicle" | "no_company" | "other_source" | "device" } {
  if (!input.actorAllowed) {
    return { ok: false, error: "forbidden" };
  }
  if (!input.device.vehicleId || !input.vehicle || input.vehicle.deleted || input.vehicle.id !== input.device.vehicleId || input.vehicle.partnerId !== input.device.partnerId) {
    return { ok: false, error: "no_vehicle" };
  }
  if (!input.enable) {
    if (!input.current?.enabled) {
      return { ok: true, action: "unchanged", sourceDeviceId: input.current?.sourceDeviceId ?? null };
    }
    return { ok: true, action: "disable", sourceDeviceId: input.current.sourceDeviceId };
  }
  if (input.device.status !== "active") {
    return { ok: false, error: "device" };
  }
  if (!input.vehicle.companyId || !input.companyReady) {
    return { ok: false, error: "no_company" };
  }
  if (input.current?.enabled && input.current.sourceDeviceId && input.current.sourceDeviceId !== input.device.id) {
    return { ok: false, error: "other_source" };
  }
  return { ok: true, action: "enable", sourceDeviceId: input.device.id };
}
