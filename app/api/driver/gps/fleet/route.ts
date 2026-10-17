import { NextResponse } from "next/server";
import { assignedGpsItems } from "@/lib/driver-portal/gps-filter";
import { driverGpsContext } from "@/lib/driver-portal/gps-scope";
import { listPartnerVehicleIdentity } from "@/lib/gps/drive-store";
import { gpsFleetPoint, type GpsFleetVehicle } from "@/lib/gps/fleet";
import { listMobileFleet } from "@/lib/gps/mobile-store";
import { gpsIsLiveMapSource } from "@/lib/gps/registration";
import { listFleetDefaultDrivers, listGpsDevices, listGpsRecentFixes } from "@/lib/gps/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
  const context = await driverGpsContext("gpsLive");
  if (!context) {
    return NextResponse.json({ ok: false }, { status: 401, headers: noStore });
  }
  const devices = assignedGpsItems(
    (await listGpsDevices(context.actor.partnerId)).filter(gpsIsLiveMapSource),
    context.vehicleIds,
  );
  const mobile = assignedGpsItems(await listMobileFleet(context.actor.partnerId), context.vehicleIds);
  const [recent, drivers, identities] = await Promise.all([
    listGpsRecentFixes(devices.map((device) => device.id)),
    listFleetDefaultDrivers(context.actor.partnerId),
    listPartnerVehicleIdentity(context.actor.partnerId),
  ]);
  const vehicles: GpsFleetVehicle[] = devices.map((device) => {
    const point = gpsFleetPoint(device.latitude, device.longitude);
    const identity = device.vehicleId ? identities.get(device.vehicleId) : undefined;
    return {
      id: device.id,
      plate: device.plate,
      deviceCode: device.deviceCode,
      latitude: point?.latitude ?? null,
      longitude: point?.longitude ?? null,
      speedMps: device.speedMps,
      headingDeg: device.headingDeg,
      recordedAt: device.recordedAt,
      lastHeartbeatAt: device.lastHeartbeatAt,
      receivedAt: device.lastHeartbeatAt,
      gnssFix: device.gnssFix,
      satellites: device.satellites,
      recent: recent.get(device.id) ?? [],
      source: "device",
      vehicleId: device.vehicleId,
      driverName: device.vehicleId ? drivers.get(device.vehicleId) ?? null : null,
      brand: identity?.brand ?? null,
      model: identity?.model ?? null,
    };
  });
  vehicles.push(...mobile.map((vehicle) => {
    const identity = vehicle.vehicleId ? identities.get(vehicle.vehicleId) : undefined;
    return { ...vehicle, brand: identity?.brand ?? null, model: identity?.model ?? null };
  }));
  return NextResponse.json({ ok: true, vehicles }, { headers: noStore });
}
