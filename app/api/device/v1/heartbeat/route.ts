import { type NextRequest } from "next/server";
import { authenticateDevice } from "@/lib/gps/device-auth";
import { deviceJson } from "@/lib/gps/http";
import { ingestHeartbeat } from "@/lib/gps/ingest";
import { notifyPartnerLowBattery } from "@/lib/gps/low-battery-notify";
import { GPS_MAX_BODY_BYTES, parseHeartbeatBody } from "@/lib/gps/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (tooLarge(request)) {
    return deviceJson(413, { ok: false, error: "payload_too_large" });
  }
  const auth = await authenticateDevice(request);
  if ("response" in auth) {
    return auth.response;
  }
  const body = await readJson(request);
  const heartbeat = body === undefined ? null : parseHeartbeatBody(body);
  if (!heartbeat) {
    return deviceJson(400, { ok: false, error: "invalid_body" });
  }
  const result = await ingestHeartbeat(auth.device.id, heartbeat);
  if (result.http !== 200) {
    return deviceJson(result.http, { ok: false, error: result.error });
  }
  if (result.lowBatteryAlert) {
    try {
      await notifyPartnerLowBattery(result.lowBatteryAlert);
    } catch (error) {
      console.error("[gps] low-battery push failed", error instanceof Error ? error.message : error);
    }
  }
  return deviceJson(200, {
    ok: true,
    server_time: new Date().toISOString(),
    acked_through: result.ackedThrough,
    commands_waiting: result.commandsWaiting,
  });
}

async function readJson(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function tooLarge(request: NextRequest) {
  const length = Number(request.headers.get("content-length") ?? 0);
  return Number.isFinite(length) && length > GPS_MAX_BODY_BYTES;
}
