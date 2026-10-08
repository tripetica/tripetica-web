import { type NextRequest } from "next/server";
import { GPS_MAX_BODY_BYTES, parseTelemetryBody } from "@/lib/gps/contract";
import { authenticateDevice } from "@/lib/gps/device-auth";
import { deviceJson } from "@/lib/gps/http";
import { ingestTelemetry } from "@/lib/gps/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > GPS_MAX_BODY_BYTES) {
    return deviceJson(413, { ok: false, error: "payload_too_large" });
  }
  const auth = await authenticateDevice(request);
  if ("response" in auth) {
    return auth.response;
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return deviceJson(400, { ok: false, error: "invalid_body" });
  }
  const parsed = parseTelemetryBody(body, new Date());
  if (!parsed) {
    return deviceJson(400, { ok: false, error: "invalid_body" });
  }
  const result = await ingestTelemetry(auth.device.id, parsed.points, parsed.rejected, parsed.battery);
  if (result.http !== 200) {
    return deviceJson(result.http, { ok: false, error: result.error });
  }
  return deviceJson(200, {
    ok: true,
    server_time: new Date().toISOString(),
    accepted: result.accepted,
    duplicate: result.duplicate,
    rejected: result.rejected,
    acked_through: result.ackedThrough,
    live_advanced: result.liveAdvanced,
  });
}
