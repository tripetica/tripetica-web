"use server";

import { getDriverPortalActor } from "@/lib/driver-portal/session";
import { partnerHasTab } from "@/lib/partner/access";
import { getPartnerActor } from "@/lib/partner/session";
import { driverAuthorizedVehicleIds } from "@/lib/uetds/driver-access";
import {
  istanbulMaintenanceDate,
  parseMaintenanceKm,
  validateMaintenanceEdit,
  validateMaintenanceSetup,
  type MaintenanceActionResult,
} from "@/lib/gps/maintenance";
import {
  completeVehicleMaintenance,
  correctVehicleMaintenance,
  editVehicleMaintenance,
  startVehicleMaintenance,
} from "@/lib/gps/maintenance-store";

const VEHICLE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function actor(formData: FormData) {
  if (String(formData.get("actor") ?? "") === "driver") {
    const driver = await getDriverPortalActor();
    if (!driver?.permissions.gpsMaintenance) return null;
    return {
      partnerId: driver.partnerId,
      actorUserId: null,
      vehicleIds: await driverAuthorizedVehicleIds(driver.partnerId, driver.driverId),
    };
  }
  const current = await getPartnerActor();
  if (!current || current.mustChangePassword || !partnerHasTab(current, "gps")) return null;
  return { partnerId: current.partnerId, actorUserId: current.userId, vehicleIds: null as string[] | null };
}

function vehicleAllowed(scope: { vehicleIds: string[] | null }, vehicleId: string) {
  return scope.vehicleIds === null || scope.vehicleIds.includes(vehicleId);
}

function vehicleIdOf(formData: FormData) {
  const vehicleId = String(formData.get("vehicleId") ?? "");
  return VEHICLE_ID.test(vehicleId) ? vehicleId : null;
}

function idempotencyOf(formData: FormData) {
  const key = String(formData.get("idempotencyKey") ?? "");
  return VEHICLE_ID.test(key) ? key : null;
}

export async function startVehicleMaintenanceAction(formData: FormData): Promise<MaintenanceActionResult> {
  const current = await actor(formData);
  const vehicleId = vehicleIdOf(formData);
  const idempotencyKey = idempotencyOf(formData);
  if (!current || !vehicleId || !idempotencyKey || !vehicleAllowed(current, vehicleId)) return { ok: false, error: "forbidden" };
  const parsed = validateMaintenanceSetup({
    startKm: String(formData.get("startKm") ?? ""),
    previousKm: String(formData.get("previousKm") ?? ""),
    previousOn: String(formData.get("previousOn") ?? ""),
    intervalKm: String(formData.get("intervalKm") ?? ""),
    today: istanbulMaintenanceDate(),
  });
  if (!parsed.ok) return parsed;
  return startVehicleMaintenance({
    vehicleId,
    partnerId: current.partnerId,
    actorUserId: current.actorUserId,
    startKm: parsed.startKm,
    previousKm: parsed.previousKm,
    previousOn: parsed.previousOn,
    intervalKm: parsed.intervalKm,
    idempotencyKey,
  });
}

export async function correctVehicleMaintenanceAction(formData: FormData): Promise<MaintenanceActionResult> {
  const current = await actor(formData);
  const vehicleId = vehicleIdOf(formData);
  const idempotencyKey = idempotencyOf(formData);
  if (!current || !vehicleId || !idempotencyKey || !vehicleAllowed(current, vehicleId)) return { ok: false, error: "forbidden" };
  const odometerKm = parseMaintenanceKm(String(formData.get("odometerKm") ?? ""));
  if (odometerKm === null) return { ok: false, error: "invalid" };
  return correctVehicleMaintenance({
    vehicleId,
    partnerId: current.partnerId,
    actorUserId: current.actorUserId,
    odometerKm,
    idempotencyKey,
  });
}

export async function completeVehicleMaintenanceAction(formData: FormData): Promise<MaintenanceActionResult> {
  const current = await actor(formData);
  const vehicleId = vehicleIdOf(formData);
  const idempotencyKey = idempotencyOf(formData);
  if (!current || !vehicleId || !idempotencyKey || !vehicleAllowed(current, vehicleId)) return { ok: false, error: "forbidden" };
  const expectedKm = parseMaintenanceKm(String(formData.get("expectedKm") ?? ""));
  const expectedDate = String(formData.get("expectedDate") ?? "");
  if (expectedKm === null || !/^\d{4}-\d{2}-\d{2}$/.test(expectedDate)) return { ok: false, error: "invalid" };
  return completeVehicleMaintenance({
    vehicleId,
    partnerId: current.partnerId,
    actorUserId: current.actorUserId,
    expectedKm,
    expectedDate,
    idempotencyKey,
  });
}

export async function editVehicleMaintenanceAction(formData: FormData): Promise<MaintenanceActionResult> {
  const current = await actor(formData);
  const vehicleId = vehicleIdOf(formData);
  const idempotencyKey = idempotencyOf(formData);
  if (!current || !vehicleId || !idempotencyKey || !vehicleAllowed(current, vehicleId)) return { ok: false, error: "forbidden" };
  const parsed = validateMaintenanceEdit({
    lastServiceKm: String(formData.get("lastServiceKm") ?? ""),
    lastServiceOn: String(formData.get("lastServiceOn") ?? ""),
    intervalKm: String(formData.get("intervalKm") ?? ""),
    today: istanbulMaintenanceDate(),
  });
  if (!parsed.ok) return parsed;
  return editVehicleMaintenance({
    vehicleId,
    partnerId: current.partnerId,
    actorUserId: current.actorUserId,
    lastServiceKm: parsed.lastServiceKm,
    lastServiceOn: parsed.lastServiceOn,
    intervalKm: parsed.intervalKm,
    idempotencyKey,
  });
}
