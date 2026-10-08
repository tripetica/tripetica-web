import { NextResponse } from "next/server";
import { gpsFleetPoint, type GpsFleetVehicle } from "@/lib/gps/fleet";
import { listGpsDevices } from "@/lib/gps/queries";
import { getPartnerActor } from "@/lib/partner/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
  const partner = await getPartnerActor();
  if (!partner || partner.mustChangePassword) {
    return NextResponse.json({ ok: false }, { status: 401, headers: noStore });
  }
  const devices = await listGpsDevices(partner.partnerId);
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
      gnssFix: device.gnssFix,
      satellites: device.satellites,
    };
  });
  return NextResponse.json({ ok: true, vehicles }, { headers: noStore });
}
