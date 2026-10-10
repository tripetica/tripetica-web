import { NextResponse } from "next/server";
import { gpsFleetPoint, type GpsFleetVehicle } from "@/lib/gps/fleet";
import { listMobileFleet } from "@/lib/gps/mobile-store";
import { gpsIsLiveMapSource } from "@/lib/gps/registration";
import { listFleetDefaultDrivers, listGpsDevices, listGpsRecentFixes } from "@/lib/gps/queries";
import { partnerHasTab } from "@/lib/partner/access";
import { getPartnerActor } from "@/lib/partner/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
  const partner = await getPartnerActor();
  if (!partner || partner.mustChangePassword || !partnerHasTab(partner, "gps")) {
    return NextResponse.json({ ok: false }, { status: 401, headers: noStore });
  }
  const devices = (await listGpsDevices(partner.partnerId)).filter(gpsIsLiveMapSource);
  const [recent, drivers] = await Promise.all([
    listGpsRecentFixes(devices.map((device) => device.id)),
    listFleetDefaultDrivers(partner.partnerId),
  ]);
  const vehicles: GpsFleetVehicle[] = devices.map((device) => {
    const point = gpsFleetPoint(device.latitude, device.longitude);
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
      driverName: device.vehicleId ? drivers.get(device.vehicleId) ?? null : null,
    };
  });
  vehicles.push(...await listMobileFleet(partner.partnerId));
  return NextResponse.json({ ok: true, vehicles }, { headers: noStore });
}
