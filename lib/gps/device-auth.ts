import "server-only";

import { type NextRequest } from "next/server";
import { query } from "@/lib/db/postgres";
import { deviceJson } from "@/lib/gps/http";
import { hashDeviceToken, readBearerToken } from "@/lib/gps/token";

export type GpsDeviceAuth = {
  id: string;
  partnerId: string | null;
  vehicleId: string | null;
  status: "active" | "disabled";
};

type DeviceAuthRow = {
  id: string;
  partner_id: string | null;
  vehicle_id: string | null;
  status: "active" | "disabled";
};

export async function authenticateDevice(request: NextRequest) {
  const token = readBearerToken(request.headers.get("authorization"));
  if (!token) {
    return { response: deviceJson(401, { ok: false, error: "unauthorized" }) };
  }
  const result = await query<DeviceAuthRow>(
    `SELECT device.id, device.partner_id, device.vehicle_id, device.status
     FROM gps_device_credentials credential
     JOIN gps_devices device ON device.id = credential.device_id
     WHERE credential.token_hash = $1
       AND credential.revoked_at IS NULL
     LIMIT 1`,
    [hashDeviceToken(token)],
  );
  const row = result.rows[0];
  if (!row) {
    return { response: deviceJson(401, { ok: false, error: "unauthorized" }) };
  }
  if (row.status !== "active") {
    return { response: deviceJson(403, { ok: false, error: "disabled" }) };
  }
  const device: GpsDeviceAuth = {
    id: row.id,
    partnerId: row.partner_id,
    vehicleId: row.vehicle_id,
    status: row.status,
  };
  return { device };
}
